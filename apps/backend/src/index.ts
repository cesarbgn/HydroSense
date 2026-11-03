import { createServer } from 'node:http'
import { crearApp } from './app.js'
import { config } from './config.js'
import { pool } from './db/pool.js'
import { iniciarRetencion } from './jobs/retencion.js'
import { log } from './log.js'
import { esperarPendientes } from './services/alertas.js'
import { cerrarMqtt, iniciarMqtt } from './mqtt/cliente.js'
import { iniciarRealtime } from './realtime.js'
import { procesarMensaje } from './services/ingesta.js'

const servidor = createServer(crearApp())
const io = iniciarRealtime(servidor)
iniciarMqtt(procesarMensaje)
const retencion = iniciarRetencion()

servidor.listen(config.PORT, () => log.info(`API escuchando en el puerto ${config.PORT}`))

async function cerrar() {
  clearInterval(retencion)
  await esperarPendientes()
  await cerrarMqtt()
  await io.close()
  await pool.end()
  process.exit(0)
}
process.on('SIGINT', cerrar)
process.on('SIGTERM', cerrar)
