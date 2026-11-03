import { Sostenido } from './sostenido.js'

const SIN_DETECCION_MS = 30_000
const VENTANA_MUESTRAS = 120
const MIN_MUESTRAS_BASE = 30
const FACTOR_SOBRE_BASE = 2
const ELEVADO_SOSTENIDO_MS = 10_000
const HUECO_MAXIMO_MS = 3_000

function mediana(valores: number[]): number {
  const orden = [...valores].sort((a, b) => a - b)
  const mitad = Math.floor(orden.length / 2)
  return orden.length % 2 ? orden[mitad]! : (orden[mitad - 1]! + orden[mitad]!) / 2
}

export type Bandas = [number, number, number]

export interface EventoRespaldo {
  pinza: string
  ts: number
  bandas: Bandas
  lineaBase: Bandas
}

/**
 * Respaldo del Coral: si llevan 30 s sin llegar detecciones y alguna banda RMS se mantiene sobre
 * su línea base (mediana móvil), avisa una sola vez por episodio. No crea alertas.
 */
export class RespaldoRms {
  private historial = new Map<string, number[][]>()
  private elevado = new Map<string, Sostenido>()
  private avisado = new Set<string>()
  private ultimaDeteccion: number | null = null

  registrarDeteccion(ts: number) {
    this.ultimaDeteccion = Math.max(this.ultimaDeteccion ?? 0, ts)
  }

  observar(pinza: string, ts: number, bandas: Bandas): EventoRespaldo | null {
    const historial = this.historial.get(pinza) ?? [[], [], []]
    this.historial.set(pinza, historial)
    const seguimiento = this.elevado.get(pinza) ?? new Sostenido(ELEVADO_SOSTENIDO_MS, HUECO_MAXIMO_MS)
    this.elevado.set(pinza, seguimiento)

    const listo = historial[0]!.length >= MIN_MUESTRAS_BASE
    const lineaBase = historial.map((serie) => (serie.length ? mediana(serie) : 0)) as Bandas
    const sobreBase = listo && bandas.some((valor, i) => lineaBase[i]! > 0 && valor > lineaBase[i]! * FACTOR_SOBRE_BASE)

    // La línea base no aprende de un episodio elevado; si no, lo terminaría normalizando.
    if (!sobreBase) {
      bandas.forEach((valor, i) => {
        const serie = historial[i]!
        serie.push(valor)
        if (serie.length > VENTANA_MUESTRAS) serie.shift()
      })
      this.avisado.delete(pinza)
    }

    const sostenido = seguimiento.observar(sobreBase, ts)
    const coralCallado = this.ultimaDeteccion === null || ts - this.ultimaDeteccion >= SIN_DETECCION_MS
    if (!sostenido || !coralCallado || this.avisado.has(pinza)) return null

    this.avisado.add(pinza)
    return { pinza, ts, bandas, lineaBase }
  }
}
