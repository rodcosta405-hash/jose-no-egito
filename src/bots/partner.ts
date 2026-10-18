// Bot como parceiro de comércio de um humano (docs/BOTS.md seção 7).
import type { Action, GameState, Regras } from '../engine'
import { anoGordo, criarContexto, excedente, W } from './helpers'

export interface RespostaComercio {
  aceita: boolean
  motivo: string
}

/**
 * O bot `bot` aceita a proposta de comércio que `humano` quer fazer com ele?
 * `acao.direcao` é do ponto de vista do humano.
 */
export function botAceitaComercio(
  estado: GameState,
  bot: number,
  acao: Extract<Action, { tipo: 'comerciar' }>,
  r?: Regras,
): RespostaComercio {
  const c = criarContexto(estado, bot, r)
  const nome = c.p.nome
  if (acao.recurso === 'pedra') return { aceita: false, motivo: `${nome} não negocia pedra` }

  if (acao.direcao === 'comprar') {
    const e = excedente(c, bot)
    if (acao.quantidade <= e) return { aceita: true, motivo: `${nome} aceita vender` }
    return { aceita: false, motivo: e > 0 ? `${nome} só vende ${e} cereal` : `${nome} não tem cereal sobrando` }
  }

  if (anoGordo(c)) return { aceita: false, motivo: `${nome} não compra cereal nos anos gordos` }
  if (estado.preco > c.params.lean_buy) return { aceita: false, motivo: `${nome} acha o preço alto demais` }
  if (c.p.cereal >= W(c) * c.r.populacao.consumoPorTrabalhador) return { aceita: false, motivo: `${nome} já tem cereal para este ano` }
  return { aceita: true, motivo: `${nome} aceita comprar` }
}
