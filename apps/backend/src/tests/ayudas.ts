import bcrypt from 'bcrypt'
import { ejecutar, consultar } from '../db/pool.js'
import { esperarPendientes, reiniciarSeguimiento } from '../services/alertas.js'
import { invalidarCatalogo } from '../services/catalogo.js'
import { procesarMensaje, reiniciarIngesta } from '../services/ingesta.js'

export const TOPICO = {
  proceso: 'hydrosense/acq01/proceso',
  vibracion: 'hydrosense/acq01/vibracion',
  deteccion: 'hydrosense/pi/deteccion',
  ack: 'hydrosense/act01/ack',
}

export const PASS_GERENCIA = 'gerencia-1234'
export const PASS_MANTENIMIENTO = 'mantenimiento-1234'

export const IDS = { tuberia: 0, pinzaA: 0, pinzaB: 0, torreta: 0, sirena: 0, valvula: 0, gerente: 0, tecnico: 0 }

/** Deja la BD de pruebas con los mismos catálogos que el seed y sin datos de operación. */
export async function reiniciarBd() {
  await esperarPendientes()
  for (const tabla of ['notificacion', 'atencion_alerta', 'accion_actuador', 'deteccion_ia', 'lectura_vibracion', 'lectura', 'alerta', 'prueba_laboratorio', 'actuador', 'pinza', 'dispositivo', 'tuberia', 'usuario']) {
    await ejecutar(`DELETE FROM ${tabla}`)
  }
  const hash = (p: string) => bcrypt.hash(p, 4)
  IDS.gerente = (await ejecutar("INSERT INTO usuario (id_rol, nombre, correo, password_hash) VALUES (1, 'Gerente', 'g@test.local', ?)", [await hash(PASS_GERENCIA)])).insertId
  IDS.tecnico = (await ejecutar("INSERT INTO usuario (id_rol, nombre, correo, password_hash) VALUES (2, 'Técnico', 't@test.local', ?)", [await hash(PASS_MANTENIMIENTO)])).insertId
  IDS.tuberia = (await ejecutar("INSERT INTO tuberia (nombre, material, diametro_mm, longitud_m) VALUES ('Lazo', 'pvc', 25.4, 4)")).insertId
  const adq = (await ejecutar("INSERT INTO dispositivo (tipo, nombre, mac) VALUES ('adquisicion', 'ADQ', 'AA:AA:AA:AA:AA:01')")).insertId
  const act = (await ejecutar("INSERT INTO dispositivo (tipo, nombre, mac) VALUES ('actuacion', 'ACT', 'AA:AA:AA:AA:AA:02')")).insertId
  const pinza = async (nombre: string, posicion: number) =>
    (await ejecutar('INSERT INTO pinza (id_tuberia, id_dispositivo, nombre, posicion_m, umbral_confianza, umbral_presion_kpa) VALUES (?, ?, ?, ?, 0.8, 100)', [IDS.tuberia, adq, nombre, posicion])).insertId
  IDS.pinzaA = await pinza('A', 1)
  IDS.pinzaB = await pinza('B', 2)
  const actuador = async (tipo: string) => (await ejecutar('INSERT INTO actuador (id_dispositivo, tipo, nombre) VALUES (?, ?, ?)', [act, tipo, tipo])).insertId
  IDS.torreta = await actuador('torreta')
  IDS.sirena = await actuador('sirena')
  IDS.valvula = await actuador('valvula')
  invalidarCatalogo()
  reiniciarSeguimiento()
  reiniciarIngesta()
}

export const enviar = (topico: string, datos: unknown) => procesarMensaje(topico, Buffer.from(typeof datos === 'string' ? datos : JSON.stringify(datos)))

export const contar = async (tabla: string, condicion = '1 = 1', parametros: unknown[] = []) =>
  (await consultar<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabla} WHERE ${condicion}`, parametros))[0]!.n

/** Las notificaciones y los comandos automáticos no bloquean la ingesta: se espera a que terminen. */
export async function esperarHasta(condicion: () => Promise<boolean>, ms = 5_000) {
  const limite = Date.now() + ms
  while (Date.now() < limite) {
    if (await condicion()) return
    await new Promise((r) => setTimeout(r, 25))
  }
  throw new Error('La condición no se cumplió a tiempo')
}
