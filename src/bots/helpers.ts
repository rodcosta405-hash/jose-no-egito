// Funções auxiliares dos bots (docs/BOTS.md seções 1 e 2), porte de simulador_jose_no_egito_v8.py.
// Só leem o estado; nunca o alteram.
import {
  capacidadeCereal,
  conectadoACapital,
  contar,
  distanciaACapital,
  distanciaManhattan,
  edificiosDe,
  obterMapa,
  precisaTrabalhador,
  trabalhadores,
} from '../engine'
import type { BuildingType, Coord, GameState, Mapa, PlayerState, Regras } from '../engine'
import { iniciarRng, proximo } from '../engine/rng'
import { estrategiaPorId, type ParametrosBot } from './config'

/** Tudo o que um bot precisa para decidir, calculado uma vez por decisão. */
export interface Contexto {
  estado: GameState
  j: number
  p: PlayerState
  r: Regras
  mapa: Mapa
  params: ParametrosBot
  /** Gerador local do bot: [0, 1). Não toca no rng da partida. */
  rand: () => number
}

export function criarContexto(estado: GameState, j: number, r: Regras = estado.regras): Contexto {
  const p = estado.jogadores[j]
  if (!p) throw new Error(`Jogador ${j} não existe`)
  return { estado, j, p, r, mapa: obterMapa(r), params: estrategiaPorId(p.estrategiaBot).params, rand: rngDoBot(estado, j) }
}

/**
 * Gerador próprio do bot, com semente derivada do estado (semente da partida, tamanho do log e jogador):
 * a mesma situação gera a mesma decisão, e o estado da partida não é alterado (DECISOES.md).
 */
export function rngDoBot(estado: GameState, j: number): () => number {
  let s = iniciarRng((estado.semente ^ Math.imul(estado.log.length + 1, 0x9e3779b1) ^ Math.imul(j + 1, 0x85ebca6b)) | 0)
  return () => {
    let x: number
    ;[x, s] = proximo(s)
    return x
  }
}

// ---------- utilidades com a semântica do Python ----------

/** int() do Python: corta em direção a zero. */
export const pyInt = (x: number) => Math.trunc(x)

/** round() do Python: empates vão para o par (2,5 → 2; 3,5 → 4). */
export function pyRound(x: number): number {
  const f = Math.floor(x)
  const d = x - f
  if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1
  return d > 0.5 ? f + 1 : f
}

const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

// ---------- projeções ----------

export const anoGordo = (c: Contexto) => c.estado.ano <= c.r.anos.gordos

export function W(c: Contexto, j = c.j): number {
  return trabalhadores(c.estado, j, c.r)
}

/** Edifícios que exigem trabalhador. */
export function vagas(c: Contexto, j = c.j): Coord[] {
  return edificiosDe(c.estado, j)
    .filter(([, t]) => precisaTrabalhador(t.type, c.r))
    .map(([casa]) => casa)
}

export const sobraTrabalhadores = (c: Contexto) => W(c) - vagas(c).length
export const cap = (c: Contexto, j = c.j) => capacidadeCereal(c.estado, j, c.r)

export function anosMagrosRestantes(c: Contexto): number {
  const { total, gordos } = c.r.anos
  return c.estado.ano <= gordos ? total - gordos : total - c.estado.ano + 1
}

export type ModoProjecao = 'media' | 'pess'

export function taxaMagra(c: Contexto, modo: ModoProjecao): number {
  return modo === 'media' ? media(c.r.cartas.magras) : Math.min(...c.r.cartas.magras)
}

/** Casas dos Campos do jogador, os da várzea primeiro (ordem estável). */
export function camposOrdenados(c: Contexto, j = c.j): Coord[] {
  const campos = edificiosDe(c.estado, j).filter(([, t]) => t.type === 'campo').map(([casa]) => casa)
  return [...campos.filter((x) => c.mapa.terreno[x] === 'varzea'), ...campos.filter((x) => c.mapa.terreno[x] !== 'varzea')]
}

