import { describe, expect, it } from 'vitest'
import { agirBot, alocarBot, botAceitaComercio, estrategias, jogadaDoBot } from '../src/bots'
import { criarContexto, excedente, melhorCasa, necessidadeMagra, prodMagra, pyRound } from '../src/bots/helpers'
import { jogarPartidaDeBots, simular } from '../src/bots/simulacao'
import { aplicar, novaPartida, pontuacao, validarAcao } from '../src/engine'
import type { GameState } from '../src/engine'
import { cenario } from './helpers'

/** Cenário de teste com os dois jogadores como bots. */
const comBots = (opcoes: Parameters<typeof cenario>[0] = {}, a = 'populoso', b = 'entregador'): GameState => {
  const e = cenario(opcoes)
  return {
    ...e,
    jogadores: e.jogadores.map((p) => ({ ...p, tipo: 'bot' as const, estrategiaBot: p.id === 0 ? a : b })),
  }
}

describe('helpers dos bots', () => {
  it('round do Python: empates para o par', () => {
    expect([pyRound(0.5), pyRound(1.5), pyRound(2.5), pyRound(-1.5), pyRound(2.6), pyRound(2.4)]).toEqual([0, 2, 2, -2, 3, 2])
  })

  it('necessidade magra: anos restantes × (W − produção esperada)', () => {
    // 2 trabalhadores, 1 Campo; taxa média magra = 0,5; ano 1 → 7 anos magros pela frente.
    const e = comBots({ edificios0: { C4: 'prefeitura', B4: 'residencia', B3: 'campo' } })
    const c = criarContexto(e, 0)
    expect(prodMagra(c, 2, 'media')).toBe(0.5)
    expect(necessidadeMagra(c)).toBeCloseTo(7 * (2 - 0.5))
    expect(necessidadeMagra(c, 0, 'pess')).toBe(14)
    // Ano 10: restam 5 anos magros.
    expect(necessidadeMagra(criarContexto(comBots({ ano: 10, edificios0: { C4: 'prefeitura', B4: 'residencia', B3: 'campo' } }), 0))).toBeCloseTo(7.5)
  })

  it('excedente do vizinho: acima do alvo de estoque (gordos) ou da necessidade pessimista (magros)', () => {
    // Beto (entregador, store 1,84): 2 trabalhadores, sem Campo → necessidade 14, alvo 25,76.
    const gordo = comBots({ j1: { cereal: 30 } })
    expect(excedente(criarContexto(gordo, 0), 1)).toBe(4)
    const magro = comBots({ ano: 12, j1: { cereal: 30 } })
    // Ano 12: 3 anos magros → necessidade pessimista 6.
    expect(excedente(criarContexto(magro, 0), 1)).toBe(24)
  })

  it('melhorCasa: Campo prefere a várzea; Mercado evita várzea e rocha', () => {
    const e = comBots()
    const c = criarContexto(e, 0)
    expect(c.mapa.terreno[melhorCasa(c, 'campo')!]).toBe('varzea')
    const m = melhorCasa(c, 'mercado')!
    expect(['varzea', 'rocha']).not.toContain(c.mapa.terreno[m])
  })
})

describe('decisões dos bots', () => {
  it('ano magro com fome à vista: compra cereal da Capital até o teto', () => {
    // Populoso (lean_buy 8), 2 trabalhadores, 0 cereal, preço 5: compra 2 (6 + 7).
    const e = comBots({ ano: 9, j0: { cereal: 0, ouro: 20 }, extra: { preco: 5 } })
    expect(agirBot(e, 0)).toEqual({ tipo: 'comerciar', com: 'capital', recurso: 'cereal', direcao: 'comprar', quantidade: 2 })
  })

  it('ano magro com cereal sobrando: entrega a José', () => {
    const e = comBots({ ano: 13, j0: { cereal: 10 } })
    const a = agirBot(e, 0)
    expect(a.tipo).toBe('entregar')
    expect(validarAcao(e, 0, a)).toBeNull()
  })

  it('falta só pedra: compra a pedra que falta da Capital', () => {
    // Populoso quer Residência (2 ouro + 2 pedra), tem 5 ouro e 0 pedra.
    const e = comBots({ j0: { ouro: 6, pedra: 0, cereal: 0 } })
    expect(agirBot(e, 0)).toEqual({ tipo: 'comerciar', com: 'capital', recurso: 'pedra', direcao: 'comprar', quantidade: 2 })
  })

  it('alocação: Mercados primeiro (mk_first), depois Campos, Pedreiras', () => {
    const e = comBots({
      edificios0: { C4: 'prefeitura', B4: 'residencia', B5: 'residencia', C3: 'mercado', C5: 'campo', B3: 'campo', A2: 'pedreira' },
      j0: { cereal: 0 },
    })
    expect(alocarBot({ ...e, fase: 'alocacao' }, 0)).toEqual(['C3', 'C5', 'B3', 'A2'])
  })

  it('não muta o estado e decide igual na mesma situação', () => {
    const e = comBots({ j0: { ouro: 10, pedra: 5 } })
    const antes = JSON.stringify(e)
    const a = agirBot(e, 0)
    expect(JSON.stringify(e)).toBe(antes)
    expect(agirBot(e, 0)).toEqual(a)
  })
})

