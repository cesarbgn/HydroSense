import mysql, { type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise'
import { config } from '../config.js'

const SQL_MODE = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'

export const pool = mysql.createPool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  charset: 'utf8mb4_unicode_ci',
  timezone: '-06:00',
  // Las fechas viajan como texto: DATETIME no guarda zona y así nadie las reinterpreta.
  dateStrings: true,
  decimalNumbers: true,
  supportBigNumbers: true,
  connectionLimit: 8,
  // Sin FOUND_ROWS, ON DUPLICATE KEY sin cambios devuelve 0 filas afectadas: así se detectan duplicados.
  flags: ['-FOUND_ROWS'],
})

pool.pool.on('connection', (conexion) => {
  conexion.query(`SET SESSION sql_mode = '${SQL_MODE}', time_zone = '-06:00'`)
})

type Ejecutor = Pick<PoolConnection, 'query'>

export async function consultar<T>(sql: string, parametros: unknown[] = [], ejecutor: Ejecutor = pool): Promise<T[]> {
  const [filas] = await ejecutor.query<RowDataPacket[]>(sql, parametros)
  return filas as T[]
}

export async function ejecutar(sql: string, parametros: unknown[] = [], ejecutor: Ejecutor = pool): Promise<ResultSetHeader> {
  const [resultado] = await ejecutor.query<ResultSetHeader>(sql, parametros)
  return resultado
}

export async function enTransaccion<T>(trabajo: (conexion: PoolConnection) => Promise<T>): Promise<T> {
  const conexion = await pool.getConnection()
  try {
    await conexion.beginTransaction()
    const resultado = await trabajo(conexion)
    await conexion.commit()
    return resultado
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}
