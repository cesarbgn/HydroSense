import { Router } from 'express'
import { z } from 'zod'
import { consultar, ejecutar, enTransaccion } from '../db/pool.js'
import { emitir } from '../realtime.js'
import { enviarComando } from '../services/actuadores.js'
import { hashPassword, iniciarSesion } from '../services/auth.js'
import { invalidarCatalogo } from '../services/catalogo.js'
import { estado } from '../services/estado.js'
import { datetimeAIso, isoADatetime } from '../tiempo.js'
import { requiereRol, requiereSesion, type RequestAutenticado } from './middleware.js'

const idParam = z.coerce.number().int().positive()
const fechaConsulta = z.string().transform((valor, ctx) => {
  const fecha = isoADatetime(valor)
  if (fecha === null) {
    ctx.addIssue({ code: 'custom', message: 'Fecha inválida' })
    return z.NEVER
  }
  return fecha
})

const CLAVE_POR_TIPO = { adquisicion: 'acq01', actuacion: 'act01' } as const

interface FilaFecha {
  fecha_hora: string
}
const conFechaIso = <T extends FilaFecha>(fila: T) => ({ ...fila, fecha_hora: datetimeAIso(fila.fecha_hora) })

export const api = Router()

api.post('/auth/login', async (req, res) => {
  const { correo, password } = z.object({ correo: z.string().min(1).max(254), password: z.string().min(1).max(200) }).parse(req.body)
  const sesion = await iniciarSesion(correo, password)
  if (!sesion) {
    res.status(401).json({ error: 'Correo o contraseña incorrectos' })
    return
  }
  res.json(sesion)
})

api.use(requiereSesion)

// ---------- Lecturas ----------
interface FilaLectura extends FilaFecha {
  id_pinza: number
  pinza: string
  tipo: string
  valor: number | null
  calidad: string
}

api.get('/lecturas/ultimas', async (_req, res) => {
  // Una consulta por pinza y tipo: cada una se resuelve con el UNIQUE (id_pinza, tipo, fecha_hora).
  const filas = await consultar<FilaLectura>(
    `SELECT l.id_pinza, p.nombre AS pinza, l.tipo, l.valor, l.calidad, l.fecha_hora
       FROM pinza p
       JOIN (SELECT 'presion' AS tipo UNION ALL SELECT 'temperatura' UNION ALL SELECT 'caudal') t
       JOIN lectura l ON l.id_lectura = (
         SELECT x.id_lectura FROM lectura x
          WHERE x.id_pinza = p.id_pinza AND x.tipo = t.tipo
          ORDER BY x.fecha_hora DESC LIMIT 1)
      WHERE p.activo = TRUE
      ORDER BY p.id_pinza, l.tipo`,
  )
  res.json(filas.map(conFechaIso))
})

api.get('/lecturas', async (req, res) => {
  const filtro = z
    .object({
      tipo: z.enum(['presion', 'temperatura', 'caudal']),
      desde: fechaConsulta,
      hasta: fechaConsulta,
      id_pinza: idParam.optional(),
      limite: z.coerce.number().int().min(1).max(25_000).default(5_000),
    })
    .parse(req.query)
  // Se filtra por pinza aunque no se pida una: lectura solo tiene índice (id_pinza, tipo, fecha_hora).
  const filas = await consultar<FilaLectura>(
    `SELECT l.id_pinza, p.nombre AS pinza, l.tipo, l.valor, l.calidad, l.fecha_hora
       FROM lectura l JOIN pinza p ON p.id_pinza = l.id_pinza
      WHERE l.id_pinza IN (SELECT id_pinza FROM pinza WHERE ? IS NULL OR id_pinza = ?)
        AND l.tipo = ? AND l.fecha_hora BETWEEN ? AND ?
      ORDER BY l.fecha_hora DESC LIMIT ?`,
    [filtro.id_pinza ?? null, filtro.id_pinza ?? null, filtro.tipo, filtro.desde, filtro.hasta, filtro.limite],
  )
  res.json(filas.reverse().map(conFechaIso))
})

interface FilaVibracion extends FilaFecha {
  id_pinza: number
  pinza: string
}

