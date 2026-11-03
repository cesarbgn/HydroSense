// Datos iniciales de HydroSense. Es idempotente: se puede correr las veces que haga falta.
//   pnpm seed
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcrypt'
import { config as cargarEnv } from 'dotenv'
import mysql from 'mysql2/promise'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
cargarEnv({ path: path.join(raiz, '.env'), quiet: true })

for (const variable of ['DB_HOST', 'DB_USER', 'DB_NAME', 'SEED_PASSWORD_GERENCIA', 'SEED_PASSWORD_MANTENIMIENTO']) {
  if (!process.env[variable]) throw new Error(`Falta ${variable} en .env`)
}

const conexion = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4_unicode_ci',
})
await conexion.query("SET SESSION time_zone = '-06:00'")

async function idDe(sql, parametros) {
  const [filas] = await conexion.query(sql, parametros)
  return filas[0]?.id ?? null
}

/** Inserta la fila o actualiza la que `sqlBuscar` encuentre, y devuelve su id. */
async function asegurar(tabla, columnaId, sqlBuscar, parametrosBuscar, datos) {
  const id = await idDe(sqlBuscar, parametrosBuscar)
  if (id !== null) {
    await conexion.query(`UPDATE ${tabla} SET ? WHERE ${columnaId} = ?`, [datos, id])
    return id
  }
  const [resultado] = await conexion.query(`INSERT INTO ${tabla} SET ?`, [datos])
  return resultado.insertId
}

try {
  // El esquema ya siembra los roles; se repite aquí para que el seed no dependa de eso.
  await conexion.query("INSERT INTO rol (id_rol, nombre) VALUES (1, 'gerencia'), (2, 'mantenimiento') ON DUPLICATE KEY UPDATE id_rol = id_rol")

  const usuarios = [
    { id_rol: 1, nombre: 'Carla Mendoza', correo: 'gerencia@hydrosense.local', password: process.env.SEED_PASSWORD_GERENCIA },
    { id_rol: 2, nombre: 'José Ramírez', correo: 'mantenimiento@hydrosense.local', password: process.env.SEED_PASSWORD_MANTENIMIENTO },
  ]
  for (const { password, ...usuario } of usuarios) {
    await asegurar('usuario', 'id_usuario', 'SELECT id_usuario AS id FROM usuario WHERE correo = ?', [usuario.correo], {
      ...usuario,
      password_hash: await bcrypt.hash(password, 12),
      activo: true,
    })
  }

  const idTuberia = await asegurar('tuberia', 'id_tuberia', 'SELECT id_tuberia AS id FROM tuberia WHERE nombre = ?', ['Lazo de 4 m'], {
    nombre: 'Lazo de 4 m',
    material: 'pvc',
    diametro_mm: 25.4,
    longitud_m: 4,
  })

  const idAdquisicion = await asegurar('dispositivo', 'id_dispositivo', 'SELECT id_dispositivo AS id FROM dispositivo WHERE mac = ?', ['A4:CF:12:8B:91:20'], {
    tipo: 'adquisicion',
    nombre: 'ESP32 Adquisición',
    mac: 'A4:CF:12:8B:91:20',
  })
  const idActuacion = await asegurar('dispositivo', 'id_dispositivo', 'SELECT id_dispositivo AS id FROM dispositivo WHERE mac = ?', ['24:6F:28:AA:04:9D'], {
    tipo: 'actuacion',
    nombre: 'ESP32 Actuación',
    mac: '24:6F:28:AA:04:9D',
  })

  for (const [nombre, posicion_m] of [['A', 1], ['B', 2]]) {
    await asegurar('pinza', 'id_pinza', 'SELECT id_pinza AS id FROM pinza WHERE id_tuberia = ? AND nombre = ?', [idTuberia, nombre], {
      id_tuberia: idTuberia,
      id_dispositivo: idAdquisicion,
      nombre,
      posicion_m,
      umbral_confianza: 0.8,
      umbral_presion_kpa: 100,
    })
  }

  for (const [tipo, nombre] of [['torreta', 'Torreta'], ['sirena', 'Sirena'], ['valvula', 'Válvula principal']]) {
    await asegurar('actuador', 'id_actuador', 'SELECT id_actuador AS id FROM actuador WHERE id_dispositivo = ? AND tipo = ?', [idActuacion, tipo], {
      id_dispositivo: idActuacion,
      tipo,
      nombre,
    })
  }

  const [conteos] = await conexion.query(
    `SELECT (SELECT COUNT(*) FROM rol) AS roles, (SELECT COUNT(*) FROM usuario) AS usuarios,
            (SELECT COUNT(*) FROM tuberia) AS tuberias, (SELECT COUNT(*) FROM dispositivo) AS dispositivos,
            (SELECT COUNT(*) FROM pinza) AS pinzas, (SELECT COUNT(*) FROM actuador) AS actuadores`,
  )
  console.log('Seed aplicado:', conteos[0])
} finally {
  await conexion.end()
}
