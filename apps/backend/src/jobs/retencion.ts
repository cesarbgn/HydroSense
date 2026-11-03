import { rm } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config.js'
import { consultar, ejecutar } from '../db/pool.js'
import { log } from '../log.js'

const TAMANO_LOTE = 10_000
const CADA_MS = 60 * 60 * 1000

export const DIAS_LECTURA = 90
export const DIAS_VIBRACION = 7
export const DIAS_DETECCION = 30

/**
 * Primer id que se conserva. Se ignoran fechas futuras (reloj de un ESP32 sin sincronizar) para
 * que una fila así no detenga la limpieza. Sin filas recientes es null y no se borra nada.
 */
async function primerIdVigente(tabla: string, columna: string, dias: number): Promise<number | null> {
  const [fila] = await consultar<{ id: number }>(
    `SELECT ${columna} AS id FROM ${tabla}
      WHERE fecha_hora >= NOW() - INTERVAL ? DAY AND fecha_hora <= NOW()
      ORDER BY ${columna} LIMIT 1`,
    [dias],
  )
  return fila?.id ?? null
}

async function borrarEnLotes(sql: string, parametros: unknown[]): Promise<number> {
  let total = 0
  for (;;) {
    const { affectedRows } = await ejecutar(`${sql} LIMIT ${TAMANO_LOTE}`, parametros)
    total += affectedRows
    if (affectedRows === 0) return total
  }
}

async function limpiarTabla(tabla: string, columna: string, dias: number) {
  const corte = await primerIdVigente(tabla, columna, dias)
  if (corte === null) return 0
  return borrarEnLotes(`DELETE FROM ${tabla} WHERE ${columna} < ? AND fecha_hora < NOW() - INTERVAL ? DAY`, [corte, dias])
}

async function borrarAudios(rutas: string[]) {
  const raiz = path.resolve(config.AUDIO_DIR)
  for (const ruta of rutas) {
    const absoluta = path.resolve(raiz, ruta)
    // ruta_audio viene de la BD: solo se borran archivos dentro de la carpeta de audio.
    if (!absoluta.startsWith(raiz + path.sep)) {
      log.aviso('Audio fuera de AUDIO_DIR, no se borra', ruta)
      continue
    }
    await rm(absoluta, { force: true }).catch((error) => log.error(`No se pudo borrar ${ruta}`, error))
  }
}

async function limpiarDetecciones() {
  const corte = await primerIdVigente('deteccion_ia', 'id_deteccion', DIAS_DETECCION)
  if (corte === null) return 0
  const condicion = 'id_deteccion < ? AND fecha_hora < NOW() - INTERVAL ? DAY AND id_alerta IS NULL'
  const audios = await consultar<{ ruta_audio: string }>(`SELECT ruta_audio FROM deteccion_ia WHERE ${condicion} AND ruta_audio IS NOT NULL`, [corte, DIAS_DETECCION])
  const borradas = await borrarEnLotes(`DELETE FROM deteccion_ia WHERE ${condicion}`, [corte, DIAS_DETECCION])
  await borrarAudios(audios.map((a) => a.ruta_audio))
  return borradas
}

export async function ejecutarRetencion() {
  const resultado = {
    lectura: await limpiarTabla('lectura', 'id_lectura', DIAS_LECTURA),
    lectura_vibracion: await limpiarTabla('lectura_vibracion', 'id_vibracion', DIAS_VIBRACION),
    deteccion_ia: await limpiarDetecciones(),
  }
  log.info('Retención ejecutada', resultado)
  return resultado
}

export function iniciarRetencion() {
  const correr = () => void ejecutarRetencion().catch((error) => log.error('Falló la retención', error))
  correr()
  return setInterval(correr, CADA_MS)
}
