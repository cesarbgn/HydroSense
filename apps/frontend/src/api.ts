import { io, type Socket } from 'socket.io-client'

const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const CLAVE_SESION = 'hydrosense.sesion'

export type RolApi = 'gerencia' | 'mantenimiento'
export type Rol = 'manager' | 'maintenance'
export type Calidad = 'ok' | 'sin_senal' | 'fuera_rango'
export type EstadoAlerta = 'activa' | 'en_atencion' | 'resuelta' | 'falsa_alarma'

export interface UsuarioSesion {
  id_usuario: number
  nombre: string
  correo: string
  rol: RolApi
}
export interface Sesion {
  token: string
  usuario: UsuarioSesion
}
export interface Lectura {
  id_pinza: number
  pinza: string
  tipo: 'presion' | 'temperatura' | 'caudal'
  valor: number | null
  calidad: Calidad
  fecha_hora: string
}
export interface Vibracion {
  id_pinza: number
  pinza: string
  rms_total: number | null
  rms_b1: number | null
  rms_b2: number | null
  rms_b3: number | null
  n_muestras: number
  calidad: Calidad
  fecha_hora: string
}
export interface Dispositivo {
  id_dispositivo: number
  tipo: 'adquisicion' | 'actuacion'
  nombre: string
  mac: string
  ultima_conexion: string | null
  activo: number
  clave: string
  estado: 'online' | 'offline' | 'desconocido'
}
export interface PinzaDispositivo {
  id_pinza: number
  nombre: string
  posicion_m: number
  activo: number
  tuberia: string
}
export interface EstadoDispositivos {
  mqtt_conectado: boolean
  dispositivos: Dispositivo[]
  pinzas: PinzaDispositivo[]
}
export interface Alerta {
  id_alerta: number
  id_tuberia: number
  tuberia: string
  tipo: 'fuga' | 'consumo_excesivo' | 'presion_baja'
  severidad: 'baja' | 'media' | 'alta'
  estado: EstadoAlerta
  pinza: string | null
  posicion_estimada_m: number | null
  volumen_perdido_l: number | null
  confianza: number | null
  detectada_en: string
  cerrada_en: string | null
  detecciones: number
  version_modelo: string | null
  correos_enviados: number
  acciones: number
}
export interface Atencion {
  id_atencion: number
  estado: EstadoAlerta
  comentario: string | null
  fecha_hora: string
  usuario: string
}
export interface Actuador {
  id_actuador: number
  tipo: 'torreta' | 'sirena' | 'valvula'
  nombre: string
  activo: number
  id_accion: number | null
  comando: string | null
  origen: string | null
  fecha_hora: string | null
  confirmada_en: string | null
}
export interface PinzaUmbral {
  id_pinza: number
  nombre: string
  posicion_m: number
  umbral_confianza: number
  umbral_presion_kpa: number
  activo: number
  tuberia: string
}
export interface Tuberia {
  id_tuberia: number
  nombre: string
  material: string
  diametro_mm: number
  longitud_m: number
  umbral_caudal_lpm: number | null
}
export interface Umbrales {
  pinzas: PinzaUmbral[]
  tuberias: Tuberia[]
}
export interface Usuario {
  id_usuario: number
  nombre: string
  correo: string
  rol: RolApi
  activo: number
}
export interface EstadoSistema {
  mqtt_conectado: boolean
  dispositivos: Record<string, string>
  ultimo_mensaje: Record<string, string>
}

export class ErrorApi extends Error {
  constructor(
    public readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje)
  }
}

let alExpirar: () => void = () => {}
export function configurarExpiracion(funcion: () => void) {
  alExpirar = funcion
}

export function leerSesion(): Sesion | null {
  try {
    const guardada = localStorage.getItem(CLAVE_SESION)
    return guardada ? (JSON.parse(guardada) as Sesion) : null
  } catch {
    return null
  }
}

function guardarSesion(sesion: Sesion | null) {
  try {
    if (sesion) localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
    else localStorage.removeItem(CLAVE_SESION)
  } catch {
    // Sin almacenamiento la sesión dura lo que dure la pestaña.
  }
}