api.get('/vibracion/ultimas', async (req, res) => {
  const n = z.coerce.number().int().min(1).max(600).default(1).parse(req.query.n)
  const pinzas = await consultar<{ id_pinza: number }>('SELECT id_pinza FROM pinza WHERE activo = TRUE ORDER BY id_pinza')
  const resultado: FilaVibracion[] = []
  for (const { id_pinza } of pinzas) {
    const filas = await consultar<FilaVibracion>(
      `SELECT v.id_pinza, p.nombre AS pinza, v.rms_total, v.rms_b1, v.rms_b2, v.rms_b3, v.n_muestras, v.calidad, v.fecha_hora
         FROM lectura_vibracion v JOIN pinza p ON p.id_pinza = v.id_pinza
        WHERE v.id_pinza = ? ORDER BY v.fecha_hora DESC LIMIT ?`,
      [id_pinza, n],
    )
    resultado.push(...filas)
  }
  res.json(resultado.map(conFechaIso))
})

// ---------- Exportación de mediciones (CSV para análisis / entrenamiento IA) ----------
const celdaCsv = (valor: unknown) => {
  if (valor === null || valor === undefined) return ''
  const texto = String(valor)
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

api.get('/exportar/resumen', async (req, res) => {
  const filtro = z
    .object({
      desde: fechaConsulta.optional(),
      hasta: fechaConsulta.optional(),
    })
    .parse(req.query)
  const desde = filtro.desde ?? null
  const hasta = filtro.hasta ?? null
  const [vib] = await consultar<{ total: number }>(
    `SELECT COUNT(*) AS total FROM lectura_vibracion
      WHERE (? IS NULL OR fecha_hora >= ?) AND (? IS NULL OR fecha_hora <= ?)`,
    [desde, desde, hasta, hasta],
  )
  const [pres] = await consultar<{ total: number }>(
    `SELECT COUNT(*) AS total FROM lectura
      WHERE tipo = 'presion' AND (? IS NULL OR fecha_hora >= ?) AND (? IS NULL OR fecha_hora <= ?)`,
    [desde, desde, hasta, hasta],
  )
  res.json({ vibracion: Number(vib?.total ?? 0), presion: Number(pres?.total ?? 0) })
})

api.get('/exportar/csv', async (req, res) => {
  const filtro = z
    .object({
      dataset: z.enum(['vibracion', 'presion']),
      desde: fechaConsulta.optional(),
      hasta: fechaConsulta.optional(),
      etiqueta: z.enum(['0', '1']).optional(),
    })
    .parse(req.query)
  const desde = filtro.desde ?? null
  const hasta = filtro.hasta ?? null
  const sufijoEtiqueta = filtro.etiqueta === '0' ? '-normal' : filtro.etiqueta === '1' ? '-fuga' : ''

  if (filtro.dataset === 'vibracion') {
    const filas = await consultar<{
      pinza: string
      fecha_hora: string
      rms_total: number | null
      rms_b1: number | null
      rms_b2: number | null
      rms_b3: number | null
      n_muestras: number
      calidad: string
    }>(
      `SELECT p.nombre AS pinza, v.fecha_hora, v.rms_total, v.rms_b1, v.rms_b2, v.rms_b3, v.n_muestras, v.calidad
         FROM lectura_vibracion v JOIN pinza p ON p.id_pinza = v.id_pinza
        WHERE (? IS NULL OR v.fecha_hora >= ?) AND (? IS NULL OR v.fecha_hora <= ?)
        ORDER BY v.fecha_hora ASC LIMIT 250000`,
      [desde, desde, hasta, hasta],
    )
    const encabezados = ['pinza', 'fecha_hora', 'rms_total', 'rms_b1', 'rms_b2', 'rms_b3', 'n_muestras', 'calidad', ...(filtro.etiqueta ? ['etiqueta'] : [])]
    const lineas = [
      encabezados.join(','),
      ...filas.map((f) =>
        [
          f.pinza,
          datetimeAIso(f.fecha_hora),
          f.rms_total,
          f.rms_b1,
          f.rms_b2,
          f.rms_b3,
          f.n_muestras,
          f.calidad,
          ...(filtro.etiqueta ? [filtro.etiqueta] : []),
        ]
          .map(celdaCsv)
          .join(','),
      ),
    ]
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="vibracion-hydrosense${sufijoEtiqueta}.csv"`)
    res.send(lineas.join('\n'))
    return
  }

  const filas = await consultar<{
    pinza: string
    fecha_hora: string
    valor: number | null
    calidad: string
  }>(
    `SELECT p.nombre AS pinza, l.fecha_hora, l.valor, l.calidad
       FROM lectura l JOIN pinza p ON p.id_pinza = l.id_pinza
      WHERE l.tipo = 'presion' AND (? IS NULL OR l.fecha_hora >= ?) AND (? IS NULL OR l.fecha_hora <= ?)
      ORDER BY l.fecha_hora ASC LIMIT 250000`,
    [desde, desde, hasta, hasta],
  )
  const encabezados = ['pinza', 'fecha_hora', 'presion_kpa', 'calidad', ...(filtro.etiqueta ? ['etiqueta'] : [])]
  const lineas = [
    encabezados.join(','),
    ...filas.map((f) =>
      [f.pinza, datetimeAIso(f.fecha_hora), f.valor, f.calidad, ...(filtro.etiqueta ? [filtro.etiqueta] : [])].map(celdaCsv).join(','),
    ),
  ]
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="presion-hydrosense${sufijoEtiqueta}.csv"`)
  res.send(lineas.join('\n'))
})

// ---------- Dispositivos y estado ----------
api.get('/dispositivos', async (_req, res) => {
  const dispositivos = await consultar<{ tipo: keyof typeof CLAVE_POR_TIPO; ultima_conexion: string | null }>(
    'SELECT id_dispositivo, tipo, nombre, mac, ultima_conexion, activo FROM dispositivo ORDER BY id_dispositivo',
  )
  const pinzas = await consultar(
    `SELECT p.id_pinza, p.nombre, p.posicion_m, p.activo, t.nombre AS tuberia, d.tipo AS tipo_dispositivo
       FROM pinza p JOIN tuberia t ON t.id_tuberia = p.id_tuberia JOIN dispositivo d ON d.id_dispositivo = p.id_dispositivo
      ORDER BY p.id_pinza`,
  )
  res.json({
    mqtt_conectado: estado.mqttConectado,
    dispositivos: dispositivos.map((d) => ({
      ...d,
      ultima_conexion: datetimeAIso(d.ultima_conexion),
      clave: CLAVE_POR_TIPO[d.tipo],
      estado: estado.dispositivos[CLAVE_POR_TIPO[d.tipo]] ?? 'desconocido',
    })),
    pinzas,
  })
})

api.get('/estado', (_req, res) => {
  res.json({ mqtt_conectado: estado.mqttConectado, dispositivos: estado.dispositivos, ultimo_mensaje: estado.ultimoMensaje })
})

// ---------- Alertas ----------
interface FilaAlerta {
  detectada_en: string
  cerrada_en: string | null
}

api.get('/alertas', async (req, res) => {
  const filtro = z
    .object({
      estado: z.enum(['activa', 'en_atencion', 'resuelta', 'falsa_alarma']).optional(),
      limite: z.coerce.number().int().min(1).max(500).default(100),
    })
    .parse(req.query)
  const filas = await consultar<FilaAlerta>(
    `SELECT a.id_alerta, a.id_tuberia, t.nombre AS tuberia, a.tipo, a.severidad, a.estado, pa.nombre AS pinza,
            a.posicion_estimada_m, a.volumen_perdido_l, a.confianza, a.detectada_en, a.cerrada_en,
            (SELECT COUNT(*) FROM deteccion_ia d WHERE d.id_alerta = a.id_alerta) AS detecciones,
            (SELECT MAX(d.version_modelo) FROM deteccion_ia d WHERE d.id_alerta = a.id_alerta) AS version_modelo,
            (SELECT COUNT(*) FROM notificacion n WHERE n.id_alerta = a.id_alerta AND n.estado = 'enviada') AS correos_enviados,
            (SELECT COUNT(*) FROM accion_actuador ac WHERE ac.id_alerta = a.id_alerta) AS acciones
       FROM alerta a
       JOIN tuberia t ON t.id_tuberia = a.id_tuberia
       LEFT JOIN pinza pa ON pa.id_pinza = a.id_pinza_a
      WHERE ? IS NULL OR a.estado = ?
      ORDER BY a.id_alerta DESC LIMIT ?`,
    [filtro.estado ?? null, filtro.estado ?? null, filtro.limite],
  )
  res.json(filas.map((f) => ({ ...f, detectada_en: datetimeAIso(f.detectada_en), cerrada_en: datetimeAIso(f.cerrada_en) })))
})

api.patch('/alertas/:id', async (req, res) => {
  const idAlerta = idParam.parse(req.params.id)
  const { estado: nuevo, comentario } = z
    .object({ estado: z.enum(['en_atencion', 'resuelta', 'falsa_alarma']), comentario: z.string().trim().max(500).optional() })
    .parse(req.body)
  const { id_usuario } = (req as unknown as RequestAutenticado).usuario

  const resultado = await enTransaccion(async (conexion) => {
    const [alerta] = await consultar<{ estado: string }>('SELECT estado FROM alerta WHERE id_alerta = ? FOR UPDATE', [idAlerta], conexion)
    if (!alerta) return 404
    if (alerta.estado === 'resuelta' || alerta.estado === 'falsa_alarma') return 409
    await ejecutar('INSERT INTO atencion_alerta (id_alerta, id_usuario, estado, comentario) VALUES (?, ?, ?, ?)', [idAlerta, id_usuario, nuevo, comentario ?? null], conexion)
    await ejecutar('UPDATE alerta SET estado = ?, cerrada_en = IF(? = \'en_atencion\', NULL, NOW(3)) WHERE id_alerta = ?', [nuevo, nuevo, idAlerta], conexion)
    return 200
  })
  if (resultado === 404) {
    res.status(404).json({ error: 'Alerta no encontrada' })
    return
  }
  if (resultado === 409) {
    res.status(409).json({ error: 'La alerta ya está cerrada' })
    return
  }
  emitir('alerta', { id_alerta: idAlerta, estado: nuevo })
  res.json({ id_alerta: idAlerta, estado: nuevo })
})

api.get('/alertas/:id/atenciones', async (req, res) => {
  const idAlerta = idParam.parse(req.params.id)
  const filas = await consultar<FilaFecha>(
    `SELECT aa.id_atencion, aa.estado, aa.comentario, aa.fecha_hora, u.nombre AS usuario
       FROM atencion_alerta aa JOIN usuario u ON u.id_usuario = aa.id_usuario
      WHERE aa.id_alerta = ? ORDER BY aa.fecha_hora`,
    [idAlerta],
  )
  res.json(filas.map(conFechaIso))
})

// ---------- Umbrales ----------
api.get('/umbrales', async (_req, res) => {
  const pinzas = await consultar(
    `SELECT p.id_pinza, p.nombre, p.posicion_m, p.umbral_confianza, p.umbral_presion_kpa, p.activo, t.nombre AS tuberia
       FROM pinza p JOIN tuberia t ON t.id_tuberia = p.id_tuberia ORDER BY p.id_pinza`,
  )
  const tuberias = await consultar('SELECT id_tuberia, nombre, material, diametro_mm, longitud_m, umbral_caudal_lpm FROM tuberia ORDER BY id_tuberia')
  res.json({ pinzas, tuberias })
})

api.put('/umbrales', requiereRol('gerencia'), async (req, res) => {
  const { pinzas } = z
    .object({
      pinzas: z
        .array(
          z.object({
            id_pinza: z.number().int().positive(),
            umbral_confianza: z.number().min(0).max(1),
            umbral_presion_kpa: z.number().min(0).max(99_999),
          }),
        )
        .min(1),
    })
    .parse(req.body)
  await enTransaccion(async (conexion) => {
    for (const p of pinzas) {
      await ejecutar('UPDATE pinza SET umbral_confianza = ?, umbral_presion_kpa = ? WHERE id_pinza = ?', [p.umbral_confianza, p.umbral_presion_kpa, p.id_pinza], conexion)
    }
  })
  invalidarCatalogo()
  res.json({ actualizadas: pinzas.length })
})

// ---------- Usuarios ----------
const USUARIOS_SQL = `
  SELECT u.id_usuario, u.nombre, u.correo, r.nombre AS rol, u.activo
    FROM usuario u JOIN rol r ON r.id_rol = u.id_rol`
const rolUsuario = z.enum(['gerencia', 'mantenimiento'])
const ID_ROL_SQL = '(SELECT id_rol FROM rol WHERE nombre = ?)'

api.get('/usuarios', requiereRol('gerencia'), async (_req, res) => {
  res.json(await consultar(`${USUARIOS_SQL} ORDER BY u.id_usuario`))
})

api.post('/usuarios', requiereRol('gerencia'), async (req, res) => {
  const datos = z
    .object({ nombre: z.string().trim().min(1).max(100), correo: z.email().max(254), password: z.string().min(8).max(200), rol: rolUsuario })
    .parse(req.body)
  const { insertId } = await ejecutar(`INSERT INTO usuario (id_rol, nombre, correo, password_hash) VALUES (${ID_ROL_SQL}, ?, ?, ?)`, [
    datos.rol,
    datos.nombre,
    datos.correo,
    await hashPassword(datos.password),
  ])
  const [creado] = await consultar(`${USUARIOS_SQL} WHERE u.id_usuario = ?`, [insertId])
  res.status(201).json(creado)
})

api.put('/usuarios/:id', requiereRol('gerencia'), async (req, res) => {
  const idUsuario = idParam.parse(req.params.id)
  const datos = z
    .object({
      nombre: z.string().trim().min(1).max(100).optional(),
      correo: z.email().max(254).optional(),
      password: z.string().min(8).max(200).optional(),
      rol: rolUsuario.optional(),
      activo: z.boolean().optional(),
    })
    .parse(req.body)

  // Evita que Gerencia se quede sin acceso por accidente al editarse a sí misma.
  if (idUsuario === (req as unknown as RequestAutenticado).usuario.id_usuario && (datos.activo === false || (datos.rol && datos.rol !== 'gerencia'))) {
    res.status(409).json({ error: 'No puedes quitarte tu propio acceso de Gerencia' })
    return
  }

  const campos: string[] = []
  const valores: unknown[] = []
  if (datos.nombre !== undefined) (campos.push('nombre = ?'), valores.push(datos.nombre))
  if (datos.correo !== undefined) (campos.push('correo = ?'), valores.push(datos.correo))
  if (datos.password !== undefined) (campos.push('password_hash = ?'), valores.push(await hashPassword(datos.password)))
  if (datos.rol !== undefined) (campos.push(`id_rol = ${ID_ROL_SQL}`), valores.push(datos.rol))
  if (datos.activo !== undefined) (campos.push('activo = ?'), valores.push(datos.activo))
  if (campos.length) await ejecutar(`UPDATE usuario SET ${campos.join(', ')} WHERE id_usuario = ?`, [...valores, idUsuario])

  const [usuario] = await consultar(`${USUARIOS_SQL} WHERE u.id_usuario = ?`, [idUsuario])
  if (!usuario) {
    res.status(404).json({ error: 'Usuario no encontrado' })
    return
  }
  res.json(usuario)
})

// ---------- Actuadores ----------
api.get('/actuadores', async (_req, res) => {
  const filas = await consultar<{ fecha_hora: string | null; confirmada_en: string | null }>(
    `SELECT a.id_actuador, a.tipo, a.nombre, a.activo, ac.id_accion, ac.comando, ac.origen, ac.fecha_hora, ac.confirmada_en
       FROM actuador a
       LEFT JOIN accion_actuador ac ON ac.id_accion = (
         SELECT x.id_accion FROM accion_actuador x WHERE x.id_actuador = a.id_actuador ORDER BY x.id_accion DESC LIMIT 1)
      ORDER BY a.id_actuador`,
  )
  res.json(filas.map((f) => ({ ...f, fecha_hora: datetimeAIso(f.fecha_hora), confirmada_en: datetimeAIso(f.confirmada_en) })))
})

api.post('/actuadores/:id/comando', async (req, res) => {
  const idActuador = idParam.parse(req.params.id)
  const { comando } = z.object({ comando: z.enum(['verde', 'amarillo', 'rojo', 'encender', 'apagar', 'abrir', 'cerrar']) }).parse(req.body)
  const accion = await enviarComando({ id_actuador: idActuador, comando, origen: 'manual', id_usuario: (req as unknown as RequestAutenticado).usuario.id_usuario })
  res.status(202).json(accion)
})
