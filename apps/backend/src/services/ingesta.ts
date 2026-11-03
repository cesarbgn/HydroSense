import { consultar, ejecutar } from '../db/pool.js'
import { log } from '../log.js'
import { ackEsquema, deteccionEsquema, estadoEsquema, procesoEsquema, vibracionEsquema, type Calidad } from '../mqtt/esquemas.js'
import { emitir } from '../realtime.js'
import { datetimeAIso, msADatetime } from '../tiempo.js'
import { confirmarAccion } from './actuadores.js'
import { evaluarDeteccion, evaluarPresion } from './alertas.js'
import { pinzaPorNombre } from './catalogo.js'
import { estado } from './estado.js'
import { RespaldoRms } from './respaldoRms.js'

// Presión y temperatura se miden junto a la pinza A (contrato MQTT).
const PINZA_PROCESO = 'A'
const DS18B20_DESCONECTADO = -127
const TIPO_DISPOSITIVO: Record<string, 'adquisicion' | 'actuacion'> = { acq01: 'adquisicion', act01: 'actuacion' }
const REFRESCO_CONEXION_MS = 2_000

let respaldo = new RespaldoRms()
const ultimaActualizacion = new Map<string, number>()

/** Olvida el estado en memoria. Solo para pruebas. */
export function reiniciarIngesta() {
  respaldo = new RespaldoRms()
  ultimaActualizacion.clear()
}

export function normalizarMedicion(valor: number | null | undefined, calidad: Calidad): { valor: number | null; calidad: Calidad } {
  if (calidad !== 'ok') return { valor: null, calidad }
  if (valor === null || valor === undefined) return { valor: null, calidad: 'sin_senal' }
  return { valor, calidad: 'ok' }
}

export function normalizarTemperatura(valor: number | null | undefined, calidad: Calidad) {
  // Un DS18B20 desconectado lee -127 °C; jamás se guarda como dato válido, aunque el firmware no lo marque.
  if (valor !== null && valor !== undefined && valor <= DS18B20_DESCONECTADO) return { valor: null, calidad: 'sin_senal' as Calidad }
  return normalizarMedicion(valor, calidad)
}

async function tocarDispositivo(clave: string, forzar = false) {
  const tipo = TIPO_DISPOSITIVO[clave]
  if (!tipo) return
  const ahora = Date.now()
  if (!forzar && ahora - (ultimaActualizacion.get(clave) ?? 0) < REFRESCO_CONEXION_MS) return
  ultimaActualizacion.set(clave, ahora)
  await ejecutar('UPDATE dispositivo SET ultima_conexion = NOW(3) WHERE tipo = ? AND activo = TRUE', [tipo])
  emitir('dispositivo', { clave, estado: estado.dispositivos[clave], ultima_conexion: datetimeAIso(msADatetime(ahora)) })
}

async function guardarLectura(idPinza: number, pinza: string, tipo: 'presion' | 'temperatura', medicion: { valor: number | null; calidad: Calidad }, fecha: string) {
  const { affectedRows } = await ejecutar(
    `INSERT INTO lectura (id_pinza, tipo, valor, calidad, fecha_hora) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id_lectura = id_lectura`,
    [idPinza, tipo, medicion.valor, medicion.calidad, fecha],
  )
  const nueva = affectedRows > 0
  if (nueva) emitir('lectura', { id_pinza: idPinza, pinza, tipo, ...medicion, fecha_hora: datetimeAIso(fecha) })
  return nueva
}

async function procesarProceso(datos: unknown) {
  const mensaje = procesoEsquema.parse(datos)
  const pinza = await pinzaPorNombre(PINZA_PROCESO)
  if (!pinza) throw new Error(`No existe la pinza ${PINZA_PROCESO}`)
  const fecha = msADatetime(mensaje.ts)
  const presion = normalizarMedicion(mensaje.presion_kpa, mensaje.q_presion)
  const nueva = await guardarLectura(pinza.id_pinza, pinza.nombre, 'presion', presion, fecha)
  await guardarLectura(pinza.id_pinza, pinza.nombre, 'temperatura', normalizarTemperatura(mensaje.temp_c, mensaje.q_temp), fecha)
  await tocarDispositivo('acq01')
  if (nueva) await evaluarPresion(pinza, presion.valor, mensaje.ts)
}

