import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { consultar, ejecutar, pool } from '../db/pool.js'
import { ejecutarRetencion } from '../jobs/retencion.js'
import { publicar } from '../mqtt/cliente.js'
import { confirmarAccion } from '../services/actuadores.js'
import { estado } from '../services/estado.js'
import { contar, enviar, esperarHasta, IDS, reiniciarBd, TOPICO } from './ayudas.js'

vi.mock('../mqtt/cliente.js', () => ({ publicar: vi.fn(async () => undefined) }))

const T0 = Date.UTC(2026, 10, 3, 5, 59, 58, 0) // 23:59:58 del 2 de noviembre en México

const proceso = (ts: number, extra = {}) => ({ ts, presion_kpa: 180.5, temp_c: 25.1, q_presion: 'ok', q_temp: 'ok', ...extra })
const vibracion = (ts: number, extra = {}) => ({ ts, pinza: 'A', rms: 7.1, b1: 4, b2: 5, b3: 3, n: 4000, q: 'ok', ...extra })
const deteccion = (ts: number, extra = {}) => ({ ts, pinza: 'B', clase: 'fuga', confianza: 0.93, version_modelo: 'v0.1', ...extra })

beforeEach(async () => {
  vi.mocked(publicar).mockClear()
  estado.mqttConectado = true
  await reiniciarBd()
})
afterAll(async () => {
  await pool.end()
})

describe('sesión de BD', () => {
  it('usa -06:00 y modo estricto en cada conexión', async () => {
    const [fila] = await consultar<{ tz: string; modo: string }>('SELECT @@session.time_zone AS tz, @@session.sql_mode AS modo')
    expect(fila!.tz).toBe('-06:00')
    expect(fila!.modo).toContain('STRICT_TRANS_TABLES')
  })
})

describe('ingesta de proceso', () => {
  it('guarda presión y temperatura en la pinza A, con la fecha local aunque cruce medianoche', async () => {
    await enviar(TOPICO.proceso, proceso(T0))
    await enviar(TOPICO.proceso, proceso(T0 + 2000))
    const filas = await consultar<{ tipo: string; valor: number; calidad: string; fecha_hora: string; id_pinza: number }>(
      "SELECT tipo, valor, calidad, fecha_hora, id_pinza FROM lectura WHERE tipo = 'presion' ORDER BY fecha_hora",
    )
    expect(filas.map((f) => f.fecha_hora)).toEqual(['2026-11-02 23:59:58.000', '2026-11-03 00:00:00.000'])
    expect(filas[0]).toMatchObject({ valor: 180.5, calidad: 'ok', id_pinza: IDS.pinzaA })
    expect(await contar('lectura', "tipo = 'temperatura'")).toBe(2)
  })

  it('un duplicado de MQTT no crea otra fila', async () => {
    await enviar(TOPICO.proceso, proceso(T0))
    await enviar(TOPICO.proceso, proceso(T0, { presion_kpa: 999 }))
    expect(await contar('lectura')).toBe(2)
    const [fila] = await consultar<{ valor: number }>("SELECT valor FROM lectura WHERE tipo = 'presion'")
    expect(fila!.valor).toBe(180.5)
  })

  it('sin sensor de presión guarda NULL con su calidad', async () => {
    await enviar(TOPICO.proceso, proceso(T0, { presion_kpa: null, q_presion: 'sin_senal' }))
    const [fila] = await consultar<{ valor: number | null; calidad: string }>("SELECT valor, calidad FROM lectura WHERE tipo = 'presion'")
    expect(fila).toEqual({ valor: null, calidad: 'sin_senal' })
  })

  it('-127 °C se guarda como sin_senal aunque el firmware no lo marque', async () => {
    await enviar(TOPICO.proceso, proceso(T0, { temp_c: -127, q_temp: 'ok' }))
    const [fila] = await consultar<{ valor: number | null; calidad: string }>("SELECT valor, calidad FROM lectura WHERE tipo = 'temperatura'")
    expect(fila).toEqual({ valor: null, calidad: 'sin_senal' })
  })

  it('actualiza la última conexión del dispositivo de adquisición', async () => {
    await enviar(TOPICO.proceso, proceso(T0))
    expect(await contar('dispositivo', "tipo = 'adquisicion' AND ultima_conexion IS NOT NULL")).toBe(1)
    expect(await contar('dispositivo', "tipo = 'actuacion' AND ultima_conexion IS NOT NULL")).toBe(0)
  })
})

describe('ingesta de vibración', () => {
  it('guarda las bandas por pinza y no duplica', async () => {
    await enviar(TOPICO.vibracion, vibracion(T0))
    await enviar(TOPICO.vibracion, vibracion(T0))
    await enviar(TOPICO.vibracion, vibracion(T0, { pinza: 'B' }))
    expect(await contar('lectura_vibracion')).toBe(2)
    const [fila] = await consultar<{ rms_b2: number; n_muestras: number }>('SELECT rms_b2, n_muestras FROM lectura_vibracion WHERE id_pinza = ?', [IDS.pinzaA])
    expect(fila).toEqual({ rms_b2: 5, n_muestras: 4000 })
  })

  it('con calidad distinta de ok guarda las bandas en NULL', async () => {
    await enviar(TOPICO.vibracion, vibracion(T0, { q: 'sin_senal', n: 0 }))
    const [fila] = await consultar<{ rms_total: number | null; calidad: string }>('SELECT rms_total, calidad FROM lectura_vibracion')
    expect(fila).toEqual({ rms_total: null, calidad: 'sin_senal' })
  })
})

