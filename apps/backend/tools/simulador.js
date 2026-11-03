// Simula los dos ESP32 y el servicio de IA, según docs/contrato_mqtt.md.
//   pnpm simulador [opciones]
// Opciones:
//   --fuga                 sube la banda b2 y publica detecciones clase fuga
//   --fuga-tras=N          inicia el modo fuga a los N segundos
//   --sin-sensor-presion   presión con q_presion "sin_senal" y valor null
//   --sin-sensor-temp      temperatura -127 con q_temp "ok" (como un DS18B20 desconectado)
//   --presion-baja         presión por debajo del umbral por defecto (100 kPa)
//   --duplicados           repite cada mensaje con el mismo ts (como un reintento de MQTT)
//   --sin-coral            no publica detecciones (para probar el respaldo RMS)
//   --segundos=N           termina después de N segundos
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as cargarEnv } from 'dotenv'
import mqtt from 'mqtt'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
cargarEnv({ path: path.join(raiz, '.env'), quiet: true })

const argumentos = process.argv.slice(2)
const bandera = (nombre) => argumentos.includes(`--${nombre}`)
const valor = (nombre) => {
  const arg = argumentos.find((a) => a.startsWith(`--${nombre}=`))
  return arg ? Number(arg.split('=')[1]) : null
}

const fugaTras = bandera('fuga') ? 0 : valor('fuga-tras')
const segundos = valor('segundos')
const duplicados = bandera('duplicados')
const inicio = Date.now()

const azar = (centro, amplitud) => centro + (Math.random() * 2 - 1) * amplitud
const redondear = (n) => Math.round(n * 1000) / 1000
const enFuga = () => fugaTras !== null && (Date.now() - inicio) / 1000 >= fugaTras

// Un cliente por ESP32: cada uno necesita su propio LWT, como en el hardware real.
function conectarEsp(clave) {
  return mqtt.connect(process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883', {
    clientId: `simulador-${clave}-${process.pid}`,
    will: { topic: `hydrosense/${clave}/estado`, payload: 'offline', retain: true, qos: 1 },
  })
}

const acq = conectarEsp('acq01')
const act = conectarEsp('act01')

acq.on('connect', () => acq.publish('hydrosense/acq01/estado', 'online', { retain: true, qos: 1 }))
act.on('connect', () => {
  act.publish('hydrosense/act01/estado', 'online', { retain: true, qos: 1 })
  act.subscribe('hydrosense/act01/cmd', { qos: 1 })
})

act.on('message', (_topico, carga) => {
  const orden = JSON.parse(carga.toString())
  console.log(`[act01] ${orden.actuador} -> ${orden.comando} (acción ${orden.id_accion})`)
  setTimeout(() => act.publish('hydrosense/act01/ack', JSON.stringify({ id_accion: orden.id_accion, ok: true, ts: Date.now() }), { qos: 1 }), 150)
})

function enviar(cliente, topico, datos) {
  const texto = JSON.stringify(datos)
  cliente.publish(topico, texto, { qos: 1 })
  if (duplicados) cliente.publish(topico, texto, { qos: 1 })
}

let presion = 180

function publicarTodo() {
  const ts = Date.now()
  const fuga = enFuga()

  presion = Math.min(250, Math.max(110, presion + azar(0, 3)))
  const sinPresion = bandera('sin-sensor-presion')
  const presionKpa = bandera('presion-baja') ? azar(70, 3) : presion - (fuga ? 25 : 0)
  enviar(acq, 'hydrosense/acq01/proceso', {
    ts,
    presion_kpa: sinPresion ? null : redondear(presionKpa),
    temp_c: bandera('sin-sensor-temp') ? -127 : redondear(azar(25, 0.3)),
    q_presion: sinPresion ? 'sin_senal' : 'ok',
    q_temp: 'ok',
  })

  for (const pinza of ['A', 'B']) {
    const b1 = azar(4, 0.6)
    const b2 = fuga && pinza === 'B' ? azar(38, 4) : azar(5, 0.7)
    const b3 = azar(3, 0.5)
    enviar(acq, 'hydrosense/acq01/vibracion', {
      ts,
      pinza,
      rms: redondear(Math.hypot(b1, b2, b3)),
      b1: redondear(b1),
      b2: redondear(b2),
      b3: redondear(b3),
      n: 4000,
      q: 'ok',
    })

    if (!bandera('sin-coral')) {
      const esFuga = fuga && pinza === 'B'
      enviar(acq, 'hydrosense/pi/deteccion', {
        ts,
        pinza,
        clase: esFuga ? 'fuga' : 'normal',
        confianza: redondear(esFuga ? azar(0.93, 0.03) : azar(0.9, 0.05)),
        version_modelo: 'v0.1',
      })
    }
  }

  if (segundos !== null && (ts - inicio) / 1000 >= segundos) terminar()
}

function terminar() {
  clearInterval(temporizador)
  acq.publish('hydrosense/acq01/estado', 'offline', { retain: true, qos: 1 }, () => acq.end())
  act.publish('hydrosense/act01/estado', 'offline', { retain: true, qos: 1 }, () => act.end())
}

const temporizador = setInterval(publicarTodo, 1000)
process.on('SIGINT', terminar)
console.log(`Simulador iniciado (${argumentos.join(' ') || 'modo normal'}). Ctrl+C para terminar.`)
