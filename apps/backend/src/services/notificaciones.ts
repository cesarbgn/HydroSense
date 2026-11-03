import nodemailer from 'nodemailer'
import { config } from '../config.js'
import { consultar, ejecutar } from '../db/pool.js'
import { log } from '../log.js'
import { emitir } from '../realtime.js'

const transporte = () =>
  nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  })

export interface AvisoAlerta {
  id_alerta: number
  tipo: string
  severidad: string
  detalle: string
}

/** Avisa a todos los usuarios activos y deja un registro por envío en `notificacion`. */
export async function notificarAlerta(aviso: AvisoAlerta) {
  const destinatarios = await consultar<{ id_usuario: number; correo: string }>('SELECT id_usuario, correo FROM usuario WHERE activo = TRUE')
  const envio = config.SMTP_HOST ? transporte() : null
  const codigo = `ALT-${String(aviso.id_alerta).padStart(2, '0')}`

  for (const { id_usuario, correo } of destinatarios) {
    let error: string | null = envio ? null : 'SMTP no configurado'
    if (envio) {
      try {
        await envio.sendMail({
          from: config.ALERT_EMAIL_FROM,
          to: correo,
          subject: `[HydroSense] ${codigo}: ${aviso.tipo} (severidad ${aviso.severidad})`,
          text: `${aviso.detalle}\n\nRevisa la alerta ${codigo} en HydroSense.`,
        })
      } catch (causa) {
        error = (causa as Error).message.slice(0, 255)
        log.error(`No se pudo enviar el correo de ${codigo}`, causa)
      }
    }
    await ejecutar('INSERT INTO notificacion (id_alerta, id_usuario, estado, detalle_error) VALUES (?, ?, ?, ?)', [
      aviso.id_alerta,
      id_usuario,
      error ? 'fallida' : 'enviada',
      error,
    ])
  }
  emitir('alerta', { id_alerta: aviso.id_alerta })
}
