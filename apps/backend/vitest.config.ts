import path from 'node:path'
import { config as cargarEnv } from 'dotenv'
import { defineConfig } from 'vitest/config'

const raiz = path.resolve(import.meta.dirname, '../..')
const env = cargarEnv({ path: path.join(raiz, '.env'), quiet: true, processEnv: {} }).parsed ?? {}

// Las pruebas usan su propia BD (hydrosense_test) y nunca envían correo real.
export default defineConfig({
  test: {
    include: ['src/tests/**/*.test.ts'],
    globalSetup: ['src/tests/preparar-bd.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      DB_HOST: env.DB_HOST ?? '127.0.0.1',
      DB_PORT: env.DB_PORT ?? '3306',
      DB_USER: 'root',
      DB_PASSWORD: env.DB_ROOT_PASSWORD ?? '',
      DB_NAME: 'hydrosense_test',
      MQTT_URL: 'mqtt://127.0.0.1:1',
      JWT_SECRET: 'secreto-de-pruebas-de-mas-de-32-caracteres',
      SMTP_HOST: '',
      ACTUADORES_AUTO: 'true',
    },
  },
})
