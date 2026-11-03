import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { config as cargarEnv } from 'dotenv'
import mysql from 'mysql2/promise'

const raiz = path.resolve(import.meta.dirname, '../../../..')
const BD = 'hydrosense_test'

/** Recrea la BD de pruebas con el esquema vigente, una sola vez por corrida de vitest. */
export default async function prepararBd() {
  const env = cargarEnv({ path: path.join(raiz, '.env'), quiet: true, processEnv: {} }).parsed ?? {}
  const sql = (await readFile(path.join(raiz, 'database/hydrosense.sql'), 'utf8')).replace(/^(CREATE DATABASE|USE) .*$/gm, '')
  const conexion = await mysql.createConnection({
    host: env.DB_HOST ?? '127.0.0.1',
    port: Number(env.DB_PORT ?? 3306),
    user: 'root',
    password: env.DB_ROOT_PASSWORD,
    multipleStatements: true,
  })
  await conexion.query(`DROP DATABASE IF EXISTS ${BD}; CREATE DATABASE ${BD} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; USE ${BD};`)
  await conexion.query(sql)
  await conexion.end()
}
