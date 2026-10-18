// API pública dos bots: só leem o estado e devolvem ações.
import type { Action, GameState, Regras } from '../engine'
import { alocarBot } from './allocate'
import { agirBot } from './policy'
import { montarBot } from './setup'

export { estrategias, estrategiaPorId, referenciaDeResultados } from './config'
export type { Estrategia, ParametrosBot } from './config'
export { botAceitaComercio } from './partner'
export type { RespostaComercio } from './partner'
export { agirBot, alocarBot, montarBot }

/** Jogada do bot que deve agir agora (montagem, ação do ano ou alocação). */
export function jogadaDoBot(estado: GameState, r?: Regras): { jogador: number; acao: Action } {
  if (estado.fase === 'montagem') return montarBot(estado, r)
  const jogador = estado.vez
  if (estado.fase === 'alocacao') return { jogador, acao: { tipo: 'alocar', casas: alocarBot(estado, jogador, r) } }
  if (estado.fase === 'acoes') return { jogador, acao: agirBot(estado, jogador, r) }
  throw new Error('A partida terminou')
}

/** Quem deve agir agora (para a interface saber se é a vez de um bot). */
export function quemAge(estado: GameState): number | null {
  return estado.fase === 'fim' ? null : estado.vez
}
