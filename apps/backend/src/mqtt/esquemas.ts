import { z } from 'zod'

// Un ESP32 sin NTP manda fechas de 1970: se rechazan en lugar de guardarlas como reales.
const ts = z.number().int().min(Date.UTC(2020, 0, 1))
const calidad = z.enum(['ok', 'sin_senal', 'fuera_rango'])
const pinza = z.string().min(1).max(60)
const rms = z.number().finite().nullable().optional()

export const vibracionEsquema = z.object({
  ts,
  pinza,
  rms,
  b1: rms,
  b2: rms,
  b3: rms,
  n: z.number().int().min(0).max(65535),
  q: calidad,
})

export const procesoEsquema = z.object({
  ts,
  presion_kpa: z.number().finite().nullable().optional(),
  temp_c: z.number().finite().nullable().optional(),
  q_presion: calidad,
  q_temp: calidad,
})

export const ackEsquema = z.object({
  id_accion: z.number().int().positive(),
  ok: z.boolean(),
  ts,
})

export const deteccionEsquema = z.object({
  ts,
  pinza,
  clase: z.enum(['fuga', 'ruido_externo', 'normal']),
  confianza: z.number().min(0).max(1),
  version_modelo: z.string().min(1).max(20),
})

export const estadoEsquema = z.enum(['online', 'offline'])

export type Calidad = z.infer<typeof calidad>
export type Vibracion = z.infer<typeof vibracionEsquema>
export type Proceso = z.infer<typeof procesoEsquema>
export type Deteccion = z.infer<typeof deteccionEsquema>
