import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { config } from './config.js'
import { usuarioDesdeToken } from './services/auth.js'

export type Evento = 'lectura' | 'vibracion' | 'alerta' | 'dispositivo' | 'actuador'

let io: Server | null = null

export function iniciarRealtime(servidor: HttpServer) {
  io = new Server(servidor, { cors: { origin: config.CORS_ORIGIN.split(',') } })
  io.use(async (socket, siguiente) => {
    const usuario = await usuarioDesdeToken(String(socket.handshake.auth.token ?? '')).catch(() => null)
    siguiente(usuario ? undefined : new Error('No autorizado'))
  })
  return io
}

export function emitir(evento: Evento, datos: unknown) {
  io?.emit(evento, datos)
}
