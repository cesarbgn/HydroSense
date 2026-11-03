import cors from 'cors'
import express from 'express'
import { config } from './config.js'
import { api } from './routes/api.js'
import { manejarErrores } from './routes/middleware.js'

export function crearApp() {
  const app = express()
  app.use(cors({ origin: config.CORS_ORIGIN.split(',') }))
  app.use(express.json({ limit: '100kb' }))
  app.use('/api', api)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' })
  })
  app.use(manejarErrores)
  return app
}
