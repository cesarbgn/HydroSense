import { describe, expect, it } from 'vitest'
import { procesoEsquema, vibracionEsquema } from '../mqtt/esquemas.js'
import { severidadPorConfianza, severidadPorPresion } from '../services/alertas.js'
import { normalizarMedicion, normalizarTemperatura } from '../services/ingesta.js'
import { RespaldoRms, type Bandas } from '../services/respaldoRms.js'
import { Sostenido } from '../services/sostenido.js'
import { datetimeAIso, isoADatetime, msADatetime } from '../tiempo.js'

describe('conversión de fechas', () => {
  it('cruza la medianoche local correctamente', () => {
    expect(msADatetime(Date.UTC(2026, 10, 3, 5, 59, 59, 999))).toBe('2026-11-02 23:59:59.999')
    expect(msADatetime(Date.UTC(2026, 10, 3, 6, 0, 0, 0))).toBe('2026-11-03 00:00:00.000')
  })

  it('cruza el fin de año', () => {
    expect(msADatetime(Date.UTC(2027, 0, 1, 5, 30, 0, 250))).toBe('2026-12-31 23:30:00.250')
  })

  it('ida y vuelta conserva el instante', () => {
    const ms = Date.UTC(2026, 10, 3, 6, 0, 0, 123)
    expect(Date.parse(datetimeAIso(msADatetime(ms)))).toBe(ms)
    expect(isoADatetime('2026-11-03T06:00:00.123Z')).toBe('2026-11-03 00:00:00.123')
    expect(isoADatetime('no es fecha')).toBeNull()
  })
})

describe('calidad de las mediciones', () => {
  it('q distinto de ok guarda NULL aunque venga un valor', () => {
    expect(normalizarMedicion(150, 'fuera_rango')).toEqual({ valor: null, calidad: 'fuera_rango' })
  })

  it('valor null con q ok se marca sin_senal', () => {
    expect(normalizarMedicion(null, 'ok')).toEqual({ valor: null, calidad: 'sin_senal' })
  })

  it('-127 °C nunca es dato válido, aunque el firmware diga ok', () => {
    expect(normalizarTemperatura(-127, 'ok')).toEqual({ valor: null, calidad: 'sin_senal' })
    expect(normalizarTemperatura(25.5, 'ok')).toEqual({ valor: 25.5, calidad: 'ok' })
  })
})

describe('esquemas MQTT', () => {
  const ts = Date.UTC(2026, 10, 2)

  it('rechaza fechas de un ESP32 sin NTP', () => {
    expect(procesoEsquema.safeParse({ ts: 1000, presion_kpa: 100, temp_c: 25, q_presion: 'ok', q_temp: 'ok' }).success).toBe(false)
  })

  it('acepta null cuando la calidad no es ok', () => {
    expect(procesoEsquema.safeParse({ ts, presion_kpa: null, temp_c: 25, q_presion: 'sin_senal', q_temp: 'ok' }).success).toBe(true)
  })

  it('rechaza una calidad desconocida', () => {
    expect(vibracionEsquema.safeParse({ ts, pinza: 'A', rms: 1, b1: 1, b2: 1, b3: 1, n: 10, q: 'mala' }).success).toBe(false)
  })
})

describe('Sostenido', () => {
  it('se cumple solo al alcanzar la duración', () => {
    const s = new Sostenido(4000, 3000)
    expect([0, 1000, 2000, 3000].map((t) => s.observar(true, t))).toEqual([false, false, false, false])
    expect(s.observar(true, 4000)).toBe(true)
  })

  it('un valor que no cumple reinicia la cuenta', () => {
    const s = new Sostenido(2000, 3000)
    s.observar(true, 0)
    s.observar(false, 1000)
    expect(s.observar(true, 2000)).toBe(false)
  })

  it('un hueco largo reinicia la cuenta', () => {
    const s = new Sostenido(4000, 3000)
    s.observar(true, 0)
    expect(s.observar(true, 10_000)).toBe(false)
  })
})

describe('severidad', () => {
  it('por confianza', () => {
    expect([0.99, 0.9, 0.8].map(severidadPorConfianza)).toEqual(['alta', 'media', 'baja'])
  })
  it('por presión', () => {
    expect([40, 70, 95].map((v) => severidadPorPresion(v, 100))).toEqual(['alta', 'media', 'baja'])
  })
})

describe('respaldo RMS', () => {
  const base: Bandas = [4, 5, 3]
  const alto: Bandas = [4, 40, 3]

  function conBase(r: RespaldoRms) {
    let ts = 0
    for (; ts < 60_000; ts += 1000) expect(r.observar('B', ts, base)).toBeNull()
    return ts
  }

  it('avisa una sola vez por episodio cuando el Coral está callado', () => {
    const r = new RespaldoRms()
    let ts = conBase(r)
    const eventos = []
    for (let i = 0; i < 30; i++, ts += 1000) {
      const evento = r.observar('B', ts, alto)
      if (evento) eventos.push(evento)
    }
    expect(eventos).toHaveLength(1)
    expect(eventos[0]!.lineaBase).toEqual(base)
  })

  it('no avisa si el Coral sigue publicando', () => {
    const r = new RespaldoRms()
    let ts = conBase(r)
    for (let i = 0; i < 30; i++, ts += 1000) {
      r.registrarDeteccion(ts)
      expect(r.observar('B', ts, alto)).toBeNull()
    }
  })

  it('no avisa con un pico corto', () => {
    const r = new RespaldoRms()
    let ts = conBase(r)
    for (let i = 0; i < 5; i++, ts += 1000) expect(r.observar('B', ts, alto)).toBeNull()
    expect(r.observar('B', ts, base)).toBeNull()
  })
})
