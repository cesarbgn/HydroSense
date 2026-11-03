export type EstadoConexion = 'online' | 'offline' | 'desconocido'

/** Estado volátil del sistema. El de los dispositivos se recupera de los mensajes retenidos al reconectar. */
export const estado = {
  mqttConectado: false,
  dispositivos: { acq01: 'desconocido', act01: 'desconocido' } as Record<string, EstadoConexion>,
  ultimoMensaje: {} as Record<string, string>,
}
