import { consultar } from '../db/pool.js'

export interface Pinza {
  id_pinza: number
  id_tuberia: number
  nombre: string
  posicion_m: number
  umbral_confianza: number
  umbral_presion_kpa: number
}

let pinzas: Pinza[] | null = null

async function cargar(): Promise<Pinza[]> {
  pinzas ??= await consultar<Pinza>(
    `SELECT id_pinza, id_tuberia, nombre, posicion_m, umbral_confianza, umbral_presion_kpa
       FROM pinza WHERE activo = TRUE ORDER BY id_pinza`,
  )
  return pinzas
}

export async function pinzaPorNombre(nombre: string): Promise<Pinza | null> {
  const encontrada = (await cargar()).find((p) => p.nombre === nombre)
  return encontrada ?? null
}

/** Se llama al cambiar umbrales para que las reglas de alerta usen los valores nuevos. */
export function invalidarCatalogo() {
  pinzas = null
}
