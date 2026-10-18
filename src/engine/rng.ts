// Gerador com semente (mulberry32), puro: recebe o estado e devolve [valor, novoEstado].
// O estado do gerador fica guardado em GameState.rng para que a partida seja reproduzível.

export type EstadoRng = number

export function iniciarRng(semente: number): EstadoRng {
  return semente | 0
}

/** Número em [0, 1). */
export function proximo(estado: EstadoRng): [number, EstadoRng] {
  const novo = (estado + 0x6d2b79f5) | 0
  let t = novo
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, novo]
}

/** Inteiro em [0, limite). */
export function inteiro(limite: number, estado: EstadoRng): [number, EstadoRng] {
  const [x, novo] = proximo(estado)
  return [Math.floor(x * limite), novo]
}

/** Cópia embaralhada (Fisher–Yates); a lista original não é alterada. */
export function embaralhar<T>(lista: readonly T[], estado: EstadoRng): [T[], EstadoRng] {
  const copia = [...lista]
  let s = estado
  for (let i = copia.length - 1; i > 0; i--) {
    let j: number
    ;[j, s] = inteiro(i + 1, s)
    const tmp = copia[i] as T
    copia[i] = copia[j] as T
    copia[j] = tmp
  }
  return [copia, s]
}
