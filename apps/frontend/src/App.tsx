import { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
  api,
  cerrarSesion,
  codigoAlerta,
  conCeros,
  configurarExpiracion,
  fechaLocal,
  haceCuanto,
  horaLocal,
  iniciarSesion,
  kpaABar,
  leerSesion,
  mismoDia,
  rolDeToken,
  TEXTO_CALIDAD,
  type Actuador,
  type Alerta,
  type Atencion,
  type EstadoAlerta,
  type EstadoSistema,
  type Lectura,
  type Rol,
  type RolApi,
  type Sesion,
  type Usuario,
} from "./api"
import { DatosProvider, useDatos } from "./datos"

type IconName = "overview" | "devices" | "alerts" | "thresholds" | "users" | "settings" | "bell" | "menu" | "close" | "chevron" | "activity" | "temperature" | "flow" | "valve" | "siren" | "tower" | "search" | "plus" | "download" | "more" | "check" | "wifi" | "mail" | "shield" | "lock" | "eye" | "eyeOff"

const paths: Record<IconName, React.ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  devices: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="3" />
      <path d="M9 7h6M9 11h6M10 17h4" />
    </>
  ),
  alerts: (
    <>
      <path d="M12 3 2.8 19h18.4L12 3Z" />
      <path d="M12 9v4M12 16.5h.01" />
    </>
  ),
  thresholds: (
    <>
      <path d="M4 6h16M7 12h10M10 18h4" />
      <circle cx="9" cy="6" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="12" cy="18" r="2" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88L4.2 7.06 7.03 4.2l.06.06A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V3h4v.08A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9 1.7 1.7 0 0 0 21 10h.08v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
  temperature: (
    <>
      <path d="M14.5 13.7V5a2.5 2.5 0 0 0-5 0v8.7a4.5 4.5 0 1 0 5 0Z" />
      <path d="M12 10v6.2" />
      <circle cx="12" cy="17.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  flow: <path d="M12 2s7 7.2 7 13a7 7 0 0 1-14 0c0-5.8 7-13 7-13Z" />,
  valve: (
    <>
      <path d="M4 8h16M8 5v6M16 5v6M12 8v11M8 19h8" />
      <circle cx="12" cy="8" r="3" />
    </>
  ),
  siren: (
    <>
      <path d="M6 17h12l-1-8a5 5 0 0 0-10 0l-1 8ZM4 21h16" />
      <path d="M12 2V1M20 6l2-1M4 6 2 5" />
    </>
  ),
  tower: (
    <>
      <path d="M8 21h8l-1-6H9l-1 6ZM9 15l1-6h4l1 6" />
      <path d="M5 7 3 5M19 7l2-2M12 5V2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  download: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  wifi: (
    <>
      <path d="M2.1 8.6a14 14 0 0 1 19.8 0M4.95 12.15a9.5 9.5 0 0 1 14.1 0M8.3 15.15a5 5 0 0 1 7.4 0" />
      <circle cx="12" cy="18.5" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2M6.6 6.6C4 8.3 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6M2 2l20 20" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
}

type DialogKind = "notifications" | "analysis" | "site" | "device" | "deviceActions" | "export" | "alert" | "invite" | "userActions"

type DialogState = { kind: DialogKind; alerta?: Alerta; usuario?: Usuario; dispositivo?: string }

const InteractionContext = createContext({
  openDialog: (_dialog: DialogKind, _datos?: Omit<DialogState, "kind">) => {},
  notify: (_message: string) => {},
})

function useInteractions() {
  return useContext(InteractionContext)
}

const TITULO_ALERTA: Record<Alerta["tipo"], string> = {
  fuga: "Posible fuga",
  consumo_excesivo: "Consumo excesivo",
  presion_baja: "Presión bajo umbral",
}
const SEVERIDAD: Record<Alerta["severidad"], string> = { alta: "Alta", media: "Media", baja: "Baja" }
const ESTADO_ALERTA: Record<EstadoAlerta, string> = {
  activa: "Activa",
  en_atencion: "En atención",
  resuelta: "Resuelta",
  falsa_alarma: "Falsa alarma",
}
const NOMBRE_ROL: Record<RolApi, string> = { gerencia: "Gerencia", mantenimiento: "Mantenimiento" }

const estaAbierta = (a: Alerta) => a.estado === "activa" || a.estado === "en_atencion"
const porcentaje = (confianza: number | null) => (confianza === null ? "—" : `${Math.round(confianza * 100)}%`)
const ubicacionAlerta = (a: Alerta) => {
  const lugar = a.pinza ? `${a.tuberia} · Pinza ${a.pinza}` : a.tuberia
  return a.posicion_estimada_m === null ? lugar : `${lugar} · ${a.posicion_estimada_m} m`
}
const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("")
const mensajeDe = (error: unknown) => (error instanceof Error ? error.message : "Ocurrió un error")
const tonoAlerta = (a: Alerta) => (!estaAbierta(a) ? "success" : a.severidad === "alta" ? "danger" : "warning")

function ultimaLectura(lecturas: Lectura[], tipo: Lectura["tipo"]) {
  return lecturas.find((l) => l.tipo === tipo) ?? null
}

function Dialog({ estado, onClose }: { estado: DialogState; onClose: () => void }) {
  const { kind, usuario, dispositivo } = estado
  const { notify, openDialog } = useInteractions()
  const { alertas, lecturas, umbrales, dispositivos, recargarAlertas, recargarUsuarios, ahora } = useDatos()
  // Se lee de la lista viva: mientras el diálogo está abierto llegan correos y confirmaciones.
  const alerta = alertas.find((a) => a.id_alerta === estado.alerta?.id_alerta) ?? estado.alerta
  const [comentario, setComentario] = useState("")
  const [atenciones, setAtenciones] = useState<Atencion[]>([])
  const [rangoExport, setRangoExport] = useState("7")
  const [ocupado, setOcupado] = useState(false)
  const [editando, setEditando] = useState(false)

  useEffect(() => {
    if (kind === "alert" && alerta) void api.atenciones(alerta.id_alerta).then(setAtenciones).catch(() => setAtenciones([]))
  }, [kind, alerta?.id_alerta, alerta?.estado])

  const submit = (message: string) => {
    notify(message)
    onClose()
  }
  const ejecutar = async (trabajo: () => Promise<unknown>, exito: string) => {
    setOcupado(true)
    try {
      await trabajo()
      submit(exito)
    } catch (error) {
      notify(mensajeDe(error))
    } finally {
      setOcupado(false)
    }
  }

  const presion = ultimaLectura(lecturas, "presion")
  const tuberia = umbrales?.tuberias[0]
  const alertasExport = alertas.filter((a) => rangoExport === "todo" || ahora - new Date(a.detectada_en).getTime() <= Number(rangoExport) * 86_400_000)

  const descargarCsv = () => {
    const columnas = ["codigo", "tipo", "severidad", "estado", "tuberia", "pinza", "confianza", "detectada_en", "cerrada_en", "correos_enviados", "acciones"]
    const celda = (valor: unknown) => `"${String(valor ?? "").replace(/"/g, '""')}"`
    const filas = alertasExport.map((a) =>
      [codigoAlerta(a.id_alerta), a.tipo, a.severidad, a.estado, a.tuberia, a.pinza, a.confianza, a.detectada_en, a.cerrada_en, a.correos_enviados, a.acciones].map(celda).join(","),
    )
    const enlace = document.createElement("a")
    enlace.href = URL.createObjectURL(new Blob([[columnas.join(","), ...filas].join("\n")], { type: "text/csv;charset=utf-8" }))
    enlace.download = "alertas-hydrosense.csv"
    enlace.click()
    URL.revokeObjectURL(enlace.href)
    submit("Reporte CSV generado correctamente")
  }

  const atender = (nuevo: EstadoAlerta, exito: string) =>
    alerta &&
    ejecutar(async () => {
      await api.atenderAlerta(alerta.id_alerta, nuevo, comentario.trim() || undefined)
      await recargarAlertas()
    }, exito)

  const headings: Record<DialogKind, { title: string; subtitle: string }> = {
    notifications: {
      title: "Notificaciones",
      subtitle: "Novedades que requieren tu atención",
    },
    analysis: {
      title: "Análisis de detección",
      subtitle: alerta ? `${codigoAlerta(alerta.id_alerta)} · Detección automática` : "",
    },
    site: {
      title: "Sitio activo",
      subtitle: "Instalación que se está monitoreando",
    },
    device: {
      title: "Agregar dispositivo",
      subtitle: "Registra un nuevo equipo en HydroSense",
    },
    deviceActions: {
      title: "Opciones del dispositivo",
      subtitle: dispositivo ?? "",
    },
    export: {
      title: "Exportar alertas",
      subtitle: "Descarga el historial filtrado",
    },
    alert: {
      title: "Detalle de alerta",
      subtitle: alerta ? `${codigoAlerta(alerta.id_alerta)} · ${TITULO_ALERTA[alerta.tipo]}` : "",
    },
    invite: {
      title: "Invitar usuario",
      subtitle: "Otorga acceso al equipo de HydroSense",
    },
    userActions: {
      title: "Administrar usuario",
      subtitle: usuario ? `${usuario.nombre} · ${NOMBRE_ROL[usuario.rol]}` : "",
    },
  }

  return (
    <div className="modal-layer" role="presentation">
      <button
        className="modal-scrim"
        onClick={onClose}
        aria-label="Cerrar ventana"
      />
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="modal__head">
          <div>
            <h2 id="dialog-title">{headings[kind].title}</h2>
            <p>{headings[kind].subtitle}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>

        {kind === "notifications" && (
          <div className="notification-list">
            {alertas.filter(estaAbierta).slice(0, 3).map((a) => (
              <button key={a.id_alerta} onClick={() => openDialog("alert", { alerta: a })}>
                <span className={`event-dot event-dot--${tonoAlerta(a)}`}>
                  <Icon name="alerts" size={16} />
                </span>
                <span>
                  <b>{TITULO_ALERTA[a.tipo]}</b>
                  <small>
                    {ubicacionAlerta(a)} · {haceCuanto(a.detectada_en, ahora)}
                  </small>
                </span>
                <Icon name="chevron" size={16} />
              </button>
            ))}
            {alertas.filter(estaAbierta).length === 0 && <p className="modal-link">Sin alertas abiertas</p>}
          </div>
        )}

        {kind === "analysis" && alerta && (
          <div className="analysis-detail">
            <div className="confidence-ring">
              <strong>{porcentaje(alerta.confianza)}</strong>
              <small>certeza</small>
            </div>
            <div className="analysis-copy">
              <span className="badge badge--warning">{TITULO_ALERTA[alerta.tipo]}</span>
              <h3>{alerta.detecciones} detecciones vinculadas</h3>
              <p>{ubicacionAlerta(alerta)}</p>
            </div>
            <dl>
              <div>
                <dt>Ubicación estimada</dt>
                <dd>{alerta.posicion_estimada_m === null ? "Calculando ubicación" : `${alerta.posicion_estimada_m} m`}</dd>
              </div>
              <div>
                <dt>Presión</dt>
                <dd>{presion?.valor == null ? "Sin dato" : `${kpaABar(presion.valor)} bar`}</dd>
              </div>
              <div>
                <dt>Pinza de origen</dt>
                <dd>{alerta.pinza ? `Pinza ${alerta.pinza}` : "—"}</dd>
              </div>
              <div>
                <dt>Versión del detector</dt>
                <dd>{alerta.version_modelo ?? "—"}</dd>
              </div>
            </dl>
            <button className="primary-btn modal-primary" disabled>
              <Icon name="activity" /> Audio de la señal no disponible
            </button>
          </div>
        )}

        {kind === "site" && (
          <div className="option-list">
            <button className="selected" onClick={onClose}>
              <span>
                <b>{tuberia?.nombre ?? "Sin tubería registrada"}</b>
                <small>{dispositivos?.dispositivos.length ?? 0} equipos conectados · Sitio principal</small>
              </span>
              <Icon name="check" />
            </button>
          </div>
        )}

        {kind === "device" && (
          <form className="modal-form" onSubmit={(event) => event.preventDefault()}>
            <div className="export-summary">
              <Icon name="devices" />
              <span>
                <b>Registro desde el panel no disponible</b>
                <small>Los equipos se configuran durante la instalación del sistema.</small>
              </span>
            </div>
            <button className="primary-btn modal-primary" type="submit" disabled>
              <Icon name="plus" />
              Agregar dispositivo
            </button>
          </form>
        )}

        {kind === "deviceActions" && (
          <div className="action-menu">
            <button disabled>
              <Icon name="wifi" />
              <span>
                <b>Probar conexión</b>
                <small>No disponible por ahora</small>
              </span>
            </button>
            <button disabled>
              <Icon name="settings" />
              <span>
                <b>Editar configuración</b>
                <small>No disponible por ahora</small>
              </span>
            </button>
            <button className="danger-action" disabled>
              <Icon name="close" />
              <span>
                <b>Desactivar</b>
                <small>No disponible por ahora</small>
              </span>
            </button>
          </div>
        )}

        {kind === "export" && (
          <form
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault()
              descargarCsv()
            }}
          >
            <label>
              Rango de fechas
              <select value={rangoExport} onChange={(event) => setRangoExport(event.target.value)}>
                <option value="7">Últimos 7 días</option>
                <option value="30">Últimos 30 días</option>
                <option value="todo">Todo el historial</option>
              </select>
            </label>
            <label>
              Formato
              <select>
                <option>CSV</option>
              </select>
            </label>
            <div className="export-summary">
              <Icon name="download" />
              <span>
                <b>{alertasExport.length} alertas encontradas</b>
                <small>Incluye correos enviados y número de acciones</small>
              </span>
            </div>
            <button className="primary-btn modal-primary" type="submit" disabled={alertasExport.length === 0}>
              Generar archivo
            </button>
          </form>
        )}

        {kind === "alert" && alerta && (
          <div className="alert-detail">
            <div className="detail-status">
              <span className={`alert-status ${ESTADO_ALERTA[alerta.estado].replace(" ", "-").toLowerCase()}`}>{ESTADO_ALERTA[alerta.estado]}</span>
              <span className={`severity-label ${alerta.severidad}`}>{SEVERIDAD[alerta.severidad]}</span>
              <small>{fechaLocal(alerta.detectada_en, ahora)}</small>
            </div>
            <div className="detail-location">
              <Icon name="flow" />
              <span>
                <small>UBICACIÓN</small>
                <b>{ubicacionAlerta(alerta)}</b>
              </span>
            </div>
            <div className="detail-timeline">
              <div className="done">
                <i>
                  <Icon name="check" size={13} />
                </i>
                <span>
                  <b>Alerta generada</b>
                  <small>
                    {alerta.tipo === "fuga"
                      ? `Posible fuga detectada (${porcentaje(alerta.confianza)} de certeza)`
                      : "Baja de presión continua"}
                  </small>
                </span>
              </div>
              <div className={alerta.acciones + alerta.correos_enviados > 0 ? "done" : ""}>
                <i>
                  {alerta.acciones + alerta.correos_enviados > 0 ? <Icon name="check" size={13} /> : 2}
                </i>
                <span>
                  <b>Respuesta automática</b>
                  <small>
                    {alerta.acciones} acciones de alarma · {alerta.correos_enviados} correos enviados
                  </small>
                </span>
              </div>
              {atenciones.map((a) => (
                <div className="done" key={a.id_atencion}>
                  <i>
                    <Icon name="check" size={13} />
                  </i>
                  <span>
                    <b>
                      {ESTADO_ALERTA[a.estado]} · {a.usuario}
                    </b>
                    <small>
                      {a.comentario ? `${a.comentario} · ` : ""}
                      {fechaLocal(a.fecha_hora, ahora)}
                    </small>
                  </span>
                </div>
              ))}
            </div>
            {estaAbierta(alerta) && (
              <div className="modal-form">
                <label>
                  Comentario
                  <input value={comentario} maxLength={500} onChange={(event) => setComentario(event.target.value)} placeholder="Opcional" />
                </label>
                {alerta.estado === "activa" && (
                  <button className="primary-btn modal-primary" disabled={ocupado} onClick={() => atender("en_atencion", "Alerta en atención")}>
                    Atender alerta
                  </button>
                )}
                <button className="primary-btn modal-primary" disabled={ocupado} onClick={() => atender("resuelta", "Alerta resuelta")}>
                  Marcar como resuelta
                </button>
                <button className="secondary-btn modal-primary" disabled={ocupado} onClick={() => atender("falsa_alarma", "Alerta marcada como falsa alarma")}>
                  Falsa alarma
                </button>
              </div>
            )}
          </div>
        )}

        {kind === "invite" && (
          <form
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault()
              const campos = new FormData(event.currentTarget)
              void ejecutar(async () => {
                await api.crearUsuario({
                  nombre: String(campos.get("nombre")),
                  correo: String(campos.get("correo")),
                  password: String(campos.get("password")),
                  rol: campos.get("rol") as RolApi,
                })
                await recargarUsuarios()
              }, "Usuario creado")
            }}
          >
            <label>
              Nombre completo
              <input name="nombre" required placeholder="Nombre del integrante" />
            </label>
            <label>
              Correo electrónico
              <input name="correo" required type="email" placeholder="nombre@empresa.com" />
            </label>
            <label>
              Contraseña inicial
              <input name="password" required type="password" minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
            </label>
            <label>
              Rol
              <select name="rol" defaultValue="mantenimiento">
                <option value="mantenimiento">Mantenimiento</option>
                <option value="gerencia">Gerencia</option>
              </select>
            </label>
            <button className="primary-btn modal-primary" type="submit" disabled={ocupado}>
              <Icon name="mail" />
              Crear usuario
            </button>
          </form>
        )}

        {kind === "userActions" && usuario && !editando && (
          <div className="action-menu">
            <button onClick={() => setEditando(true)}>
              <Icon name="users" />
              <span>
                <b>Editar perfil</b>
                <small>Nombre, correo y rol</small>
              </span>
            </button>
            <button disabled>
              <Icon name="mail" />
              <span>
                <b>Notificaciones</b>
                <small>Todos los usuarios activos reciben avisos por correo</small>
              </span>
            </button>
            <button
              className="danger-action"
              disabled={ocupado}
              onClick={() =>
                ejecutar(async () => {
                  await api.editarUsuario(usuario.id_usuario, { activo: !usuario.activo })
                  await recargarUsuarios()
                }, usuario.activo ? "Acceso de usuario desactivado" : "Acceso de usuario activado")
              }
            >
              <Icon name={usuario.activo ? "close" : "check"} />
              <span>
                <b>{usuario.activo ? "Desactivar acceso" : "Activar acceso"}</b>
                <small>El historial se conservará</small>
              </span>
            </button>
          </div>
        )}

        {kind === "userActions" && usuario && editando && (
          <form
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault()
              const campos = new FormData(event.currentTarget)
              void ejecutar(async () => {
                await api.editarUsuario(usuario.id_usuario, {
                  nombre: String(campos.get("nombre")),
                  correo: String(campos.get("correo")),
                  rol: campos.get("rol") as RolApi,
                })
                await recargarUsuarios()
              }, "Usuario actualizado")
            }}
          >
            <label>
              Nombre completo
              <input name="nombre" required defaultValue={usuario.nombre} />
            </label>
            <label>
              Correo electrónico
              <input name="correo" required type="email" defaultValue={usuario.correo} />
            </label>
            <label>
              Rol
              <select name="rol" defaultValue={usuario.rol}>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="gerencia">Gerencia</option>
              </select>
            </label>
            <button className="primary-btn modal-primary" type="submit" disabled={ocupado}>
              Guardar cambios
            </button>
          </form>
        )}
      </section>
    </div>
  )
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0 }}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

