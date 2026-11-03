import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { consultar } from '../db/pool.js'

export type Rol = 'gerencia' | 'mantenimiento'

export interface Usuario {
  id_usuario: number
  nombre: string
  correo: string
  rol: Rol
}

const USUARIO_SQL = `
  SELECT u.id_usuario, u.nombre, u.correo, r.nombre AS rol, u.password_hash
    FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
   WHERE u.activo = TRUE AND `

// Se compara también cuando el correo no existe, para no revelar por el tiempo de respuesta si está registrado.
const HASH_FICTICIO = bcrypt.hashSync('sin-usuario', 10)

export async function iniciarSesion(correo: string, password: string) {
  const [fila] = await consultar<Usuario & { password_hash: string }>(`${USUARIO_SQL} u.correo = ?`, [correo])
  const coincide = await bcrypt.compare(password, fila?.password_hash ?? HASH_FICTICIO)
  if (!fila || !coincide) return null
  const { password_hash: _omitido, ...usuario } = fila
  const token = jwt.sign({ rol: usuario.rol }, config.JWT_SECRET, { subject: String(usuario.id_usuario), expiresIn: '8h', algorithm: 'HS256' })
  return { token, usuario }
}

/** Valida el token y vuelve a leer al usuario: una baja o un cambio de rol surten efecto de inmediato. */
export async function usuarioDesdeToken(token: string): Promise<Usuario | null> {
  let idUsuario: number
  try {
    const carga = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] })
    idUsuario = Number(typeof carga === 'string' ? NaN : carga.sub)
  } catch {
    return null
  }
  if (!Number.isInteger(idUsuario)) return null
  const [fila] = await consultar<Usuario & { password_hash: string }>(`${USUARIO_SQL} u.id_usuario = ?`, [idUsuario])
  if (!fila) return null
  const { password_hash: _omitido, ...usuario } = fila
  return usuario
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12)