async function pedir<T>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown } = {}): Promise<T> {
  const token = leerSesion()?.token
  let respuesta: Response
  try {
    respuesta = await fetch(`${API_URL}/api${ruta}`, {
      method: opciones.metodo ?? 'GET',
      headers: {
        ...(opciones.cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
    })
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor')
  }
  const datos = (await respuesta.json().catch(() => null)) as { error?: string } | null
  if (!respuesta.ok) {
    if (respuesta.status === 401 && token) alExpirar()
    throw new ErrorApi(respuesta.status, datos?.error ?? 'Error del servidor')
  }
  return datos as T
}

export async function iniciarSesion(correo: string, password: string): Promise<Sesion> {
  const sesion = await pedir<Sesion>('/auth/login', { metodo: 'POST', cuerpo: { correo, password } })
  guardarSesion(sesion)
  return sesion
}

export function cerrarSesion() {
  guardarSesion(null)
}

export const api = {
  lecturasUltimas: () => pedir<Lectura[]>('/lecturas/ultimas'),
  lecturas: (tipo: Lectura['tipo'], desde: Date, hasta: Date) =>
    pedir<Lectura[]>(`/lecturas?tipo=${tipo}&desde=${encodeURIComponent(desde.toISOString())}&hasta=${encodeURIComponent(hasta.toISOString())}&limite=25000`),
  vibracionUltimas: () => pedir<Vibracion[]>('/vibracion/ultimas'),
  dispositivos: () => pedir<EstadoDispositivos>('/dispositivos'),
  estado: () => pedir<EstadoSistema>('/estado'),
  alertas: () => pedir<Alerta[]>('/alertas?limite=200'),
  atenderAlerta: (id: number, estado: EstadoAlerta, comentario?: string) =>
    pedir(`/alertas/${id}`, { metodo: 'PATCH', cuerpo: { estado, ...(comentario ? { comentario } : {}) } }),
  atenciones: (id: number) => pedir<Atencion[]>(`/alertas/${id}/atenciones`),
  umbrales: () => pedir<Umbrales>('/umbrales'),
  guardarUmbrales: (pinzas: { id_pinza: number; umbral_confianza: number; umbral_presion_kpa: number }[]) =>
    pedir('/umbrales', { metodo: 'PUT', cuerpo: { pinzas } }),
  usuarios: () => pedir<Usuario[]>('/usuarios'),
  crearUsuario: (datos: { nombre: string; correo: string; password: string; rol: RolApi }) => pedir<Usuario>('/usuarios', { metodo: 'POST', cuerpo: datos }),
  editarUsuario: (id: number, datos: Partial<{ nombre: string; correo: string; rol: RolApi; activo: boolean }>) =>
    pedir<Usuario>(`/usuarios/${id}`, { metodo: 'PUT', cuerpo: datos }),
  actuadores: () => pedir<Actuador[]>('/actuadores'),
  comando: (id: number, comando: string) => pedir(`/actuadores/${id}/comando`, { metodo: 'POST', cuerpo: { comando } }),
}

export function conectarTiempoReal(): Socket {
  return io(API_URL, { auth: (enviar) => enviar({ token: leerSesion()?.token }) })
}

// ---------- Formato para pantalla ----------
export const rolDeToken = (rol: RolApi): Rol => (rol === 'gerencia' ? 'manager' : 'maintenance')
export const conCeros = (id: number) => String(id).padStart(2, '0')
export const codigoAlerta = (id: number) => `ALT-${conCeros(id)}`
export const kpaABar = (kpa: number) => (kpa / 100).toFixed(2)

const ZONA = 'America/Mexico_City'
const hora = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false })
const dia = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' })
const diaCorto = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, day: 'numeric', month: 'short' })

export const horaLocal = (fecha: string | number | Date) => hora.format(new Date(fecha))
export const mismoDia = (a: string | number | Date, b: string | number | Date) => dia.format(new Date(a)) === dia.format(new Date(b))

export function fechaLocal(iso: string, ahora: number = Date.now()) {
  if (mismoDia(iso, ahora)) return `Hoy, ${horaLocal(iso)}`
  if (mismoDia(iso, ahora - 86_400_000)) return `Ayer, ${horaLocal(iso)}`
  return `${diaCorto.format(new Date(iso))}, ${horaLocal(iso)}`
}

export function haceCuanto(iso: string | null, ahora: number = Date.now()) {
  if (!iso) return 'Sin registro'
  const segundos = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 1000))
  if (segundos < 60) return `Hace ${segundos} s`
  if (segundos < 3600) return `Hace ${Math.floor(segundos / 60)} min`
  if (segundos < 86_400) return `Hace ${Math.floor(segundos / 3600)} h`
  return fechaLocal(iso, ahora)
}

export const TEXTO_CALIDAD: Record<Calidad, string> = { ok: 'Lectura normal', sin_senal: 'Sin señal', fuera_rango: 'Fuera de rango' }
