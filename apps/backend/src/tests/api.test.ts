import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearApp } from '../app.js'
import { consultar, ejecutar, pool } from '../db/pool.js'
import { publicar } from '../mqtt/cliente.js'
import { estado } from '../services/estado.js'
import { contar, enviar, IDS, PASS_GERENCIA, PASS_MANTENIMIENTO, reiniciarBd, TOPICO } from './ayudas.js'

vi.mock('../mqtt/cliente.js', () => ({ publicar: vi.fn(async () => undefined) }))

const app = crearApp()
let gerente: string
let tecnico: string

const login = async (correo: string, password: string) => (await request(app).post('/api/auth/login').send({ correo, password }).expect(200)).body.token as string
const como = (token: string) => ({ Authorization: `Bearer ${token}` })

beforeEach(async () => {
  vi.mocked(publicar).mockClear()
  estado.mqttConectado = true
  await reiniciarBd()
  gerente = await login('g@test.local', PASS_GERENCIA)
  tecnico = await login('t@test.local', PASS_MANTENIMIENTO)
})
afterAll(async () => {
  await pool.end()
})

describe('autenticación', () => {
  it('login devuelve el rol y no el hash', async () => {
    const { body } = await request(app).post('/api/auth/login').send({ correo: 'g@test.local', password: PASS_GERENCIA }).expect(200)
    expect(body.usuario).toEqual({ id_usuario: IDS.gerente, nombre: 'Gerente', correo: 'g@test.local', rol: 'gerencia' })
    expect(JSON.stringify(body)).not.toContain('password_hash')
  })

  it('credenciales malas: 401, sin revelar cuál falló', async () => {
    const mala = await request(app).post('/api/auth/login').send({ correo: 'g@test.local', password: 'x' }).expect(401)
    const inexistente = await request(app).post('/api/auth/login').send({ correo: 'nadie@test.local', password: 'x' }).expect(401)
    expect(mala.body).toEqual(inexistente.body)
  })

  it('sin token o con token alterado: 401', async () => {
    await request(app).get('/api/dispositivos').expect(401)
    await request(app).get('/api/dispositivos').set(como(`${gerente}x`)).expect(401)
  })

  it('un usuario dado de baja pierde el acceso de inmediato', async () => {
    await ejecutar('UPDATE usuario SET activo = FALSE WHERE id_usuario = ?', [IDS.tecnico])
    await request(app).get('/api/dispositivos').set(como(tecnico)).expect(401)
    await request(app).post('/api/auth/login').send({ correo: 't@test.local', password: PASS_MANTENIMIENTO }).expect(401)
  })
})

describe('permisos por rol', () => {
  it('Mantenimiento no administra usuarios ni umbrales', async () => {
    await request(app).get('/api/usuarios').set(como(tecnico)).expect(403)
    await request(app).post('/api/usuarios').set(como(tecnico)).send({}).expect(403)
    await request(app).put(`/api/usuarios/${IDS.tecnico}`).set(como(tecnico)).send({ rol: 'gerencia' }).expect(403)
    await request(app).put('/api/umbrales').set(como(tecnico)).send({}).expect(403)
  })

  it('Mantenimiento lee, atiende alertas y manda actuadores', async () => {
    await request(app).get('/api/umbrales').set(como(tecnico)).expect(200)
    await request(app).get('/api/lecturas/ultimas').set(como(tecnico)).expect(200)
    await request(app).post(`/api/actuadores/${IDS.sirena}/comando`).set(como(tecnico)).send({ comando: 'encender' }).expect(202)
    const { insertId } = await ejecutar("INSERT INTO alerta (id_tuberia, tipo, severidad, detectada_en) VALUES (?, 'fuga', 'alta', NOW(3))", [IDS.tuberia])
    await request(app).patch(`/api/alertas/${insertId}`).set(como(tecnico)).send({ estado: 'en_atencion' }).expect(200)
  })
})

