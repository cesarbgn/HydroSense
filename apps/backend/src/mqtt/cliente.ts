import mqtt, { type MqttClient } from 'mqtt'
import { config } from '../config.js'
import { log } from '../log.js'
import { estado } from '../services/estado.js'
import { emitir } from '../realtime.js'

export const TOPICOS = [
  'hydrosense/acq01/vibracion',
  'hydrosense/acq01/proceso',
  'hydrosense/+/estado',
  'hydrosense/act01/ack',
  'hydrosense/pi/deteccion',
]

let cliente: MqttClient | null = null
let temporizadorTiempo: NodeJS.Timeout | null = null

function publicarTiempo() {
  if (!cliente || !estado.mqttConectado) return
  cliente.publish('hydrosense/tiempo', String(Date.now()), { qos: 0, retain: true })
}

export function iniciarMqtt(alRecibir: (topico: string, carga: Buffer, retenido: boolean) => Promise<void>) {
  cliente = mqtt.connect(config.MQTT_URL, { reconnectPeriod: 2000 })

  cliente.on('connect', () => {
    estado.mqttConectado = true
    log.info('MQTT conectado', config.MQTT_URL)
    cliente?.subscribe(TOPICOS, { qos: 1 }, (error) => {
      if (error) log.error('No se pudo suscribir a los tópicos', error)
    })
    publicarTiempo()
    if (!temporizadorTiempo) temporizadorTiempo = setInterval(publicarTiempo, 15_000)
    emitir('dispositivo', { mqtt_conectado: true })
  })
  cliente.on('close', () => {
    if (estado.mqttConectado) log.aviso('MQTT desconectado')
    estado.mqttConectado = false
    emitir('dispositivo', { mqtt_conectado: false })
  })
  cliente.on('error', (error) => log.error('Error de MQTT', error))

  // Un solo mensaje a la vez: las reglas de alerta dependen del orden de llegada.
  let cola: Promise<void> = Promise.resolve()
  cliente.on('message', (topico, carga, paquete) => {
    if (topico.endsWith('/estado') && carga.toString('utf8').trim() === 'online') publicarTiempo()
    cola = cola.then(() => alRecibir(topico, carga, paquete.retain)).catch((error) => log.error(`Error procesando ${topico}`, error))
  })
}

export async function publicar(topico: string, carga: object) {
  if (!cliente || !estado.mqttConectado) throw new Error('MQTT no está conectado')
  await cliente.publishAsync(topico, JSON.stringify(carga), { qos: 1 })
}

export async function cerrarMqtt() {
  if (temporizadorTiempo) {
    clearInterval(temporizadorTiempo)
    temporizadorTiempo = null
  }
  await cliente?.endAsync()
  cliente = null
}