describe('mensajes inválidos', () => {
  it.each([
    ['JSON roto', TOPICO.proceso, '{no es json'],
    ['falta un campo', TOPICO.proceso, { ts: T0 }],
    ['pinza desconocida', TOPICO.vibracion, vibracion(T0, { pinza: 'Z' })],
    ['clase desconocida', TOPICO.deteccion, deteccion(T0, { clase: 'otra' })],
    ['confianza fuera de rango', TOPICO.deteccion, deteccion(T0, { confianza: 7 })],
    ['estado desconocido', 'hydrosense/acq01/estado', 'quizas'],
  ])('%s se descarta sin lanzar error', async (_nombre, topico, carga) => {
    await expect(enviar(topico, carga)).resolves.toBeUndefined()
    expect(await contar('lectura')).toBe(0)
    expect(await contar('deteccion_ia')).toBe(0)
  })
})

describe('regla de fuga', () => {
  const racha = async (segundos: number, extra = {}, inicio = T0) => {
    for (let i = 0; i < segundos; i++) await enviar(TOPICO.deteccion, deteccion(inicio + i * 1000, extra))
  }

  it('crea una alerta a los 4 s sostenidos y vincula las detecciones', async () => {
    await racha(4)
    expect(await contar('alerta')).toBe(0)
    await racha(1, {}, T0 + 4000)
    const alertas = await consultar<{ id_alerta: number; tipo: string; severidad: string; estado: string; id_pinza_a: number }>('SELECT id_alerta, tipo, severidad, estado, id_pinza_a FROM alerta')
    expect(alertas).toHaveLength(1)
    expect(alertas[0]).toMatchObject({ tipo: 'fuga', severidad: 'media', estado: 'activa', id_pinza_a: IDS.pinzaB })
    expect(await contar('deteccion_ia', 'id_alerta = ?', [alertas[0]!.id_alerta])).toBe(5)
  })

  it('no duplica alertas abiertas y suma las detecciones nuevas como evidencia', async () => {
    await racha(12)
    expect(await contar('alerta')).toBe(1)
    expect(await contar('deteccion_ia', 'id_alerta IS NOT NULL')).toBe(12)
  })

  it('una detección bajo el umbral rompe la racha', async () => {
    await racha(3)
    await enviar(TOPICO.deteccion, deteccion(T0 + 3000, { confianza: 0.5 }))
    await racha(3, {}, T0 + 4000)
    expect(await contar('alerta')).toBe(0)
  })

  it('una detección normal rompe la racha y no se guarda', async () => {
    await racha(3)
    await enviar(TOPICO.deteccion, deteccion(T0 + 3000, { clase: 'normal' }))
    await racha(3, {}, T0 + 4000)
    expect(await contar('alerta')).toBe(0)
    expect(await contar('deteccion_ia')).toBe(6)
  })

  it('un reintento de MQTT no guarda la detección dos veces', async () => {
    await enviar(TOPICO.deteccion, deteccion(T0))
    await enviar(TOPICO.deteccion, deteccion(T0))
    const [fila] = await consultar<{ ruta_audio: string | null }>('SELECT ruta_audio FROM deteccion_ia')
    expect(await contar('deteccion_ia')).toBe(1)
    expect(fila!.ruta_audio).toBeNull()
  })

  it('registra un correo por usuario activo (fallido sin SMTP) y ordena torreta y sirena', async () => {
    await racha(5)
    await esperarHasta(async () => (await contar('notificacion')) === 2 && (await contar('accion_actuador')) === 2)
    expect(await contar('notificacion', "estado = 'fallida' AND detalle_error = 'SMTP no configurado'")).toBe(2)
    const comandos = vi.mocked(publicar).mock.calls.map(([topico, carga]) => [topico, (carga as { actuador: string; comando: string }).actuador, (carga as { comando: string }).comando])
    expect(comandos).toEqual(
      expect.arrayContaining([
        ['hydrosense/act01/cmd', 'torreta', 'rojo'],
        ['hydrosense/act01/cmd', 'sirena', 'encender'],
      ]),
    )
    expect(await contar('accion_actuador', "origen = 'automatico' AND id_alerta IS NOT NULL")).toBe(2)
  })

  it('tras cerrar la alerta, una fuga que sigue crea otra', async () => {
    await racha(5)
    await ejecutar("UPDATE alerta SET estado = 'resuelta'")
    await racha(5, {}, T0 + 5000)
    expect(await contar('alerta')).toBe(2)
  })
})