describe('lecturas y vibración', () => {
  const ts = Date.now() - 5000

  it('últimas lecturas incluyen calidad y fecha con zona, e IDs numéricos', async () => {
    await enviar(TOPICO.proceso, { ts, presion_kpa: null, temp_c: 25, q_presion: 'sin_senal', q_temp: 'ok' })
    const { body } = await request(app).get('/api/lecturas/ultimas').set(como(gerente)).expect(200)
    const presion = body.find((l: { tipo: string }) => l.tipo === 'presion')
    expect(presion).toMatchObject({ id_pinza: IDS.pinzaA, pinza: 'A', valor: null, calidad: 'sin_senal' })
    expect(typeof presion.id_pinza).toBe('number')
    expect(Date.parse(presion.fecha_hora)).toBe(ts)
    expect(presion.fecha_hora).toMatch(/-06:00$/)
  })

  it('filtra el historial por tipo y rango, en orden ascendente', async () => {
    for (let i = 0; i < 3; i++) await enviar(TOPICO.proceso, { ts: ts + i * 1000, presion_kpa: 100 + i, temp_c: 25, q_presion: 'ok', q_temp: 'ok' })
    const desde = new Date(ts + 500).toISOString()
    const hasta = new Date(ts + 5000).toISOString()
    const { body } = await request(app).get('/api/lecturas').query({ tipo: 'presion', desde, hasta }).set(como(gerente)).expect(200)
    expect(body.map((l: { valor: number }) => l.valor)).toEqual([101, 102])
  })

  it('parámetros inválidos: 400', async () => {
    await request(app).get('/api/lecturas').query({ tipo: 'presion', desde: 'ayer', hasta: 'hoy' }).set(como(gerente)).expect(400)
    await request(app).get('/api/lecturas').query({ tipo: 'humedad', desde: new Date().toISOString(), hasta: new Date().toISOString() }).set(como(gerente)).expect(400)
  })

  it('última vibración por pinza', async () => {
    await enviar(TOPICO.vibracion, { ts, pinza: 'B', rms: 9, b1: 1, b2: 8, b3: 2, n: 4000, q: 'ok' })
    const { body } = await request(app).get('/api/vibracion/ultimas').set(como(gerente)).expect(200)
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({ pinza: 'B', rms_b2: 8, calidad: 'ok' })
  })
})

describe('alertas', () => {
  const crear = async () => (await ejecutar("INSERT INTO alerta (id_tuberia, id_pinza_a, tipo, severidad, detectada_en) VALUES (?, ?, 'fuga', 'alta', NOW(3))", [IDS.tuberia, IDS.pinzaB])).insertId

  it('la atención guarda historial y estado actual en la misma operación', async () => {
    const id = await crear()
    await request(app).patch(`/api/alertas/${id}`).set(como(tecnico)).send({ estado: 'en_atencion', comentario: 'Voy en camino' }).expect(200)
    await request(app).patch(`/api/alertas/${id}`).set(como(tecnico)).send({ estado: 'resuelta', comentario: 'Reparada' }).expect(200)
    const { body } = await request(app).get('/api/alertas').query({ estado: 'resuelta' }).set(como(gerente)).expect(200)
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({ id_alerta: id, estado: 'resuelta', pinza: 'B', tipo: 'fuga' })
    expect(body[0].cerrada_en).not.toBeNull()
    expect(await contar('atencion_alerta', 'id_alerta = ? AND id_usuario = ?', [id, IDS.tecnico])).toBe(2)
    const atenciones = await request(app).get(`/api/alertas/${id}/atenciones`).set(como(gerente)).expect(200)
    expect(atenciones.body.map((a: { comentario: string }) => a.comentario)).toEqual(['Voy en camino', 'Reparada'])
  })

  it('una alerta cerrada no se reabre: 409, sin historial nuevo', async () => {
    const id = await crear()
    await request(app).patch(`/api/alertas/${id}`).set(como(gerente)).send({ estado: 'falsa_alarma' }).expect(200)
    await request(app).patch(`/api/alertas/${id}`).set(como(gerente)).send({ estado: 'en_atencion' }).expect(409)
    expect(await contar('atencion_alerta')).toBe(1)
  })

  it('alerta inexistente: 404; estado inválido: 400', async () => {
    await request(app).patch('/api/alertas/999999').set(como(gerente)).send({ estado: 'resuelta' }).expect(404)
    const id = await crear()
    await request(app).patch(`/api/alertas/${id}`).set(como(gerente)).send({ estado: 'activa' }).expect(400)
  })
})

describe('umbrales', () => {
  it('un cambio se aplica a la siguiente regla, sin reiniciar', async () => {
    await request(app)
      .put('/api/umbrales')
      .set(como(gerente))
      .send({ pinzas: [{ id_pinza: IDS.pinzaA, umbral_confianza: 0.9, umbral_presion_kpa: 200 }] })
      .expect(200)
    const { body } = await request(app).get('/api/umbrales').set(como(gerente)).expect(200)
    expect(body.pinzas.find((p: { id_pinza: number }) => p.id_pinza === IDS.pinzaA)).toMatchObject({ umbral_confianza: 0.9, umbral_presion_kpa: 200 })

    const inicio = Date.now() - 20_000
    for (let i = 0; i < 6; i++) await enviar(TOPICO.proceso, { ts: inicio + i * 1000, presion_kpa: 150, temp_c: 25, q_presion: 'ok', q_temp: 'ok' })
    expect(await contar('alerta', "tipo = 'presion_baja'")).toBe(1)
  })

  it('valores fuera de rango: 400', async () => {
    await request(app)
      .put('/api/umbrales')
      .set(como(gerente))
      .send({ pinzas: [{ id_pinza: IDS.pinzaA, umbral_confianza: 1.5, umbral_presion_kpa: 100 }] })
      .expect(400)
  })
})

