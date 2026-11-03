import { config } from '../config.js'
import { consultar, ejecutar } from '../db/pool.js'
import { log } from '../log.js'
import { emitir } from '../realtime.js'
import { datetimeAIso, msADatetime } from '../tiempo.js'
import { responderAlerta } from './actuadores.js'
import type { Pinza } from './catalogo.js'
import { notificarAlerta } from './notificaciones.js'
import { Sostenido } from './sostenido.js'

export const FUGA_SOSTENIDA_MS = 4_000
export const PRESION_SOSTENIDA_MS = 5_000
const HUECO_MAXIMO_MS = 3_000

export type Severidad = 'baja' | 'media' | 'alta'

export function severidadPorConfianza(confianza: number): Severidad {
  if (confianza >= 0.95) return 'alta'
  if (confianza >= 0.85) return 'media'
  return 'baja'
}

export function severidadPorPresion(valorKpa: number, umbralKpa: number): Severidad {
  const proporcion = umbralKpa > 0 ? valorKpa / umbralKpa : 1
  if (proporcion < 0.5) return 'alta'
  if (proporcion < 0.8) return 'media'
  return 'baja'
}

interface RachaFuga {
  sostenido: Sostenido
  detecciones: number[]
  confianzaMax: number
}

const rachas = new Map<number, RachaFuga>()
const presionBaja = new Map<number, Sostenido>()

const pendientes = new Set<Promise<void>>()

function enSegundoPlano(trabajo: Promise<void>, descripcion: string) {
  const tarea = trabajo.catch((error) => log.error(`No se pudo ${descripcion}`, error)).finally(() => pendientes.delete(tarea))
  pendientes.add(tarea)
}

/** Espera correos y comandos en curso, para no cortarlos al cerrar el proceso. */
export async function esperarPendientes() {
  await Promise.all(pendientes)
}

/** Olvida el seguimiento en memoria. Solo para pruebas. */
export function reiniciarSeguimiento() {
  rachas.clear()
  presionBaja.clear()
}

async function alertaAbierta(idTuberia: number, tipo: string): Promise<number | null> {
  const [fila] = await consultar<{ id_alerta: number }>(
    "SELECT id_alerta FROM alerta WHERE id_tuberia = ? AND tipo = ? AND estado IN ('activa', 'en_atencion') ORDER BY id_alerta DESC LIMIT 1",
    [idTuberia, tipo],
  )
  return fila?.id_alerta ?? null
}

async function crearAlerta(datos: { pinza: Pinza; tipo: 'fuga' | 'presion_baja'; severidad: Severidad; confianza: number | null; ts: number; detalle: string }) {
  const detectadaEn = msADatetime(datos.ts)
  const { insertId: idAlerta } = await ejecutar(
    `INSERT INTO alerta (id_tuberia, id_pinza_a, tipo, severidad, estado, confianza, detectada_en)
     VALUES (?, ?, ?, ?, 'activa', ?, ?)`,
    [datos.pinza.id_tuberia, datos.pinza.id_pinza, datos.tipo, datos.severidad, datos.confianza, detectadaEn],
  )
  log.aviso(`Alerta ${idAlerta} creada: ${datos.tipo} (${datos.severidad})`, datos.detalle)
  emitir('alerta', {
    id_alerta: idAlerta,
    id_tuberia: datos.pinza.id_tuberia,
    tipo: datos.tipo,
    severidad: datos.severidad,
    estado: 'activa',
    pinza: datos.pinza.nombre,
    confianza: datos.confianza,
    detectada_en: datetimeAIso(detectadaEn),
  })

  // Correo y actuadores no detienen la ingesta: la alerta ya quedó guardada.
  enSegundoPlano(notificarAlerta({ id_alerta: idAlerta, tipo: datos.tipo, severidad: datos.severidad, detalle: datos.detalle }), `notificar la alerta ${idAlerta}`)
  if (config.ACTUADORES_AUTO) {
    enSegundoPlano(responderAlerta(idAlerta), `responder a la alerta ${idAlerta}`)
  }
  return idAlerta
}

async function vincular(detecciones: number[], idAlerta: number) {
  if (detecciones.length) {
    await ejecutar('UPDATE deteccion_ia SET id_alerta = ? WHERE id_deteccion IN (?)', [idAlerta, detecciones])
  }
}

/** Evalúa una detección ya guardada. `idDeteccion` es null cuando la clase no se guarda (normal). */
export async function evaluarDeteccion(pinza: Pinza, clase: string, confianza: number, ts: number, idDeteccion: number | null) {
  const racha = rachas.get(pinza.id_pinza) ?? { sostenido: new Sostenido(FUGA_SOSTENIDA_MS, HUECO_MAXIMO_MS), detecciones: [], confianzaMax: 0 }
  rachas.set(pinza.id_pinza, racha)

  const cumple = clase === 'fuga' && confianza >= pinza.umbral_confianza
  if (!cumple) {
    racha.sostenido.reiniciar()
    racha.detecciones = []
    racha.confianzaMax = 0
    return
  }

  // Una detección nueva de una fuga ya alertada se suma como evidencia, sin crear otra alerta.
  const abierta = await alertaAbierta(pinza.id_tuberia, 'fuga')
  if (abierta !== null) {
    if (idDeteccion !== null) await vincular([idDeteccion], abierta)
    return
  }

  const sostenido = racha.sostenido.observar(true, ts)
  // Racha nueva (la primera, o tras un hueco): lo acumulado antes ya no cuenta como evidencia.
  if (racha.sostenido.inicioMs === ts) {
    racha.detecciones = []
    racha.confianzaMax = 0
  }
  if (idDeteccion !== null) racha.detecciones.push(idDeteccion)
  racha.confianzaMax = Math.max(racha.confianzaMax, confianza)
  if (!sostenido) return

  const idAlerta = await crearAlerta({
    pinza,
    tipo: 'fuga',
    severidad: severidadPorConfianza(racha.confianzaMax),
    confianza: racha.confianzaMax,
    ts,
    detalle: `Posible fuga en pinza ${pinza.nombre} con confianza ${Math.round(racha.confianzaMax * 100)}%.`,
  })
  await vincular(racha.detecciones, idAlerta)
  racha.sostenido.reiniciar()
  racha.detecciones = []
  racha.confianzaMax = 0
}

/** `valorKpa` es null cuando el sensor no da un dato válido: sin dato no se puede afirmar que la presión bajó. */
export async function evaluarPresion(pinza: Pinza, valorKpa: number | null, ts: number) {
  const seguimiento = presionBaja.get(pinza.id_pinza) ?? new Sostenido(PRESION_SOSTENIDA_MS, HUECO_MAXIMO_MS)
  presionBaja.set(pinza.id_pinza, seguimiento)

  const sostenido = seguimiento.observar(valorKpa !== null && valorKpa < pinza.umbral_presion_kpa, ts)
  if (!sostenido || valorKpa === null) return
  seguimiento.reiniciar()
  if ((await alertaAbierta(pinza.id_tuberia, 'presion_baja')) !== null) return

  await crearAlerta({
    pinza,
    tipo: 'presion_baja',
    severidad: severidadPorPresion(valorKpa, pinza.umbral_presion_kpa),
    confianza: null,
    ts,
    detalle: `Presión de ${valorKpa} kPa bajo el umbral de ${pinza.umbral_presion_kpa} kPa.`,
  })
}
