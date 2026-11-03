import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as cargarEnv } from 'dotenv'
import { z } from 'zod'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
cargarEnv({ path: path.join(raiz, '.env'), quiet: true })

const esquema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().min(1),
  MQTT_URL: z.string().min(1),
  PORT: z.coerce.number().int().default(3000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  CORS_ORIGIN: z.string().default('http://localhost:8443'),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  ALERT_EMAIL_FROM: z.string().default('alertas@hydrosense.local'),
  ACTUADORES_AUTO: z
    .string()
    .default('false')
    .transform((v) => v.toLowerCase() === 'true'),
  AUDIO_DIR: z.string().default(path.join(raiz, 'data', 'audio')),
})

const resultado = esquema.safeParse(process.env)
if (!resultado.success) {
  const detalle = resultado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
  throw new Error(`Configuración inválida en .env: ${detalle}`)
}

export const config = resultado.data