describe('usuarios', () => {
  const nuevo = { nombre: 'Ana', correo: 'ana@test.local', password: 'una-clave-larga', rol: 'mantenimiento' }

  it('crea un usuario que puede iniciar sesión, y nunca expone el hash', async () => {
    const { body } = await request(app).post('/api/usuarios').set(como(gerente)).send(nuevo).expect(201)
    expect(body).toMatchObject({ nombre: 'Ana', rol: 'mantenimiento' })
    expect(body).not.toHaveProperty('password_hash')
    await login('ana@test.local', 'una-clave-larga')
    const lista = await request(app).get('/api/usuarios').set(como(gerente)).expect(200)
    expect(JSON.stringify(lista.body)).not.toContain('password_hash')
  })

  it('correo duplicado: 409; contraseña corta: 400', async () => {
    await request(app).post('/api/usuarios').set(como(gerente)).send({ ...nuevo, correo: 'G@TEST.LOCAL' }).expect(409)
    await request(app).post('/api/usuarios').set(como(gerente)).send({ ...nuevo, password: 'corta' }).expect(400)
  })

  it('edita rol y estado', async () => {
    const { body } = await request(app).put(`/api/usuarios/${IDS.tecnico}`).set(como(gerente)).send({ nombre: 'Otro', rol: 'gerencia', activo: false }).expect(200)
    expect(body).toMatchObject({ nombre: 'Otro', rol: 'gerencia', activo: 0 })
  })

  it('Gerencia no puede quitarse su propio acceso', async () => {
    await request(app).put(`/api/usuarios/${IDS.gerente}`).set(como(gerente)).send({ activo: false }).expect(409)
    await request(app).put(`/api/usuarios/${IDS.gerente}`).set(como(gerente)).send({ rol: 'mantenimiento' }).expect(409)
  })
})

describe('actuadores', () => {
  it('publica en act01/cmd, registra la acción y el ack la confirma', async () => {
    const { body } = await request(app).post(`/api/actuadores/${IDS.valvula}/comando`).set(como(tecnico)).send({ comando: 'cerrar' }).expect(202)
    expect(publicar).toHaveBeenCalledWith('hydrosense/act01/cmd', { actuador: 'valvula', comando: 'cerrar', id_accion: body.id_accion })
    const [antes] = await consultar<{ origen: string; id_usuario: number; confirmada_en: string | null }>('SELECT origen, id_usuario, confirmada_en FROM accion_actuador')
    expect(antes).toEqual({ origen: 'manual', id_usuario: IDS.tecnico, confirmada_en: null })

    await enviar(TOPICO.ack, { id_accion: body.id_accion, ok: true, ts: Date.now() })
    const lista = await request(app).get('/api/actuadores').set(como(tecnico)).expect(200)
    const valvula = lista.body.find((a: { id_actuador: number }) => a.id_actuador === IDS.valvula)
    expect(valvula).toMatchObject({ comando: 'cerrar', origen: 'manual' })
    expect(valvula.confirmada_en).not.toBeNull()
  })

  it('un comando que no aplica al actuador: 400, sin registrar ni publicar', async () => {
    await request(app).post(`/api/actuadores/${IDS.sirena}/comando`).set(como(tecnico)).send({ comando: 'rojo' }).expect(400)
    expect(publicar).not.toHaveBeenCalled()
    expect(await contar('accion_actuador')).toBe(0)
  })

  it('sin MQTT: 503, sin registrar una acción que nunca saldrá', async () => {
    estado.mqttConectado = false
    await request(app).post(`/api/actuadores/${IDS.sirena}/comando`).set(como(tecnico)).send({ comando: 'encender' }).expect(503)
    expect(await contar('accion_actuador')).toBe(0)
  })

  it('actuador inexistente: 404', async () => {
    await request(app).post('/api/actuadores/999999/comando').set(como(tecnico)).send({ comando: 'encender' }).expect(404)
  })
})
