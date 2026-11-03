import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { ZodError } from 'zod'
import { log } from '../log.js'
import { ErrorComando } from '../services/actuadores.js'
import { usuarioDesdeToken, type Rol, type Usuario } from '../services/auth.js'

export type RequestAutenticado = Request & { usuario: Usuario }

export const requiereSesion: RequestHandler = async (req, res, siguiente) => {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ')
  const usuario = esquema === 'Bearer' && token ? await usuarioDesdeToken(token) : null
  if (!usuario) {
    res.status(401).json({ error: 'Sesión inválida o expirada' })
    return
  }
  ;(req as unknown as RequestAutenticado).usuario = usuario
  siguiente()
}

export function requiereRol(...roles: Rol[]): RequestHandler {
  return (req, res, siguiente) => {
    if (!roles.includes((req as unknown as RequestAutenticado).usuario.rol)) {
      res.status(403).json({ error: 'Tu rol no tiene permiso para esta acción' })
      return
    }
    siguiente()
  }
}

export function manejarErrores(error: unknown, _req: Request, res: Response, _siguiente: NextFunction) {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Datos inválidos', detalles: error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })) })
    return
  }
  if (error instanceof ErrorComando) {
    res.status(error.estadoHttp).json({ error: error.message })
    return
  }
  if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
    res.status(409).json({ error: 'Ya existe un registro con esos datos' })
    return
  }
  log.error('Error en la API', error)
  res.status(500).json({ error: 'Error interno' })
}