const nav = [
  { id: "overview", label: "Resumen", icon: "overview" as IconName },
  { id: "devices", label: "Dispositivos", icon: "devices" as IconName },
  { id: "alerts", label: "Alertas", icon: "alerts" as IconName },
  { id: "thresholds", label: "Umbrales", icon: "thresholds" as IconName },
  { id: "users", label: "Usuarios", icon: "users" as IconName },
]

function titulosDe(nombreTuberia: string): Record<string, { title: string; subtitle: string }> {
  return {
    overview: {
      title: "Monitoreo en vivo",
      subtitle: `Estado general de la tubería · ${nombreTuberia}`,
    },
    devices: {
      title: "Dispositivos",
      subtitle: "Estado de sensores, pinzas y equipos",
    },
    alerts: {
      title: "Centro de alertas",
      subtitle: "Avisos de posibles fugas y anomalías",
    },
    thresholds: {
      title: "Umbrales",
      subtitle: "Ajusta cuándo debe avisarte el sistema",
    },
    users: {
      title: "Usuarios",
      subtitle: "Personas con acceso y avisos por correo",
    },
    debug: {
      title: "Depuración",
      subtitle: "Datos crudos, estado MQTT y calidad de cada sensor",
    },
  }
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      {compact ? (
        <img src="/hydrosense-icon.svg" alt="HydroSense" className="brand__icon" />
      ) : (
        <img src="/hydrosense-horizontal-dark.svg" alt="HydroSense" className="brand__horizontal" />
      )}
    </div>
  )
}