describe('regla de presión', () => {
  const baja = async (segundos: number, inicio = T0, valor = 70) => {
    for (let i = 0; i < segundos; i++) await enviar(TOPICO.proceso, proceso(inicio + i * 1000, { presion_kpa: valor }))
  }

  it('crea una alerta presion_baja a los 5 s y no la duplica', async () => {
    await baja(5)
    expect(await contar('alerta')).toBe(0)
    await baja(10, T0 + 5000)
    const alertas = await consultar<{ tipo: string; severidad: string; id_pinza_a: number }>('SELECT tipo, severidad, id_pinza_a FROM alerta')
    expect(alertas).toEqual([{ tipo: 'presion_baja', severidad: 'media', id_pinza_a: IDS.pinzaA }])
  })

  it('un sensor sin señal no se interpreta como presión baja', async () => {
    for (let i = 0; i < 10; i++) await enviar(TOPICO.proceso, proceso(T0 + i * 1000, { presion_kpa: null, q_presion: 'sin_senal' }))
    expect(await contar('alerta')).toBe(0)
  })

  it('los duplicados no adelantan la regla', async () => {
    for (let i = 0; i < 20; i++) await enviar(TOPICO.proceso, proceso(T0, { presion_kpa: 70 }))
    expect(await contar('alerta')).toBe(0)
  })
})

describe('ack de actuadores', () => {
  const accion = async () =>
    (await ejecutar("INSERT INTO accion_actuador (id_actuador, origen, comando) VALUES (?, 'manual', 'rojo')", [IDS.torreta])).insertId

  it('marca confirmada_en con la fecha del ESP32', async () => {
    const id = await accion()
    await enviar(TOPICO.ack, { id_accion: id, ok: true, ts: T0 })
    const [fila] = await consultar<{ confirmada_en: string }>('SELECT confirmada_en FROM accion_actuador WHERE id_accion = ?', [id])
    expect(fila!.confirmada_en).toBe('2026-11-02 23:59:58.000')
  })

  it('ok = false no confirma la acción', async () => {
    const id = await accion()
    await confirmarAccion(id, false, T0)
    expect(await contar('accion_actuador', 'confirmada_en IS NOT NULL')).toBe(0)
  })
})

describe('estado de dispositivos', () => {
  it('un online retenido no actualiza la última conexión', async () => {
    const { procesarMensaje } = await import('../services/ingesta.js')
    await procesarMensaje('hydrosense/act01/estado', Buffer.from('online'), true)
    expect(estado.dispositivos.act01).toBe('online')
    expect(await contar('dispositivo', 'ultima_conexion IS NOT NULL')).toBe(0)
    await procesarMensaje('hydrosense/act01/estado', Buffer.from('offline'), false)
    expect(estado.dispositivos.act01).toBe('offline')
  })
})

describe('retención', () => {
  const INSERT_LECTURA = "INSERT INTO lectura (id_pinza, tipo, valor, fecha_hora) VALUES (?, 'presion', 1, NOW(3) - INTERVAL ? DAY)"
  const INSERT_VIB = 'INSERT INTO lectura_vibracion (id_pinza, fecha_hora, n_muestras) VALUES (?, NOW(3) - INTERVAL ? DAY, 1)'
  const INSERT_DET = "INSERT INTO deteccion_ia (id_pinza, id_alerta, clase, confianza, version_modelo, fecha_hora) VALUES (?, ?, 'ruido_externo', 0.9, 'v', NOW(3) - INTERVAL ? DAY)"

  it('aplica 90 d a lectura, 7 d a vibración y 30 d a detecciones sin alerta', async () => {
    const { insertId: alerta } = await ejecutar("INSERT INTO alerta (id_tuberia, tipo, severidad, detectada_en) VALUES (?, 'fuga', 'alta', NOW(3))", [IDS.tuberia])
    await ejecutar(INSERT_LECTURA, [IDS.pinzaA, 100])
    await ejecutar(INSERT_LECTURA, [IDS.pinzaA, 80])
    await ejecutar(INSERT_VIB, [IDS.pinzaA, 8])
    await ejecutar(INSERT_VIB, [IDS.pinzaA, 6])
    await ejecutar(INSERT_DET, [IDS.pinzaA, null, 40])
    await ejecutar(INSERT_DET, [IDS.pinzaA, alerta, 40])
    await ejecutar(INSERT_DET, [IDS.pinzaA, null, 20])

    expect(await ejecutarRetencion()).toEqual({ lectura: 1, lectura_vibracion: 1, deteccion_ia: 1 })
    expect(await contar('lectura')).toBe(1)
    expect(await contar('lectura_vibracion')).toBe(1)
    expect(await contar('deteccion_ia')).toBe(2)
    expect(await contar('deteccion_ia', 'id_alerta IS NOT NULL')).toBe(1)
  })

  it('sin filas recientes no borra nada', async () => {
    await ejecutar(INSERT_LECTURA, [IDS.pinzaA, 100])
    expect((await ejecutarRetencion()).lectura).toBe(0)
    expect(await contar('lectura')).toBe(1)
  })
})
