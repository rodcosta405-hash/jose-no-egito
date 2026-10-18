import { novaPartida } from '../src/engine'
import type { Action, BuildingType, GameState, PlayerState, Tile } from '../src/engine'

type Edificios = Record<string, BuildingType | readonly [BuildingType, boolean]>

/**
 * Cenário de teste com 2 jogadores já montados, no ano pedido, fase de ações, vez do jogador 0.
 * Jogador 0 (oeste): Prefeitura em C4, vizinha da Capital. Jogador 1 (leste): Prefeitura em H1, longe da Capital.
 */
export function cenario(opcoes: {
  ano?: number
  edificios0?: Edificios
  edificios1?: Edificios
  j0?: Partial<PlayerState>
  j1?: Partial<PlayerState>
  extra?: Partial<GameState>
} = {}): GameState {
  const base = novaPartida({
    jogadores: [
      { nome: 'Ana', tipo: 'humano' },
      { nome: 'Beto', tipo: 'humano' },
    ],
    margens: ['oeste', 'leste'],
    semente: 1,
  }).estado!
  const tabuleiro: Record<string, Tile> = {}
  const por = (owner: number, ed: Edificios) => {
    for (const [casa, v] of Object.entries(ed)) {
      const [type, evoluido] = Array.isArray(v) ? v : [v, false]
      tabuleiro[casa] = { owner, type, evoluido }
    }
  }
  por(0, opcoes.edificios0 ?? { C4: 'prefeitura', B4: 'residencia', C3: 'mercado' })
  por(1, opcoes.edificios1 ?? { H1: 'prefeitura', G1: 'residencia', H2: 'mercado' })
  const ano = opcoes.ano ?? 1
  return {
    ...base,
    ordem: [0, 1],
    primeiro: 0,
    vez: 0,
    volta: 1,
    ano,
    fase: 'acoes',
    montagem: null,
    tabuleiro,
    demandaCapital: ano > 7 ? 4 : 0,
    jogadores: base.jogadores.map((p) => ({ ...p, ...(p.id === 0 ? opcoes.j0 : opcoes.j1) })),
    ...opcoes.extra,
  }
}

export function jogador(e: GameState, id: number): PlayerState {
  return e.jogadores[id]!
}

/** Aplica e falha o teste se a ação for recusada. */
export function ok(aplicarFn: (e: GameState, j: number, a: Action) => { estado?: GameState; erro?: string }, e: GameState, j: number, a: Action): GameState {
  const r = aplicarFn(e, j, a)
  if (!r.estado) throw new Error(`Ação recusada: ${r.erro}`)
  return r.estado
}
