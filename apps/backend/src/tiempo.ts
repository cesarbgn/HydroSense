const DESPLAZAMIENTO_MS = 6 * 60 * 60 * 1000

/** ms epoch UTC -> DATETIME(3) en hora local de México (-06:00, sin horario de verano). */
export function msADatetime(ms: number): string {
  return new Date(ms - DESPLAZAMIENTO_MS).toISOString().replace('T', ' ').replace('Z', '')
}

/** DATETIME(3) de la BD -> ISO 8601 con desplazamiento, para la API y los eventos. */
export function datetimeAIso(valor: string): string
export function datetimeAIso(valor: string | null): string | null
export function datetimeAIso(valor: string | null): string | null {
  if (valor === null) return null
  return `${valor.replace(' ', 'T')}-06:00`
}

/** Fecha de un parámetro de consulta (ISO con zona) -> DATETIME(3) local, o null si no es válida. */
export function isoADatetime(valor: string): string | null {
  const ms = Date.parse(valor)
  return Number.isNaN(ms) ? null : msADatetime(ms)
}