function Sidebar({
  page,
  setPage,
  open,
  onClose,
  role,
  onLogout,
}: {
  page: string
  setPage: (p: string) => void
  open: boolean
  onClose: () => void
  role: Rol
  onLogout: () => void
}) {
  const { openDialog } = useInteractions()
  const { sesion, alertas, umbrales, dispositivos, conectado, ahora, lecturas } = useDatos()
  const abiertas = alertas.filter(estaAbierta).length
  const visibleNav =
    role === "manager"
      ? nav
      : nav.filter((item) => !["thresholds", "users"].includes(item.id))
  const navigate = (id: string) => {
    setPage(id)
    onClose()
  }
  const enLinea = dispositivos?.dispositivos.filter((d) => d.estado === "online").length ?? 0
  const total = dispositivos?.dispositivos.length ?? 0
  const operativo = conectado && Boolean(dispositivos?.mqtt_conectado) && total > 0 && enLinea === total
  const ultima = lecturas.map((l) => l.fecha_hora).sort().at(-1) ?? null
  return (
    <>
      {open && (
        <button className="scrim" aria-label="Cerrar menú" onClick={onClose} />
      )}
      <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
        <div className="sidebar__top">
          <Logo />
          <button
            className="icon-btn sidebar__close"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <Icon name="close" />
          </button>
        </div>
        <button className="site-pill" onClick={() => openDialog("site")}>
          <span className="site-pill__icon">
            <Icon name="flow" size={18} />
          </span>
          <span>
            <small>Sitio activo</small>
            <b>{umbrales?.tuberias[0]?.nombre ?? "—"}</b>
          </span>
          <Icon name="chevron" size={16} />
        </button>
        <nav className="nav-list" aria-label="Navegación principal">
          <p>OPERACIÓN</p>
          {visibleNav.slice(0, 3).map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === "alerts" && abiertas > 0 && <em>{abiertas}</em>}
            </button>
          ))}
          {role === "manager" && (
            <>
              <p>ADMINISTRACIÓN</p>
              {visibleNav.slice(3).map((item) => (
                <button
                  key={item.id}
                  className={page === item.id ? "active" : ""}
                  onClick={() => navigate(item.id)}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </button>
              ))}
            </>
          )}
        </nav>
        <div className="sidebar__status">
          <div className="status-orb">
            <span />
          </div>
          <div>
            <b>{operativo ? "Sistema funcionando bien" : "Problema de conexión"}</b>
            <small>Última lectura: {haceCuanto(ultima, ahora).toLowerCase()}</small>
          </div>
        </div>
        <button className="profile" onClick={onLogout} aria-label="Cerrar sesión">
          <span className="avatar">{iniciales(sesion.usuario.nombre)}</span>
          <span>
            <b>{sesion.usuario.nombre}</b>
            <small>{NOMBRE_ROL[sesion.usuario.rol]} · Cerrar sesión</small>
          </span>
          <Icon name="chevron" size={18} />
        </button>
      </aside>
    </>
  )
}

