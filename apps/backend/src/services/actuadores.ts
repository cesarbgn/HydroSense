import { consultar, ejecutar } from '../db/pool.js'
import { log } from '../log.js'
import { publicar } from '../mqtt/cliente.js'
import { emitir } from '../realtime.js'
import { datetimeAIso, msADatetime } from '../tiempo.js'
import { estado } from './estado.js'

export type TipoActuador = 'torreta' | 'sirena' | 'valvula'

export const COMANDOS: Record<TipoActuador, string[]> = {
  torreta: ['verde', 'amarillo', 'rojo'],
  sirena: ['encender', 'apagar'],
  valvula: ['abrir', 'cerrar'],
}

export class ErrorComando extends Error {
  constructor(
    public readonly estadoHttp: number,
    mensaje: string,
  ) {
    super(mensaje)
  }
}

interface OrdenActuador {
  id_actuador: number
  comando: string
  origen: 'automatico' | 'manual'
  id_alerta?: number | null
  id_usuario?: number | null
}

/** Registra la orden y la publica. confirmada_en se llena después, cuando llega el ack. */
export async function enviarComando(orden: OrdenActuador) {
  const [actuador] = await consultar<{ tipo: TipoActuador; activo: number }>('SELECT tipo, activo FROM actuador WHERE id_actuador = ?', [orden.id_actuador])
  if (!actuador) throw new ErrorComando(404, 'Actuador no encontrado')
  if (!actuador.activo) throw new ErrorComando(409, 'El actuador está dado de baja')
  if (!COMANDOS[actuador.tipo].includes(orden.comando)) {
    throw new ErrorComando(400, `El comando ${orden.comando} no aplica a ${actuador.tipo}`)
  }
  if (!estado.mqttConectado) throw new ErrorComando(503, 'MQTT no está conectado')

  const { insertId: id_accion } = await ejecutar(
    'INSERT INTO accion_actuador (id_actuador, id_alerta, id_usuario, origen, comando) VALUES (?, ?, ?, ?, ?)',
    [orden.id_actuador, orden.id_alerta ?? null, orden.id_usuario ?? null, orden.origen, orden.comando],
  )
  await publicar('hydrosense/act01/cmd', { actuador: actuador.tipo, comando: orden.comando, id_accion })
  emitir('actuador', { id_accion, id_actuador: orden.id_actuador, tipo: actuador.tipo, comando: orden.comando, origen: orden.origen, confirmada_en: null })
  return { id_accion, tipo: actuador.tipo, comando: orden.comando }
}

export async function confirmarAccion(idAccion: number, ok: boolean, ts: number) {
  if (!ok) {
    log.aviso(`El ESP32 reportó que no ejecutó la acción ${idAccion}`)
    emitir('actuador', { id_accion: idAccion, ok: false })
    return
  }
  const fecha = msADatetime(ts)
  const { affectedRows } = await ejecutar('UPDATE accion_actuador SET confirmada_en = ? WHERE id_accion = ? AND confirmada_en IS NULL', [fecha, idAccion])
  if (affectedRows === 0) return
  const [fila] = await consultar<{ id_actuador: number; tipo: string; comando: string; origen: string }>(
    `SELECT ac.id_actuador, a.tipo, ac.comando, ac.origen
       FROM accion_actuador ac JOIN actuador a ON a.id_actuador = ac.id_actuador
      WHERE ac.id_accion = ?`,
    [idAccion],
  )
  emitir('actuador', { id_accion: idAccion, ok: true, ...fila, confirmada_en: datetimeAIso(fecha) })
}

/** Señalización automática al crear una alerta. Un fallo aquí no debe impedir el resto del flujo. */
export async function responderAlerta(idAlerta: number) {
  const actuadores = await consultar<{ id_actuador: number; tipo: TipoActuador }>(
    "SELECT id_actuador, tipo FROM actuador WHERE activo = TRUE AND tipo IN ('torreta', 'sirena')",
  )
  for (const { id_actuador, tipo } of actuadores) {
    const comando = tipo === 'torreta' ? 'rojo' : 'encender'
    await enviarComando({ id_actuador, comando, origen: 'automatico', id_alerta: idAlerta }).catch((error) =>
      log.error(`No se pudo enviar ${comando} a ${tipo}`, error),
    )
  }
}