export function prodMagra(c: Contexto, w: number, modo: ModoProjecao, j = c.j): number {
  const taxa = taxaMagra(c, modo)
  const bonus = c.r.edificios.campo.bonusVarzeaAnosMagros
  return camposOrdenados(c, j)
    .slice(0, Math.min(w, camposOrdenados(c, j).length))
    .reduce((s, casa) => s + taxa + (c.mapa.terreno[casa] === 'varzea' ? bonus : 0), 0)
}

export function necessidadeMagra(c: Contexto, extraW = 0, modo: ModoProjecao = 'media', j = c.j): number {
  const w = W(c, j) + extraW
  return Math.max(0, anosMagrosRestantes(c) * (w - prodMagra(c, w, modo, j)))
}

/** Estoque que o bot `j` quer ter (usa os parâmetros dele). */
export function alvoEstoque(c: Contexto, j = c.j): number {
  const params = j === c.j ? c.params : estrategiaPorId(c.estado.jogadores[j]?.estrategiaBot).params
  return params.store * necessidadeMagra(c, 0, 'media', j)
}

/** Quanto cereal o bot `q` aceita vender. */
export function excedente(c: Contexto, q: number): number {
  const cereal = c.estado.jogadores[q]?.cereal ?? 0
  if (anoGordo(c)) return Math.max(0, pyInt(cereal - alvoEstoque(c, q)))
  return Math.max(0, pyInt(cereal - necessidadeMagra(c, 0, 'pess', q)))
}

// ---------- casas ----------

/** Casa livre para o jogador: sem edifício, fora da Capital, sem demarcação alheia. */
export function livre(c: Contexto, casa: Coord): boolean {
  if (c.mapa.terreno[casa] === 'capital' || c.estado.tabuleiro[casa]) return false
  const d = c.estado.demarcacoes[casa]
  return d === undefined || d === c.j
}

/** Casas livres vizinhas dos edifícios do jogador. */
export function expansao(c: Contexto): Coord[] {
  const out = new Set<Coord>()
  for (const [casa] of edificiosDe(c.estado, c.j)) for (const v of c.mapa.vizinhos[casa] ?? []) if (livre(c, v)) out.add(v)
  // Casas demarcadas pelo jogador também servem (BOTS.md §2).
  for (const [casa, d] of Object.entries(c.estado.demarcacoes)) if (d === c.j && livre(c, casa)) out.add(casa)
  return [...out]
}

export function notaCasa(c: Contexto, tipo: BuildingType, casa: Coord): number {
  const terreno = c.mapa.terreno[casa]
  let s = c.rand() * 0.01
  if (tipo === 'campo' && terreno === 'varzea') s += 3
  if (tipo === 'pedreira' && terreno === 'rocha') s += 3
  if (tipo !== 'campo' && tipo !== 'pedreira' && (terreno === 'varzea' || terreno === 'rocha')) s -= 1
  if (!conectadoACapital(c.estado, c.j, c.r)) s += c.params.capital_w * (4 - distanciaACapital(casa, c.mapa))
  s += 0.2 * (c.mapa.vizinhos[casa] ?? []).filter((v) => livre(c, v)).length
  return s
}

/** Melhor casa entre as candidatas (padrão: expansão, sem várzea se o tipo não for Campo). */
export function melhorCasa(c: Contexto, tipo: BuildingType, candidatas?: Coord[]): Coord | null {
  let casas = candidatas ?? expansao(c)
  if (tipo !== 'campo') casas = casas.filter((x) => c.mapa.terreno[x] !== 'varzea')
  let melhor: Coord | null = null
  let nota = -Infinity
  for (const casa of casas) {
    const n = notaCasa(c, tipo, casa)
    if (n > nota) {
      nota = n
      melhor = casa
    }
  }
  return melhor
}

/** Nota da Prefeitura na montagem (BOTS.md §6). */
export function notaPrefeitura(c: Contexto, casa: Coord): number {
  let v = 0
  for (const k of c.mapa.casas) {
    if (distanciaManhattan(casa, k) <= 2) v += c.mapa.terreno[k] === 'varzea' ? 2 : c.mapa.terreno[k] === 'rocha' ? 1.5 : 0
  }
  v += c.params.capital_w * 0.5 * (4 - distanciaACapital(casa, c.mapa))
  if (c.mapa.terreno[casa] === 'rocha') v -= 1
  return v + c.rand() * 0.01
}

export { contar }
