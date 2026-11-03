function escribir(nivel: string, mensaje: string, datos?: unknown) {
  const extra = datos === undefined ? '' : ` ${datos instanceof Error ? datos.message : JSON.stringify(datos)}`
  console.log(`${new Date().toISOString()} ${nivel} ${mensaje}${extra}`)
}

export const log = {
  info: (mensaje: string, datos?: unknown) => escribir('INFO', mensaje, datos),
  aviso: (mensaje: string, datos?: unknown) => escribir('AVISO', mensaje, datos),
  error: (mensaje: string, datos?: unknown) => escribir('ERROR', mensaje, datos),
}