describe('bot como parceiro de um humano', () => {
  it('vende até o excedente; recusa pedra; recusa comprar nos anos gordos', () => {
    const e = comBots({ j1: { cereal: 30 } })
    const pedido = (q: number, direcao: 'comprar' | 'vender', recurso: 'cereal' | 'pedra' = 'cereal') =>
      botAceitaComercio(e, 1, { tipo: 'comerciar', com: 1, recurso, direcao, quantidade: q })
    expect(pedido(4, 'comprar').aceita).toBe(true)
    expect(pedido(5, 'comprar')).toEqual({ aceita: false, motivo: 'Beto só vende 4 cereal' })
    expect(pedido(1, 'comprar', 'pedra').aceita).toBe(false)
    expect(pedido(1, 'vender')).toEqual({ aceita: false, motivo: 'Beto não compra cereal nos anos gordos' })
  })

  it('nos anos magros compra se o preço está bom e falta cereal para o ano', () => {
    const e = comBots({ ano: 9, j1: { cereal: 0 }, extra: { preco: 5 } })
    expect(botAceitaComercio(e, 1, { tipo: 'comerciar', com: 1, recurso: 'cereal', direcao: 'vender', quantidade: 2 }).aceita).toBe(true)
    const caro = { ...e, preco: 9 }
    expect(botAceitaComercio(caro, 1, { tipo: 'comerciar', com: 1, recurso: 'cereal', direcao: 'vender', quantidade: 2 }).aceita).toBe(false)
  })
})

describe('partidas só com bots', () => {
  it('cada estratégia joga 30 partidas sem nenhuma ação recusada', () => {
    for (const est of estrategias) {
      for (let s = 0; s < 10; s++) {
        const e = jogarPartidaDeBots([est.id, 'populoso', 'entregador', 'entregador_cauteloso'], 500 + s)
        expect(e.fase).toBe('fim')
      }
    }
    expect(() => simular(['populoso', 'entregador'], 20, 900)).not.toThrow()
    expect(() => simular(['entregador_cauteloso', 'populoso', 'entregador'], 20, 950)).not.toThrow()
  })

  it('mesma semente, mesma partida', () => {
    const a = jogarPartidaDeBots(['populoso', 'entregador', 'populoso', 'entregador'], 42)
    const b = jogarPartidaDeBots(['populoso', 'entregador', 'populoso', 'entregador'], 42)
    expect(a.log).toEqual(b.log)
    expect(a.jogadores.map(pontuacao)).toEqual(b.jogadores.map(pontuacao))
  })

  it('humano + bots: humano sempre passa, bots jogam na vez deles, partida termina', () => {
    let e = novaPartida({
      jogadores: [
        { nome: 'Rodrigo', tipo: 'humano' },
        { nome: 'Bot 1', tipo: 'bot', estrategiaBot: 'populoso' },
        { nome: 'Bot 2', tipo: 'bot', estrategiaBot: 'entregador' },
      ],
      margens: 'sorteio',
      semente: 3,
    }).estado!
    while (e.fase !== 'fim') {
      const humano = e.jogadores[e.vez]!.tipo === 'humano'
      let jogada
      if (!humano) jogada = jogadaDoBot(e)
      else if (e.fase === 'montagem') jogada = jogadaDoBot({ ...e, jogadores: e.jogadores.map((p) => ({ ...p, estrategiaBot: 'populoso' })) })
      else jogada = { jogador: e.vez, acao: e.fase === 'alocacao' ? { tipo: 'alocar' as const, casas: [] } : { tipo: 'passar' as const } }
      const r = aplicar(e, jogada.jogador, jogada.acao)
      if (!r.estado) throw new Error(r.erro)
      e = r.estado
    }
    expect(e.classificacao).toHaveLength(3)
  })
})
