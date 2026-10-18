// Validação e aplicação de ações. Por enquanto só a montagem (Fase 1); as demais vêm na Fase 2.
import { regras as regrasPadrao, type Regras } from './config'
import { montar } from './setup'
import type { Action, GameState, ResultadoAcao } from './types'

export function aplicar(estado: GameState, jogador: number, acao: Action, r: Regras = regrasPadrao): ResultadoAcao {
  if (estado.fase === 'montagem' && acao.tipo !== 'montar') return { erro: 'Termine a montagem antes de outras ações' }
  switch (acao.tipo) {
    case 'montar':
      return montar(estado, jogador, acao, r)
    default:
      return { erro: 'Ação ainda não disponível' }
  }
}
