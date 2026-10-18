// Coordenadas, vizinhança, terreno e margens do mapa, tudo derivado de regras.json.
import { regras as regrasPadrao, type Regras } from './config'

export type Coord = string // "C5"
export type Terreno = 'capital' | 'varzea' | 'rocha' | 'planicie'
export type Margem = 'oeste' | 'leste'
export const margensDoMapa: readonly Margem[] = ['oeste', 'leste']

/** x = coluna (A = 0), y = linha − 1 (linha 1 embaixo). */
export interface Posicao {
  x: number
  y: number
}

export interface Mapa {
  colunas: number
  linhas: number
  casas: Coord[]
  terreno: Record<Coord, Terreno>
  /** Margem de cada casa; null para Capital, várzea e casas fora das duas margens. */
  margem: Record<Coord, Margem | null>
  casasDaMargem: Record<Margem, Coord[]>
  vizinhos: Record<Coord, Coord[]>
  capital: Coord[]
}

export function paraPosicao(casa: Coord): Posicao | null {
  const m = /^([A-Z])(\d+)$/.exec(casa)
  if (!m || !m[1] || !m[2]) return null
  return { x: m[1].charCodeAt(0) - 65, y: Number(m[2]) - 1 }
}

export function paraCoord(x: number, y: number): Coord {
  return `${String.fromCharCode(65 + x)}${y + 1}`
}

export function distanciaManhattan(a: Coord, b: Coord): number {
  const pa = paraPosicao(a)
  const pb = paraPosicao(b)
  if (!pa || !pb) return Infinity
  return Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y)
}

const cache = new WeakMap<Regras, Mapa>()

export function obterMapa(r: Regras = regrasPadrao): Mapa {
  let mapa = cache.get(r)
  if (!mapa) {
    mapa = criarMapa(r)
    cache.set(r, mapa)
  }
  return mapa
}

function criarMapa(r: Regras): Mapa {
  const { colunas, linhas } = r.mapa
  const casas: Coord[] = []
  for (let y = 0; y < linhas; y++) for (let x = 0; x < colunas; x++) casas.push(paraCoord(x, y))

  const capital = new Set(r.mapa.capital)
  const varzea = new Set(r.mapa.varzea)
  const rochas = new Set(r.mapa.rochas)
  const terreno: Record<Coord, Terreno> = {}
  const vizinhos: Record<Coord, Coord[]> = {}
  for (const c of casas) {
    terreno[c] = capital.has(c) ? 'capital' : varzea.has(c) ? 'varzea' : rochas.has(c) ? 'rocha' : 'planicie'
    const p = paraPosicao(c) as Posicao
    vizinhos[c] = [
      [p.x, p.y + 1],
      [p.x + 1, p.y],
      [p.x, p.y - 1],
      [p.x - 1, p.y],
    ]
      .filter(([x, y]) => x! >= 0 && x! < colunas && y! >= 0 && y! < linhas)
      .map(([x, y]) => paraCoord(x!, y!))
  }

  const margem: Record<Coord, Margem | null> = {}
  for (const c of casas) margem[c] = null
  const casasDaMargem = {} as Record<Margem, Coord[]>
  for (const m of margensDoMapa) {
    const regiao: Coord[] = []
    const pilha = [r.mapa.margens[m].sementeFloodFill]
    while (pilha.length > 0) {
      const c = pilha.pop() as Coord
      if (margem[c] !== null || terreno[c] === 'capital' || terreno[c] === 'varzea') continue
      margem[c] = m
      regiao.push(c)
      pilha.push(...(vizinhos[c] ?? []))
    }
    casasDaMargem[m] = regiao.sort()
  }

  return { colunas, linhas, casas, terreno, margem, casasDaMargem, vizinhos, capital: [...r.mapa.capital] }
}

export function distanciaACapital(casa: Coord, mapa: Mapa = obterMapa()): number {
  return Math.min(...mapa.capital.map((c) => distanciaManhattan(casa, c)))
}