function Header({
  page,
  onMenu,
  role,
}: {
  page: string
  onMenu: () => void
  role: Rol
}) {
  const { openDialog } = useInteractions()
  const { alertas, conectado, sesion, umbrales } = useDatos()
  const abiertas = alertas.filter(estaAbierta).length
  const heading =
    page === "overview" && role === "maintenance"
      ? {
          title: "Trabajo de campo",
          subtitle: "Incidentes abiertos y estado del sistema",
        }
      : titulosDe(umbrales?.tuberias[0]?.nombre ?? "—")[page]
  return (
    <header className="header">
      <button
        className="icon-btn menu-btn"
        onClick={onMenu}
        aria-label="Abrir menú"
      >
        <Icon name="menu" />
      </button>
      <div className="header__title">
        <h1>{heading.title}</h1>
        <p>{heading.subtitle}</p>
      </div>
      <div className="header__actions">
        <span className="live-pill">
          <i /> {conectado ? "En vivo" : "Sin conexión"}
        </span>
        <button
          className="icon-btn notification"
          aria-label="Notificaciones"
          onClick={() => openDialog("notifications")}
        >
          <Icon name="bell" />
          {abiertas > 0 && <i>{abiertas}</i>}
        </button>
        <span className="avatar avatar--mobile">{iniciales(sesion.usuario.nombre)}</span>
      </div>
    </header>
  )
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  note,
  tone = "cyan",
}: {
  icon: IconName
  label: string
  value: string
  unit: string
  note: string
  tone?: string
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-icon--${tone}`}>
        <Icon name={icon} />
      </div>
      <div className="metric-copy">
        <span>{label}</span>
        <strong>
          {value}
          <small>{unit}</small>
        </strong>
        <p>
          <i /> {note}
        </p>
      </div>
    </article>
  )
}

type Punto = { t: number; v: number | null }

const PERIODOS: Record<string, number> = { "30 min": 30, "1 h": 60, "6 h": 360 }
const MAX_PUNTOS_GRAFICA = 300
const CHART = { izquierda: 35, derecha: 720, arriba: 30, abajo: 230 }

function reducir(serie: Punto[]) {
  const paso = Math.ceil(serie.length / MAX_PUNTOS_GRAFICA)
  return paso <= 1 ? serie : serie.filter((_, i) => i % paso === 0 || i === serie.length - 1)
}

function trazar(serie: Punto[], desde: number, hasta: number) {
  const validos = serie.flatMap((p) => (p.v === null ? [] : [p.v]))
  if (validos.length === 0) return { linea: "", area: "", ultimo: null as null | { x: number; y: number } }
  const minimo = Math.min(...validos)
  const maximo = Math.max(...validos)
  const margen = Math.max((maximo - minimo) * 0.15, Math.abs(maximo) * 0.02, 0.5)
  const x = (t: number) => CHART.izquierda + ((t - desde) / (hasta - desde)) * (CHART.derecha - CHART.izquierda)
  const y = (v: number) => CHART.abajo - ((v - (minimo - margen)) / (maximo - minimo + 2 * margen)) * (CHART.abajo - CHART.arriba)
  // Una lectura sin dato o un corte en los mensajes deja un hueco: la línea no inventa valores.
  const huecoMs = Math.max(5_000, ((hasta - desde) / MAX_PUNTOS_GRAFICA) * 3)
  const tramos: { x: number; y: number }[][] = []
  let anterior: number | null = null
  for (const p of serie) {
    if (p.v === null) {
      anterior = null
      continue
    }
    if (anterior === null || p.t - anterior > huecoMs) tramos.push([])
    tramos.at(-1)!.push({ x: x(p.t), y: y(p.v) })
    anterior = p.t
  }
  const trazo = (tramo: { x: number; y: number }[]) => tramo.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" ")
  return {
    linea: tramos.map(trazo).join(" "),
    area: tramos.map((t) => `${trazo(t)} L${t.at(-1)!.x.toFixed(1)} ${CHART.abajo} L${t[0]!.x.toFixed(1)} ${CHART.abajo}Z`).join(" "),
    ultimo: tramos.at(-1)?.at(-1) ?? null,
  }
}

function LiveChart() {
  const [period, setPeriod] = useState("30 min")
  const { alRecibirLectura, ahora } = useDatos()
  const [presion, setPresion] = useState<Punto[]>([])
  const [temperatura, setTemperatura] = useState<Punto[]>([])
  const ventanaMs = PERIODOS[period]! * 60_000

  useEffect(() => {
    let vigente = true
    const hasta = new Date()
    const desde = new Date(hasta.getTime() - ventanaMs)
    const aPuntos = (filas: Lectura[]): Punto[] => filas.map((f) => ({ t: new Date(f.fecha_hora).getTime(), v: f.valor }))
    void Promise.all([api.lecturas("presion", desde, hasta), api.lecturas("temperatura", desde, hasta)]).then(([p, t]) => {
      if (!vigente) return
      setPresion(aPuntos(p))
      setTemperatura(aPuntos(t))
    })
    const quitar = alRecibirLectura((lectura) => {
      const punto = { t: new Date(lectura.fecha_hora).getTime(), v: lectura.valor }
      if (lectura.tipo === "presion") setPresion((serie) => [...serie, punto])
      if (lectura.tipo === "temperatura") setTemperatura((serie) => [...serie, punto])
    })
    return () => {
      vigente = false
      quitar()
    }
  }, [ventanaMs, alRecibirLectura])

  const desde = ahora - ventanaMs
  const dentro = (serie: Punto[]) => reducir(serie.filter((p) => p.t >= desde))
  const trazoPresion = trazar(dentro(presion), desde, ahora)
  const trazoTemperatura = trazar(dentro(temperatura), desde, ahora)

  return (
    <section className="panel chart-panel">
      <div className="panel__head">
        <div>
          <h2>Lecturas en tiempo real</h2>
          <p>Pinza A · Últimos {period}</p>
        </div>
        <div className="segmented">
          {Object.keys(PERIODOS).map((item) => (
            <button
              key={item}
              className={period === item ? "active" : ""}
              onClick={() => setPeriod(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="legend">
        <span>
          <i className="pressure" />
          Presión
        </span>
        <span>
          <i className="temperature" />
          Temperatura
        </span>
        <span>
          <i className="flow" />
          Caudal (sin sensor)
        </span>
      </div>
      <div className="chart-wrap">
        <svg
          viewBox="0 0 740 240"
          preserveAspectRatio="none"
          role="img"
          aria-label="Gráfica de presión y temperatura"
        >
          {[30, 80, 130, 180, 230].map((y) => (
            <line
              key={y}
              x1="35"
              y1={y}
              x2="720"
              y2={y}
              className="grid-line"
            />
          ))}
          {trazoPresion.area && <path className="chart-area" d={trazoPresion.area} />}
          {trazoPresion.linea && <path className="line pressure-line" d={trazoPresion.linea} />}
          {trazoTemperatura.linea && <path className="line temp-line" d={trazoTemperatura.linea} />}
          {trazoPresion.ultimo && <circle cx={trazoPresion.ultimo.x} cy={trazoPresion.ultimo.y} r="5" className="point" />}
        </svg>
        <div className="chart-labels">
          <span>{horaLocal(desde)}</span>
          <span>{horaLocal(desde + ventanaMs / 3)}</span>
          <span>{horaLocal(desde + (2 * ventanaMs) / 3)}</span>
          <span>Ahora</span>
        </div>
      </div>
    </section>
  )
}

function Pipeline() {
  const { openDialog } = useInteractions()
  const { alertas, umbrales, ahora } = useDatos()
  const tuberia = umbrales?.tuberias[0]
  const pinzaA = umbrales?.pinzas.find((p) => p.nombre === "A")
  const pinzaB = umbrales?.pinzas.find((p) => p.nombre === "B")
  const fuga = alertas.find((a) => a.tipo === "fuga" && estaAbierta(a))
  const atencion = alertas.some(estaAbierta)
  return (
    <section className="panel pipeline-panel">
      <div className="panel__head">
        <div>
          <h2>Estado del tramo</h2>
          <p>
            {tuberia ? `${tuberia.nombre} · ${tuberia.material.toUpperCase()} · ${tuberia.longitud_m} m` : "—"}
          </p>
        </div>
        <span className={`badge ${atencion ? "badge--warning" : "badge--success"}`}>{atencion ? "Requiere atención" : "Sin alertas"}</span>
      </div>
      <div className="pipe-visual">
        <div className="pipe-line" />
        <div className="pipe-node start">
          <span>
            <Icon name="flow" size={17} />
          </span>
          <small>Entrada</small>
        </div>
        <div className="pipe-node sensor sensor-a">
          <span>A</span>
          <small>{pinzaA ? `${pinzaA.posicion_m} m` : "—"}</small>
        </div>
        {fuga && (
          <div className="leak-zone">
            <div className="leak-pulse">
              <Icon name="alerts" size={18} />
            </div>
            <b>Posible fuga</b>
            <small>{fuga.posicion_estimada_m === null ? "Calculando ubicación" : `A ${fuga.posicion_estimada_m} m`}</small>
          </div>
        )}
        <div className="pipe-node sensor sensor-b">
          <span>B</span>
          <small>{pinzaB ? `${pinzaB.posicion_m} m` : "—"}</small>
        </div>
        <div className="pipe-node end">
          <span>
            <Icon name="valve" size={17} />
          </span>
          <small>Válvula</small>
        </div>
      </div>
      <div className="pipeline-note">
        <Icon name="activity" size={18} />
        <span>
          <b>{fuga ? `Certeza de detección: ${porcentaje(fuga.confianza)}` : "Sin fugas detectadas"}</b>
          <small>{fuga ? `Detectada ${haceCuanto(fuga.detectada_en, ahora).toLowerCase()}` : "Todo el tramo funciona con normalidad"}</small>
        </span>
        {fuga && <button onClick={() => openDialog("analysis", { alerta: fuga })}>Ver análisis</button>}
      </div>
    </section>
  )
}

function EventsPanel({ goAlerts }: { goAlerts: () => void }) {
  const { alertas, ahora } = useDatos()
  return (
    <section className="panel events-panel">
      <div className="panel__head">
        <div>
          <h2>Actividad reciente</h2>
          <p>Alertas del sistema</p>
        </div>
        <button className="text-btn" onClick={goAlerts}>
          Ver todo <Icon name="chevron" size={15} />
        </button>
      </div>
      <div className="event-list">
        {alertas.slice(0, 4).map((a) => (
          <div className="event-item" key={a.id_alerta}>
            <span className={`event-dot event-dot--${tonoAlerta(a)}`}>
              <Icon name={estaAbierta(a) ? "alerts" : "check"} size={16} />
            </span>
            <div>
              <b>{TITULO_ALERTA[a.tipo]}</b>
              <p>
                {ubicacionAlerta(a)}
                {a.confianza === null ? "" : ` · Certeza ${porcentaje(a.confianza)}`}
              </p>
              <small>
                {ESTADO_ALERTA[a.estado]} · {haceCuanto(a.detectada_en, ahora)}
              </small>
            </div>
          </div>
        ))}
        {alertas.length === 0 && (
          <div className="event-item">
            <span className="event-dot event-dot--success">
              <Icon name="check" size={16} />
            </span>
            <div>
              <b>Sin alertas registradas</b>
              <p>El sistema no ha generado eventos</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

const COLOR_TORRETA: Record<string, string> = { rojo: "var(--red-500)", amarillo: "#f5b83d", verde: "var(--green-500)" }
const TEXTO_TORRETA: Record<string, string> = { rojo: "Rojo · Alerta", amarillo: "Amarillo · Precaución", verde: "Verde · Normal" }

function textoConfirmacion(actuador: Actuador | undefined) {
  if (!actuador?.id_accion) return "Sin cambios recientes"
  return actuador.confirmada_en ? "Cambio aplicado" : "Aplicando cambio..."
}

function Actuators() {
  const { actuadores, dispositivos, recargarActuadores } = useDatos()
  const { notify } = useInteractions()
  const [enviando, setEnviando] = useState(false)
  const valvula = actuadores.find((a) => a.tipo === "valvula")
  const sirena = actuadores.find((a) => a.tipo === "sirena")
  const torreta = actuadores.find((a) => a.tipo === "torreta")
  const sirenOn = sirena?.comando === "encender"
  const conectados = dispositivos?.dispositivos.find((d) => d.tipo === "actuacion")?.estado === "online"

  const alternarSirena = async () => {
    if (!sirena) return
    setEnviando(true)
    try {
      await api.comando(sirena.id_actuador, sirenOn ? "apagar" : "encender")
      await recargarActuadores()
    } catch (error) {
      notify(mensajeDe(error))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="panel actuators">
      <div className="panel__head">
        <div>
          <h2>Actuadores</h2>
          <p>Estado de la válvula, sirena y torreta</p>
        </div>
        <span className={`badge ${conectados ? "badge--success" : "badge--warning"}`}>{conectados ? "Conectados" : "Sin conexión"}</span>
      </div>
      <div className="actuator-grid">
        <div className="actuator">
          <span className="actuator__icon danger">
            <Icon name="valve" />
          </span>
          <div>
            <small>{valvula?.nombre ?? "Válvula"}</small>
            <b>{valvula?.comando === "cerrar" ? "Cerrada" : valvula?.comando === "abrir" ? "Abierta" : "Abierta (normal)"}</b>
          </div>
          <span className="readonly-state">
            <i /> Solo consulta
          </span>
        </div>
        <div className="actuator">
          <span className="actuator__icon warning">
            <Icon name="siren" />
          </span>
          <div>
            <small>Sirena · {textoConfirmacion(sirena)}</small>
            <b>{sirenOn ? "Activada" : "Desactivada"}</b>
          </div>
          <button
            className={`switch ${sirenOn ? "on warning" : ""}`}
            onClick={alternarSirena}
            disabled={enviando || !sirena}
            aria-label="Alternar sirena"
          >
            <i />
          </button>
        </div>
        <div className="actuator">
          <span className="actuator__icon danger">
            <Icon name="tower" />
          </span>
          <div>
            <small>Torreta · {textoConfirmacion(torreta)}</small>
            <b>{torreta?.comando ? TEXTO_TORRETA[torreta.comando] : "Apagada"}</b>
          </div>
          <span className="color-dot" style={torreta?.comando ? { background: COLOR_TORRETA[torreta.comando] } : { background: "var(--line)" }} />
        </div>
      </div>
    </section>
  )
}

/** Valor y nota de una tarjeta de medición: un sensor sin señal nunca se muestra como si tuviera dato. */
function medicionTarjeta(lectura: Lectura | null, formato: (valor: number) => string, notaOk: (valor: number) => string) {
  if (!lectura) return { value: "—", note: "Sin lecturas" }
  if (lectura.valor === null || lectura.calidad !== "ok") return { value: "—", note: TEXTO_CALIDAD[lectura.calidad] }
  return { value: formato(lectura.valor), note: notaOk(lectura.valor) }
}

function Overview({ setPage }: { setPage: (p: string) => void }) {
  const { lecturas, dispositivos, alertas, umbrales } = useDatos()
  const principal = alertas.find((a) => a.estado === "activa")
  const umbralPresion = umbrales?.pinzas.find((p) => p.nombre === "A")?.umbral_presion_kpa ?? null
  const presion = medicionTarjeta(ultimaLectura(lecturas, "presion"), kpaABar, (valor) => {
    if (umbralPresion === null || umbralPresion === 0) return "Sin límite configurado"
    const diferencia = Math.round((Math.abs(valor - umbralPresion) / umbralPresion) * 100)
    return `${diferencia}% ${valor < umbralPresion ? "por debajo" : "por encima"} del límite`
  })
  const temperatura = medicionTarjeta(ultimaLectura(lecturas, "temperatura"), (valor) => valor.toFixed(1), () => "Lectura normal")
  const lista = dispositivos?.dispositivos ?? []
  return (
    <>
      {principal && (
        <div className="alert-banner">
          <span>
            <Icon name="alerts" />
          </span>
          <div>
            <b>
              {TITULO_ALERTA[principal.tipo]} en {principal.tuberia}
            </b>
            <p>
              {codigoAlerta(principal.id_alerta)} · Revisa la alerta para confirmar el incidente.
            </p>
          </div>
          <button onClick={() => setPage("alerts")}>Atender alerta</button>
        </div>
      )}
      <div className="metrics-grid">
        <MetricCard
          icon="activity"
          label="Presión"
          value={presion.value}
          unit="bar"
          note={presion.note}
          tone="blue"
        />
        <MetricCard
          icon="temperature"
          label="Temperatura"
          value={temperatura.value}
          unit="°C"
          note={temperatura.note}
          tone="purple"
        />
        <MetricCard
          icon="flow"
          label="Caudal"
          value="—"
          unit="L/min"
          note="Sensor no instalado"
          tone="cyan"
        />
        <MetricCard
          icon="wifi"
          label="Conectividad"
          value={`${lista.filter((d) => d.estado === "online").length}/${lista.length}`}
          unit=""
          note="Dispositivos en línea"
          tone="green"
        />
      </div>
      <div className="dashboard-grid">
        <LiveChart />
        <EventsPanel goAlerts={() => setPage("alerts")} />
        <Pipeline />
        <Actuators />
      </div>
    </>
  )
}

function MaintenanceOverview({ setPage }: { setPage: (p: string) => void }) {
  const [step, setStep] = useState(1)
  const { alertas, lecturas, actuadores, umbrales, ahora } = useDatos()
  const { openDialog } = useInteractions()
  const abiertas = alertas.filter(estaAbierta)
  const prioridad = { alta: 0, media: 1, baja: 2 }
  const ordenadas = [...abiertas].sort((a, b) => prioridad[a.severidad] - prioridad[b.severidad])
  const principal = ordenadas[0]
  const siguientes = ordenadas.slice(1, 3)
  const resueltasHoy = alertas.filter((a) => a.estado === "resuelta" && a.cerrada_en && mismoDia(a.cerrada_en, ahora))
  const promedioMin = resueltasHoy.length
    ? Math.round(resueltasHoy.reduce((suma, a) => suma + (new Date(a.cerrada_en!).getTime() - new Date(a.detectada_en).getTime()), 0) / resueltasHoy.length / 60_000)
    : null
  const tuberia = umbrales?.tuberias[0]
  const lecturaPresion = ultimaLectura(lecturas, "presion")
  const umbralPresion = umbrales?.pinzas.find((p) => p.nombre === "A")?.umbral_presion_kpa ?? null
  const presionValida = lecturaPresion?.calidad === "ok" ? lecturaPresion.valor : null
  const presionBaja = presionValida !== null && umbralPresion !== null && presionValida < umbralPresion
  const sirena = actuadores.find((a) => a.tipo === "sirena")
  const torreta = actuadores.find((a) => a.tipo === "torreta")
  const senalizacion = sirena?.comando === "encender" || torreta?.comando === "rojo"
  const steps = [
    "Confirmar ubicación y asegurar el área",
    "Inspeccionar el tramo entre pinzas",
    "Registrar evidencia y diagnóstico",
    "Confirmar reparación y normalizar el área",
  ]
  return (
    <>
      <div className="maintenance-hero">
        <div>
          <span className="eyebrow">
            <i /> {principal ? "INCIDENTE PRIORITARIO" : "SIN INCIDENTES"}
          </span>
          <h2>{principal ? `${TITULO_ALERTA[principal.tipo]} en ${principal.tuberia}` : "No hay alertas abiertas"}</h2>
          <p>
            {principal
              ? `Alerta ${codigoAlerta(principal.id_alerta)} · Detectada ${haceCuanto(principal.detectada_en, ahora).toLowerCase()}${principal.confianza === null ? "" : ` · Certeza ${porcentaje(principal.confianza)}`}`
              : "El sistema sigue monitoreando en vivo"}
          </p>
        </div>
        <button className="primary-btn" onClick={() => (principal ? openDialog("alert", { alerta: principal }) : setPage("alerts"))}>
          {principal ? "Abrir expediente" : "Ver alertas"} <Icon name="chevron" size={16} />
        </button>
      </div>

      <div className="maintenance-stats">
        <MetricCard
          icon="alerts"
          label="Activas"
          value={String(alertas.filter((a) => a.estado === "activa").length)}
          unit="alertas"
          note={`${abiertas.filter((a) => a.severidad === "alta").length} de severidad alta`}
          tone="blue"
        />
        <MetricCard
          icon="activity"
          label="En atención"
          value={String(alertas.filter((a) => a.estado === "en_atencion").length)}
          unit="incidentes"
          note="Atendidos por el equipo"
          tone="purple"
        />
        <MetricCard
          icon="check"
          label="Resueltas hoy"
          value={String(resueltasHoy.length)}
          unit=""
          note={promedioMin === null ? "Sin resoluciones hoy" : `Tiempo promedio: ${promedioMin} min`}
          tone="green"
        />
      </div>

      <div className="maintenance-grid">
        <section className="panel work-order">
          <div className="panel__head">
            <div>
              <h2>Orden de trabajo actual</h2>
              <p>Pasos recomendados para revisar en sitio</p>
            </div>
            <span className={`badge ${principal ? "badge--warning" : "badge--success"}`}>{principal ? ESTADO_ALERTA[principal.estado] : "Sin orden"}</span>
          </div>
          <div className="work-location">
            <span>
              <Icon name="flow" />
            </span>
            <div>
              <small>UBICACIÓN</small>
              <b>{principal ? ubicacionAlerta(principal) : "Sin incidente"}</b>
              <p>{tuberia ? `Tubería de ${tuberia.material.toUpperCase()} · Diámetro ${tuberia.diametro_mm} mm` : ""}</p>
            </div>
          </div>
          <div className="checklist">
            {steps.map((item, index) => (
              <button
                key={item}
                className={
                  index < step ? "complete" : index === step ? "current" : ""
                }
                onClick={() => setStep(Math.min(index + 1, steps.length))}
              >
                <i>
                  {index < step ? <Icon name="check" size={14} /> : index + 1}
                </i>
                <span>
                  <b>{item}</b>
                  <small>
                    {index < step
                      ? "Completado"
                      : index === step
                        ? "Siguiente paso"
                        : "Pendiente"}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <button
            className="primary-btn work-action"
            onClick={() => setStep(Math.min(step + 1, steps.length))}
            disabled={step === steps.length}
          >
            {step === steps.length ? (
              <>
                <Icon name="check" /> Inspección completada
              </>
            ) : (
              "Marcar paso como completado"
            )}
          </button>
        </section>

        <section className="panel live-diagnosis">
          <div className="panel__head">
            <div>
              <h2>Diagnóstico en vivo</h2>
              <p>Datos para validar en campo</p>
            </div>
            <span className="live-pill">
              <i /> En vivo
            </span>
          </div>
          <div className={`diagnosis-value ${presionBaja ? "danger" : ""}`}>
            <span>
              <Icon name="activity" />
            </span>
            <div>
              <small>Presión actual</small>
              <b>
                {presionValida === null ? "—" : kpaABar(presionValida)} <em>bar</em>
              </b>
            </div>
            <strong>
              {lecturaPresion && lecturaPresion.calidad !== "ok"
                ? TEXTO_CALIDAD[lecturaPresion.calidad]
                : presionValida !== null && umbralPresion
                  ? `${presionValida < umbralPresion ? "−" : "+"}${Math.round((Math.abs(presionValida - umbralPresion) / umbralPresion) * 100)}%`
                  : "—"}
            </strong>
          </div>
          <div className="diagnosis-value">
            <span>
              <Icon name="flow" />
            </span>
            <div>
              <small>Caudal actual</small>
              <b>
                — <em>L/min</em>
              </b>
            </div>
            <strong>Sin sensor</strong>
          </div>
          <div className="safety-state">
            <Icon name="shield" />
            <div>
              <b>{senalizacion ? "Señalización activa" : "Señalización apagada"}</b>
              <p>
                Sirena: {sirena?.comando === "encender" ? "encendida" : "apagada"} · Torreta: {torreta?.comando ?? "apagada"}
              </p>
            </div>
          </div>
        </section>

        <section className="panel assigned-list">
          <div className="panel__head">
            <div>
              <h2>Siguientes alertas</h2>
              <p>Ordenadas por severidad</p>
            </div>
            <button className="text-btn" onClick={() => setPage("alerts")}>
              Ver todas <Icon name="chevron" size={15} />
            </button>
          </div>
          {siguientes.map((a) => (
            <article key={a.id_alerta}>
              <span className={`event-dot event-dot--${tonoAlerta(a)}`}>
                <Icon name="alerts" size={16} />
              </span>
              <div>
                <b>{TITULO_ALERTA[a.tipo]}</b>
                <p>
                  {codigoAlerta(a.id_alerta)} · {a.tuberia}
                </p>
              </div>
              <small>{SEVERIDAD[a.severidad]}</small>
            </article>
          ))}
          {siguientes.length === 0 && (
            <article>
              <span className="event-dot event-dot--success">
                <Icon name="check" size={16} />
              </span>
              <div>
                <b>Nada más por atender</b>
                <p>Sin otras alertas abiertas</p>
              </div>
            </article>
          )}
        </section>
      </div>
    </>
  )
}

interface FilaDispositivo {
  name: string
  meta: string
  type: string
  last: string
  status: string
  aviso: boolean
}

const ESTADO_CONEXION: Record<string, string> = { online: "En línea", offline: "Sin conexión", desconocido: "Desconocido" }

function Devices() {
  const { openDialog } = useInteractions()
  const { dispositivos, vibracion, lecturas, actuadores, ahora } = useDatos()
  const [busqueda, setBusqueda] = useState("")
  const lista = dispositivos?.dispositivos ?? []
  const pinzas = dispositivos?.pinzas ?? []
  const adquisicion = lista.find((d) => d.tipo === "adquisicion")

  const filas: FilaDispositivo[] = [
    ...lista.map((d) => ({
      name: d.nombre,
      meta: `MAC · ${d.mac}`,
      type: d.tipo === "adquisicion" ? "Adquisición" : "Actuación",
      last: haceCuanto(d.ultima_conexion, ahora),
      status: ESTADO_CONEXION[d.estado] ?? d.estado,
      aviso: d.estado !== "online",
    })),
    ...pinzas.map((p) => {
      const vib = vibracion.find((v) => v.id_pinza === p.id_pinza)
      const propias = lecturas.filter((l) => l.id_pinza === p.id_pinza)
      const conFalla = [vib, ...propias].find((m) => m && m.calidad !== "ok")
      const conectada = adquisicion?.estado === "online"
      return {
        name: `Pinza ${p.nombre}`,
        meta: `${p.tuberia} · ${p.posicion_m} m`,
        type: "Sensor",
        last: haceCuanto(vib?.fecha_hora ?? null, ahora),
        status: !conectada ? "Sin conexión" : conFalla ? "Atención" : "En línea",
        aviso: !conectada || Boolean(conFalla),
      }
    }),
  ]
  const texto = busqueda.trim().toLowerCase()
  const visibles = texto ? filas.filter((f) => `${f.name} ${f.meta} ${f.type}`.toLowerCase().includes(texto)) : filas

  return (
    <section className="content-panel">
      <div className="toolbar">
        <div className="search">
          <Icon name="search" />
          <input placeholder="Buscar dispositivo..." value={busqueda} onChange={(event) => setBusqueda(event.target.value)} />
        </div>
        <button className="primary-btn" onClick={() => openDialog("device")}>
          <Icon name="plus" />
          Agregar dispositivo
        </button>
      </div>
      <div className="summary-strip">
        <div>
          <span className="summary-icon green">
            <Icon name="wifi" />
          </span>
          <b>{lista.filter((d) => d.activo).length}</b>
          <small>Dispositivos activos</small>
        </div>
        <div>
          <span className="summary-icon cyan">
            <Icon name="devices" />
          </span>
          <b>{pinzas.length}</b>
          <small>Pinzas instaladas</small>
        </div>
        <div>
          <span className="summary-icon purple">
            <Icon name="valve" />
          </span>
          <b>{actuadores.length}</b>
          <small>Actuadores</small>
        </div>
      </div>
      <div className="data-table">
        <div className="table-row table-head">
          <span>Dispositivo</span>
          <span>Tipo</span>
          <span>Última conexión</span>
          <span>Estado</span>
          <span />
        </div>
        {visibles.map((d) => (
          <div className="table-row" key={d.name}>
            <span className="device-name">
              <i>
                <Icon name={d.type === "Sensor" ? "activity" : "devices"} />
              </i>
              <span>
                <b>{d.name}</b>
                <small>{d.meta}</small>
              </span>
            </span>
            <span>{d.type}</span>
            <span>{d.last}</span>
            <span>
              <em className={d.aviso ? "status-warning" : "status-online"}>{d.status}</em>
            </span>
            <button
              className="icon-btn"
              onClick={() => openDialog("deviceActions", { dispositivo: `${d.name} · ${d.status}` })}
              aria-label={`Opciones de ${d.name}`}
            >
              <Icon name="more" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

const FILTRO_ALERTA: Record<string, EstadoAlerta | null> = {
  Todas: null,
  Activa: "activa",
  "En atención": "en_atencion",
  Resuelta: "resuelta",
}

function Alerts() {
  const [filter, setFilter] = useState("Todas")
  const { openDialog } = useInteractions()
  const { alertas, ahora, cargando } = useDatos()
  const shown = useMemo(
    () =>
      FILTRO_ALERTA[filter] === null
        ? alertas
        : alertas.filter((a) => a.estado === FILTRO_ALERTA[filter]),
    [filter, alertas],
  )
  return (
    <section className="content-panel">
      <div className="toolbar toolbar--wrap">
        <div className="filter-tabs">
          {Object.keys(FILTRO_ALERTA).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={filter === f ? "active" : ""}
            >
              {f}
            </button>
          ))}
        </div>
        <button className="secondary-btn" onClick={() => openDialog("export")}>
          <Icon name="download" />
          Exportar
        </button>
      </div>
      <div className="alerts-list">
        {shown.map((a) => (
          <article className="alert-row" key={a.id_alerta}>
            <span className={`alert-row__icon severity-${a.severidad}`}>
              <Icon name="alerts" />
            </span>
            <div className="alert-row__main">
              <span>
                <small>{codigoAlerta(a.id_alerta)}</small>
                <em className={`severity-label ${a.severidad}`}>{SEVERIDAD[a.severidad]}</em>
              </span>
              <b>{TITULO_ALERTA[a.tipo]}</b>
              <p>{ubicacionAlerta(a)}</p>
            </div>
            <div className="alert-row__meta">
              <em className={`alert-status ${ESTADO_ALERTA[a.estado].replace(" ", "-").toLowerCase()}`}>{ESTADO_ALERTA[a.estado]}</em>
              <small>{fechaLocal(a.detectada_en, ahora)}</small>
            </div>
            <button
              className="secondary-btn compact"
              onClick={() => openDialog("alert", { alerta: a })}
            >
              Ver detalle <Icon name="chevron" size={15} />
            </button>
          </article>
        ))}
        {!cargando && shown.length === 0 && <p>Sin alertas en este filtro.</p>}
      </div>
    </section>
  )
}

function Thresholds() {
  const [saved, setSaved] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const { notify } = useInteractions()
  const { umbrales, recargarUmbrales } = useDatos()
  const [valores, setValores] = useState<Record<number, { umbral_confianza: number; umbral_presion_kpa: number }>>({})
  const tuberia = umbrales?.tuberias[0]

  useEffect(() => {
    if (!umbrales) return
    setValores(Object.fromEntries(umbrales.pinzas.map((p) => [p.id_pinza, { umbral_confianza: p.umbral_confianza, umbral_presion_kpa: p.umbral_presion_kpa }])))
  }, [umbrales])

  const cambiar = (id: number, campo: "umbral_confianza" | "umbral_presion_kpa", valor: number) =>
    setValores((previos) => ({ ...previos, [id]: { ...previos[id]!, [campo]: valor } }))

  const guardar = async () => {
    setGuardando(true)
    try {
      await api.guardarUmbrales(Object.entries(valores).map(([id, v]) => ({ id_pinza: Number(id), ...v })))
      await recargarUmbrales()
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch (error) {
      notify(mensajeDe(error))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="settings-grid">
      {umbrales?.pinzas.map((p, i) => {
        const valor = valores[p.id_pinza]
        if (!valor) return null
        return (
          <section className="content-panel settings-card" key={p.id_pinza}>
            <div className="settings-card__head">
              <span className={`summary-icon ${i === 0 ? "cyan" : "purple"}`}>
                <Icon name="activity" />
              </span>
              <div>
                <h2>Pinza {p.nombre}</h2>
                <p>
                  {p.tuberia} · Posición {p.posicion_m} m
                </p>
              </div>
              <em>{p.activo ? "Activa" : "Inactiva"}</em>
            </div>
            <label>
              <span className="range-head">
                <span>Presión mínima antes de avisar{p.nombre === "A" ? "" : " (se mide en la pinza A)"}</span>
                <span>
                  <b>{kpaABar(valor.umbral_presion_kpa)}</b> bar
                </span>
              </span>
              <input type="range" min="0" max="500" step="5" value={valor.umbral_presion_kpa} onChange={(event) => cambiar(p.id_pinza, "umbral_presion_kpa", Number(event.target.value))} />
            </label>
            <label>
              <span className="range-head">
                <span>Certeza mínima para avisar de fuga</span>
                <span>
                  <b>{Math.round(valor.umbral_confianza * 100)}</b> %
                </span>
              </span>
              <input type="range" min="0" max="1" step="0.01" value={valor.umbral_confianza} onChange={(event) => cambiar(p.id_pinza, "umbral_confianza", Number(event.target.value))} />
            </label>
          </section>
        )
      })}
      <section className="content-panel settings-card settings-card--wide">
        <div className="settings-card__head">
          <span className="summary-icon green">
            <Icon name="flow" />
          </span>
          <div>
            <h2>{tuberia?.nombre ?? "—"}</h2>
            <p>{tuberia ? `${tuberia.material.toUpperCase()} · Ø ${tuberia.diametro_mm} mm · ${tuberia.longitud_m} m` : ""}</p>
          </div>
        </div>
        <label>
          <span className="range-head">
            <span>Caudal máximo permitido</span>
            <span>
              <b>Sin sensor</b>
            </span>
          </span>
          <input type="range" min="1" max="20" defaultValue="12" disabled />
        </label>
        <div className="automation-row">
          <span>
            <Icon name="shield" />
            <span>
              <b>Alarma automática al detectar fuga</b>
              <small>Enciende automáticamente la sirena y la torreta roja cuando ocurre una alerta</small>
            </span>
          </span>
        </div>
        <button className="primary-btn save-btn" onClick={guardar} disabled={guardando}>
          {saved ? (
            <>
              <Icon name="check" />
              Cambios guardados
            </>
          ) : (
            "Guardar cambios"
          )}
        </button>
      </section>
    </div>
  )
}

function Users() {
  const { openDialog } = useInteractions()
  const { usuarios } = useDatos()
  return (
    <section className="content-panel">
      <div className="toolbar">
        <div>
          <h2>Equipo HydroSense</h2>
          <p>{usuarios.filter((u) => u.activo).length} usuarios activos</p>
        </div>
        <button className="primary-btn" onClick={() => openDialog("invite")}>
          <Icon name="plus" />
          Invitar usuario
        </button>
      </div>
      <div className="user-grid">
        {usuarios.map((u) => (
          <article className="user-card" key={u.id_usuario}>
            <div className="user-card__top">
              <span className="avatar large">{iniciales(u.nombre)}</span>
              <button
                className="icon-btn"
                onClick={() => openDialog("userActions", { usuario: u })}
                aria-label={`Administrar a ${u.nombre}`}
              >
                <Icon name="more" />
              </button>
            </div>
            <h3>{u.nombre}</h3>
            <p>{u.correo}</p>
            <span className={`role-badge ${u.rol === "gerencia" ? "manager" : ""}`}>
              <Icon
                name={u.rol === "gerencia" ? "shield" : "settings"}
                size={15}
              />
              {NOMBRE_ROL[u.rol]}
            </span>
            <div className="notice-state">
              <Icon name="mail" />
              <span>
                <b>Alertas por correo</b>
                <small>{u.activo ? "Recibe avisos por correo cuando hay una alerta" : "Acceso desactivado"}</small>
              </span>
              <i className={u.activo ? "enabled" : ""} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Depuracion() {
  const { lecturas, vibracion, dispositivos, eventos, conectado, ahora } = useDatos()
  const [estadoApi, setEstadoApi] = useState<EstadoSistema | null>(null)
  useEffect(() => {
    const leer = () => void api.estado().then(setEstadoApi).catch(() => setEstadoApi(null))
    leer()
    const temporizador = window.setInterval(leer, 3000)
    return () => window.clearInterval(temporizador)
  }, [])
  const celda = { padding: "4px 10px", textAlign: "left" as const, fontSize: 12, borderBottom: "1px solid var(--line)" }
  const tabla = (titulo: string, columnas: string[], filas: (string | number | null)[][]) => (
    <section className="panel" style={{ marginBottom: 16, overflowX: "auto" }}>
      <div className="panel__head">
        <div>
          <h2>{titulo}</h2>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace" }}>
        <thead>
          <tr>{columnas.map((c) => <th key={c} style={celda}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i}>{fila.map((valor, j) => <td key={j} style={celda}>{valor ?? "NULL"}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </section>
  )
  return (
    <>
      {tabla("Estado MQTT y conexión", ["elemento", "estado"], [
        ["socket.io", conectado ? "conectado" : "desconectado"],
        ["backend → broker MQTT", estadoApi?.mqtt_conectado ? "conectado" : "desconectado"],
        ...Object.entries(estadoApi?.dispositivos ?? {}).map(([clave, valor]) => [clave, valor]),
        ...Object.entries(estadoApi?.ultimo_mensaje ?? {}).map(([topico, fecha]) => [topico, haceCuanto(fecha, ahora)]),
      ])}
      {tabla("Últimas lecturas crudas y calidad", ["pinza", "tipo", "valor", "calidad", "fecha_hora"], lecturas.map((l) => [l.pinza, l.tipo, l.valor, l.calidad, l.fecha_hora]))}
      {tabla("Vibración por banda (RMS)", ["pinza", "rms_total", "b1 300-700", "b2 700-1200", "b3 1200-2000", "n", "calidad", "fecha_hora"], vibracion.map((v) => [v.pinza, v.rms_total, v.rms_b1, v.rms_b2, v.rms_b3, v.n_muestras, v.calidad, v.fecha_hora]))}
      {tabla("Dispositivos", ["id", "nombre", "clave", "estado", "ultima_conexion"], (dispositivos?.dispositivos ?? []).map((d) => [conCeros(d.id_dispositivo), d.nombre, d.clave, d.estado, d.ultima_conexion]))}
      {tabla("Eventos Socket.IO recientes", ["hora", "evento", "datos"], eventos.slice(0, 15).map((e) => [horaLocal(e.recibido), e.evento, JSON.stringify(e.datos)]))}
    </>
  )
}

function BottomNav({
  page,
  setPage,
  role,
}: {
  page: string
  setPage: (p: string) => void
  role: Rol
}) {
  const { alertas } = useDatos()
  const abiertas = alertas.filter(estaAbierta).length
  const items = role === "manager" ? nav.slice(0, 4) : nav.slice(0, 3)
  return (
    <nav
      className={`bottom-nav ${
        role === "maintenance" ? "bottom-nav--three" : ""
      }`}
    >
      {items.map((item) => (
        <button
          key={item.id}
          className={page === item.id ? "active" : ""}
          onClick={() => setPage(item.id)}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
          {item.id === "alerts" && abiertas > 0 && <i>{abiertas}</i>}
        </button>
      ))}
    </nav>
  )
}

const CREDENCIALES_PRUEBA = [
  {
    id: "gerencia",
    rol: "Gerencia",
    nombre: "Carla Mendoza",
    correo: "gerencia@hydrosense.local",
    password: "hydrosense_gerencia_2026",
  },
  {
    id: "mantenimiento",
    rol: "Mantenimiento",
    nombre: "José Ramírez",
    correo: "mantenimiento@hydrosense.local",
    password: "hydrosense_mantenimiento_2026",
  },
] as const

function Login({ onEntrar, onVolverInicio }: { onEntrar: (sesion: Sesion) => void; onVolverInicio?: () => void }) {
  const [correo, setCorreo] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [cuentaActiva, setCuentaActiva] = useState("")
  const [pruebasAbiertas, setPruebasAbiertas] = useState(false)

  const llenarCredenciales = (cuenta: (typeof CREDENCIALES_PRUEBA)[number]) => {
    setCorreo(cuenta.correo)
    setPassword(cuenta.password)
    setError("")
    setCuentaActiva(cuenta.id)
    setPruebasAbiertas(false)
  }

  useEffect(() => {
    document.documentElement.classList.add("is-login")
    document.body.classList.add("is-login")
    return () => {
      document.documentElement.classList.remove("is-login")
      document.body.classList.remove("is-login")
    }
  }, [])
  return (
    <div className="login-screen">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-card__head">
          <img className="login-logo" src="/hydrosense-vertical.svg" alt="HydroSense" />
          <h1 id="login-title">Iniciar sesión</h1>
          <p>Ingresa tus datos para consultar el estado de la tubería en tiempo real</p>
        </div>
        <form
          className="login-form"
          onSubmit={async (event) => {
            event.preventDefault()
            const campos = new FormData(event.currentTarget)
            setOcupado(true)
            setError("")
            try {
              onEntrar(await iniciarSesion(String(campos.get("correo")), String(campos.get("password"))))
            } catch (causa) {
              setError(mensajeDe(causa))
            } finally {
              setOcupado(false)
            }
          }}
        >
          <label className="login-field">
            <span>Correo electrónico</span>
            <div className="login-input">
              <span className="login-input__icon">
                <Icon name="mail" size={18} />
              </span>
              <input
                name="correo"
                type="email"
                required
                autoComplete="username"
                placeholder="nombre@empresa.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
            </div>
          </label>
          <label className="login-field">
            <span>Contraseña</span>
            <div className="login-input">
              <span className="login-input__icon">
                <Icon name="lock" size={18} />
              </span>
              <input
                name="password"
                type={mostrarPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setMostrarPassword((previo) => !previo)}
                aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <Icon name={mostrarPassword ? "eyeOff" : "eye"} size={18} />
              </button>
            </div>
          </label>
          {error && (
            <p className="login-error" role="alert">
              <Icon name="alerts" size={16} />
              <span>{error}</span>
            </p>
          )}
          <button className="primary-btn login-submit" type="submit" disabled={ocupado}>
            {ocupado ? "Entrando..." : "Entrar"}
          </button>
          {onVolverInicio && (
            <button type="button" className="login-back" onClick={onVolverInicio}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Volver al inicio
            </button>
          )}
        </form>
      </section>

      <div className="login-demo-dock">
        <div className={`login-demo-panel${pruebasAbiertas ? " login-demo-panel--open" : ""}`} aria-label="Credenciales de prueba">
          <div className="login-demo-panel__head">
            <div>
              <span className="login-demo-panel__eyebrow">Solo pruebas</span>
              <h2>Credenciales de acceso</h2>
            </div>
            <button
              type="button"
              className="login-demo-panel__close"
              onClick={() => setPruebasAbiertas(false)}
              aria-label="Cerrar credenciales de prueba"
            >
              ×
            </button>
          </div>
          <div className="login-demo-list">
            {CREDENCIALES_PRUEBA.map((cuenta) => {
              const seleccionada = cuentaActiva === cuenta.id && correo === cuenta.correo && password === cuenta.password
              return (
                <div key={cuenta.id} className={`login-demo-item${seleccionada ? " login-demo-item--active" : ""}`}>
                  <div className="login-demo-item__top">
                    <div>
                      <strong>{cuenta.rol}</strong>
                      <span>{cuenta.nombre}</span>
                    </div>
                    <button
                      type="button"
                      className="login-demo-fill"
                      onClick={() => llenarCredenciales(cuenta)}
                    >
                      {seleccionada ? "Listo ✓" : "Llenar"}
                    </button>
                  </div>
                  <dl className="login-demo-creds">
                    <div>
                      <dt>Correo</dt>
                      <dd>{cuenta.correo}</dd>
                    </div>
                    <div>
                      <dt>Contraseña</dt>
                      <dd>{cuenta.password}</dd>
                    </div>
                  </dl>
                </div>
              )
            })}
          </div>
        </div>

        <div className="login-demo-mobile-bar" role="region" aria-label="Acceso rápido de pruebas">
          <button
            type="button"
            className="login-demo-mobile-bar__toggle"
            aria-expanded={pruebasAbiertas}
            onClick={() => setPruebasAbiertas((prev) => !prev)}
          >
            <span>Claves</span>
            <span aria-hidden="true">{pruebasAbiertas ? "▾" : "▴"}</span>
          </button>
          <div className="login-demo-mobile-bar__actions">
            {CREDENCIALES_PRUEBA.map((cuenta) => {
              const seleccionada = cuentaActiva === cuenta.id && correo === cuenta.correo && password === cuenta.password
              return (
                <button
                  key={cuenta.id}
                  type="button"
                  className={`login-demo-fill login-demo-fill--compact${seleccionada ? " is-active" : ""}`}
                  onClick={() => llenarCredenciales(cuenta)}
                >
                  {seleccionada ? `${cuenta.rol} ✓` : cuenta.rol}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Tablero({ onLogout }: { onLogout: () => void }) {
  const { sesion } = useDatos()
  const role = rolDeToken(sesion.usuario.rol)
  const [page, setPage] = useState(new URLSearchParams(window.location.search).get("debug") === "1" ? "debug" : "overview")
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [toast, setToast] = useState("")
  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 2600)
  }
  const openDialog = (kind: DialogKind, datos?: Omit<DialogState, "kind">) => setDialog({ kind, ...datos })
  return (
    <InteractionContext.Provider value={{ openDialog, notify }}>
      <div className="app-shell">
        <Sidebar
          page={page}
          setPage={setPage}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          role={role}
          onLogout={onLogout}
        />
        <main className="main">
          <Header
            page={page}
            onMenu={() => setMenuOpen(true)}
            role={role}
          />
          <div className="page-content">
            {page === "overview" &&
              (role === "manager" ? (
                <Overview setPage={setPage} />
              ) : (
                <MaintenanceOverview setPage={setPage} />
              ))}
            {page === "devices" && <Devices />}
            {page === "alerts" && <Alerts />}
            {page === "thresholds" && role === "manager" && <Thresholds />}
            {page === "users" && role === "manager" && <Users />}
            {page === "debug" && <Depuracion />}
          </div>
        </main>
        <BottomNav page={page} setPage={setPage} role={role} />
        {dialog && <Dialog estado={dialog} onClose={() => setDialog(null)} />}
        {toast && (
          <div className="toast" role="status">
            <span>
              <Icon name="check" size={16} />
            </span>
            {toast}
          </div>
        )}
      </div>
    </InteractionContext.Provider>
  )
}

export default function App({ onVolverInicio }: { onVolverInicio?: () => void } = {}) {
  const [sesion, setSesion] = useState<Sesion | null>(leerSesion)
  const salir = () => {
    cerrarSesion()
    setSesion(null)
  }
  useEffect(() => configurarExpiracion(salir), [])
  if (!sesion) return <Login onEntrar={setSesion} onVolverInicio={onVolverInicio} />
  return (
    <DatosProvider key={sesion.usuario.id_usuario} sesion={sesion}>
      <Tablero onLogout={salir} />
    </DatosProvider>
  )
}