async function procesarVibracion(datos: unknown) {
  const mensaje = vibracionEsquema.parse(datos)
  const pinza = await pinzaPorNombre(mensaje.pinza)
  if (!pinza) throw new Error(`Pinza desconocida: ${mensaje.pinza}`)
  const fecha = msADatetime(mensaje.ts)
  const sinDato = mensaje.q !== 'ok'
  const valores = sinDato ? [null, null, null, null] : [mensaje.rms ?? null, mensaje.b1 ?? null, mensaje.b2 ?? null, mensaje.b3 ?? null]
  const { affectedRows } = await ejecutar(
    `INSERT INTO lectura_vibracion (id_pinza, fecha_hora, rms_total, rms_b1, rms_b2, rms_b3, n_muestras, calidad)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id_vibracion = id_vibracion`,
    [pinza.id_pinza, fecha, ...valores, mensaje.n, mensaje.q],
  )
  await tocarDispositivo('acq01')
  if (affectedRows === 0) return

  const [rms_total, rms_b1, rms_b2, rms_b3] = valores
  emitir('vibracion', { id_pinza: pinza.id_pinza, pinza: pinza.nombre, rms_total, rms_b1, rms_b2, rms_b3, n_muestras: mensaje.n, calidad: mensaje.q, fecha_hora: datetimeAIso(fecha) })

  if (typeof rms_b1 === 'number' && typeof rms_b2 === 'number' && typeof rms_b3 === 'number') {
    const evento = respaldo.observar(pinza.nombre, mensaje.ts, [rms_b1, rms_b2, rms_b3])
    if (evento) log.aviso('Respaldo RMS: bandas sobre su línea base sin detecciones del Coral (sin alerta)', evento)
  }
}

async function procesarDeteccion(datos: unknown) {
  const mensaje = deteccionEsquema.parse(datos)
  const pinza = await pinzaPorNombre(mensaje.pinza)
  if (!pinza) throw new Error(`Pinza desconocida: ${mensaje.pinza}`)
  respaldo.registrarDeteccion(mensaje.ts)

  // 'normal' no se guarda (deteccion_ia no lo admite); sí corta una racha de fuga.
  if (mensaje.clase === 'normal') {
    await evaluarDeteccion(pinza, mensaje.clase, mensaje.confianza, mensaje.ts, null)
    return
  }

  // deteccion_ia no tiene UNIQUE: un reintento de MQTT se reconoce por pinza, clase y fecha.
  const fecha = msADatetime(mensaje.ts)
  const repetida = await consultar('SELECT 1 FROM deteccion_ia WHERE id_pinza = ? AND fecha_hora = ? AND clase = ? LIMIT 1', [pinza.id_pinza, fecha, mensaje.clase])
  if (repetida.length) return

  const { insertId } = await ejecutar(
    'INSERT INTO deteccion_ia (id_pinza, clase, confianza, version_modelo, ruta_audio, fecha_hora) VALUES (?, ?, ?, ?, NULL, ?)',
    [pinza.id_pinza, mensaje.clase, mensaje.confianza, mensaje.version_modelo, fecha],
  )
  await evaluarDeteccion(pinza, mensaje.clase, mensaje.confianza, mensaje.ts, insertId)
}

async function procesarEstado(clave: string, carga: string, retenido: boolean) {
  const nuevo = estadoEsquema.parse(carga)
  estado.dispositivos[clave] = nuevo
  // Un mensaje retenido es de antes: no prueba que el dispositivo se haya reportado ahora.
  if (nuevo === 'online' && !retenido) {
    await tocarDispositivo(clave, true)
  } else {
    emitir('dispositivo', { clave, estado: nuevo })
  }
}

async function procesarAck(datos: unknown) {
  const mensaje = ackEsquema.parse(datos)
  await confirmarAccion(mensaje.id_accion, mensaje.ok, mensaje.ts)
  await tocarDispositivo('act01')
}

/** Punto de entrada de MQTT. Un mensaje inválido se descarta y se registra; nunca tumba el proceso. */
export async function procesarMensaje(topico: string, carga: Buffer, retenido = false) {
  try {
    const texto = carga.toString('utf8')
    const estadoTopico = /^hydrosense\/(\w+)\/estado$/.exec(topico)
    if (estadoTopico) return await procesarEstado(estadoTopico[1]!, texto, retenido)

    const datos: unknown = JSON.parse(texto)
    estado.ultimoMensaje[topico] = new Date().toISOString()
    switch (topico) {
      case 'hydrosense/acq01/vibracion':
        return await procesarVibracion(datos)
      case 'hydrosense/acq01/proceso':
        return await procesarProceso(datos)
      case 'hydrosense/act01/ack':
        return await procesarAck(datos)
      case 'hydrosense/pi/deteccion':
        return await procesarDeteccion(datos)
      default:
        log.aviso(`Tópico sin manejador: ${topico}`)
    }
  } catch (error) {
    log.aviso(`Mensaje descartado en ${topico}`, error)
  }
}
