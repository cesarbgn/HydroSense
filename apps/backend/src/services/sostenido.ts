/**
 * Decide si una condición se ha mantenido durante cierto tiempo, según las fechas de los
 * mensajes (no el reloj del servidor). Un hueco mayor que `huecoMaximoMs` reinicia la cuenta.
 */
export class Sostenido {
  private inicio: number | null = null
  private ultimo: number | null = null

  constructor(
    private readonly duracionMs: number,
    private readonly huecoMaximoMs: number,
  ) {}

  observar(cumple: boolean, ts: number): boolean {
    if (!cumple) {
      this.reiniciar()
      return false
    }
    if (this.ultimo !== null && ts - this.ultimo > this.huecoMaximoMs) this.reiniciar()
    if (this.ultimo !== null && ts < this.ultimo) return false
    this.inicio ??= ts
    this.ultimo = ts
    return ts - this.inicio >= this.duracionMs
  }

  reiniciar() {
    this.inicio = null
    this.ultimo = null
  }

  get inicioMs() {
    return this.inicio
  }
}
