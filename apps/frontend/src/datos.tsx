import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import { api, conectarTiempoReal, type Actuador, type Alerta, type EstadoDispositivos, type Lectura, type Sesion, type Umbrales, type Usuario, type Vibracion } from './api'

export interface EventoCrudo {
  evento: string
  datos: unknown
  recibido: number
}

interface Datos {
  sesion: Sesion
  ahora: number
  conectado: boolean
  cargando: boolean
  lecturas: Lectura[]
  vibracion: Vibracion[]
  dispositivos: EstadoDispositivos | null
  alertas: Alerta[]
  actuadores: Actuador[]
  umbrales: Umbrales | null
  usuarios: Usuario[]
  eventos: EventoCrudo[]
  recargarAlertas: () => Promise<void>
  recargarActuadores: () => Promise<void>
  recargarUmbrales: () => Promise<void>
  recargarUsuarios: () => Promise<void>
  alRecibirLectura: (oyente: (lectura: Lectura) => void) => () => void
}

const Contexto = createContext<Datos | null>(null)

export function useDatos() {
  const datos = useContext(Contexto)
  if (!datos) throw new Error('useDatos requiere DatosProvider')
  return datos
}

const MAX_EVENTOS = 40

export function DatosProvider({ sesion, children }: { sesion: Sesion; children: ReactNode }) {
  const [ahora, setAhora] = useState(Date.now())
  const [conectado, setConectado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [lecturas, setLecturas] = useState<Lectura[]>([])
  const [vibracion, setVibracion] = useState<Vibracion[]>([])
  const [dispositivos, setDispositivos] = useState<EstadoDispositivos | null>(null)
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [actuadores, setActuadores] = useState<Actuador[]>([])
  const [umbrales, setUmbrales] = useState<Umbrales | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [eventos, setEventos] = useState<EventoCrudo[]>([])
  const oyentesLectura = useRef(new Set<(lectura: Lectura) => void>())
  const esGerencia = sesion.usuario.rol === 'gerencia'

  const recargarAlertas = useCallback(async () => setAlertas(await api.alertas()), [])
  const recargarActuadores = useCallback(async () => setActuadores(await api.actuadores()), [])
  const recargarUmbrales = useCallback(async () => setUmbrales(await api.umbrales()), [])
  const recargarUsuarios = useCallback(async () => {
    if (esGerencia) setUsuarios(await api.usuarios())
  }, [esGerencia])

  const recargarTodo = useCallback(async () => {
    await Promise.allSettled([
      api.lecturasUltimas().then(setLecturas),
      api.vibracionUltimas().then(setVibracion),
      api.dispositivos().then(setDispositivos),
      recargarAlertas(),
      recargarActuadores(),
      recargarUmbrales(),
      recargarUsuarios(),
    ])
    setCargando(false)
  }, [recargarAlertas, recargarActuadores, recargarUmbrales, recargarUsuarios])

  useEffect(() => {
    const reloj = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(reloj)
  }, [])

  useEffect(() => {
    void recargarTodo()
    const socket: Socket = conectarTiempoReal()
    const anotar = (evento: string, datos: unknown) => setEventos((previos) => [{ evento, datos, recibido: Date.now() }, ...previos].slice(0, MAX_EVENTOS))

    socket.on('connect', () => {
      setConectado(true)
      void recargarTodo()
    })
    socket.on('disconnect', () => setConectado(false))
    socket.on('lectura', (lectura: Lectura) => {
      anotar('lectura', lectura)
      setLecturas((previas) => [...previas.filter((l) => !(l.id_pinza === lectura.id_pinza && l.tipo === lectura.tipo)), lectura])
      oyentesLectura.current.forEach((oyente) => oyente(lectura))
    })
    socket.on('vibracion', (fila: Vibracion) => {
      anotar('vibracion', fila)
      setVibracion((previas) => [...previas.filter((v) => v.id_pinza !== fila.id_pinza), fila])
    })
    socket.on('alerta', (datos: unknown) => {
      anotar('alerta', datos)
      void recargarAlertas()
    })
    socket.on('actuador', (datos: unknown) => {
      anotar('actuador', datos)
      void recargarActuadores()
      void recargarAlertas()
    })
    socket.on('dispositivo', (datos: { clave?: string; estado?: Dispositivo['estado']; ultima_conexion?: string; mqtt_conectado?: boolean }) => {
      anotar('dispositivo', datos)
      setDispositivos((previo) => {
        if (!previo) return previo
        return {
          ...previo,
          mqtt_conectado: datos.mqtt_conectado ?? previo.mqtt_conectado,
          dispositivos: previo.dispositivos.map((d) =>
            d.clave === datos.clave ? { ...d, estado: datos.estado ?? d.estado, ultima_conexion: datos.ultima_conexion ?? d.ultima_conexion } : d,
          ),
        }
      })
    })
    return () => {
      socket.disconnect()
    }
  }, [recargarTodo, recargarAlertas, recargarActuadores])

  const alRecibirLectura = useCallback((oyente: (lectura: Lectura) => void) => {
    oyentesLectura.current.add(oyente)
    return () => {
      oyentesLectura.current.delete(oyente)
    }
  }, [])

  const valor = useMemo(
    () => ({
      sesion,
      ahora,
      conectado,
      cargando,
      lecturas,
      vibracion,
      dispositivos,
      alertas,
      actuadores,
      umbrales,
      usuarios,
      eventos,
      recargarAlertas,
      recargarActuadores,
      recargarUmbrales,
      recargarUsuarios,
      alRecibirLectura,
    }),
    [sesion, ahora, conectado, cargando, lecturas, vibracion, dispositivos, alertas, actuadores, umbrales, usuarios, eventos, recargarAlertas, recargarActuadores, recargarUmbrales, recargarUsuarios, alRecibirLectura],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

type Dispositivo = EstadoDispositivos['dispositivos'][number]
