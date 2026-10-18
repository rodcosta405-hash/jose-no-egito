import { describe, expect, it } from 'vitest'
import {
  acoesDisponiveis,
  aplicar,
  casasValidasConstrucao,
  casasValidasMontagem,
  edificiosDe,
  novaPartida,
  pontosDeSobras,
  pontuacao,
  precisaTrabalhador,
  proximaMontagem,
  pvImpressos,
  regras,
  trabalhadores,
} from '../src/engine'
import type { Action, GameState } from '../src/engine'
import { resolverAno } from '../src/engine/year'
import { cenario, jogador, ok as okCom } from './helpers'

const ok = (e: GameState, j: number, a: Action) => okCom(aplicar, e, j, a)
const resumoDe = (e: GameState, j: number) => e.resumos[e.resumos.length - 1]!.jogadores[j]!

/** Cenário na fase de alocação, pronto para resolverAno. */
const naAlocacao = (opcoes: Parameters<typeof cenario>[0], alocacao0: string[] = []) => {
  const e = cenario(opcoes)
  return { ...e, fase: 'alocacao' as const, jogadores: e.jogadores.map((p) => (p.id === 0 ? { ...p, alocacao: alocacao0 } : p)) }
}

describe('alocação', () => {
  const alocando = () => ({ ...cenario({ edificios0: { C4: 'prefeitura', B4: 'residencia', C3: 'mercado', B3: 'campo', A3: 'pedreira' } }), fase: 'alocacao' as const })

  it('no máximo W trabalhadores, 1 por edifício, só em Campo, Pedreira e Mercado próprios', () => {
    const e = alocando()
    expect(aplicar(e, 0, { tipo: 'alocar', casas: ['C3', 'B3', 'A3'] }).erro).toBe('Você tem só 2 trabalhadores')
    expect(aplicar(e, 0, { tipo: 'alocar', casas: ['C3', 'C3'] }).erro).toBe('No máximo 1 trabalhador por edifício')
    expect(aplicar(e, 0, { tipo: 'alocar', casas: ['B4'] }).erro).toBe('Residência não recebe trabalhador')
    expect(aplicar(e, 0, { tipo: 'alocar', casas: ['H2'] }).erro).toBe('A casa H2 não tem edifício seu')
    expect(aplicar(e, 1, { tipo: 'alocar', casas: [] }).erro).toBe('Não é a sua vez: agora aloca Ana')
  })

  it('o último a alocar resolve o ano e abre o próximo', () => {
    let e = ok(alocando(), 0, { tipo: 'alocar', casas: ['C3', 'B3'] })
    expect(e.fase).toBe('alocacao')
    expect(e.vez).toBe(1)
    e = ok(e, 1, { tipo: 'alocar', casas: ['H2'] })
    expect(e.ano).toBe(2)
    expect(e.fase).toBe('acoes')
    expect(e.resumos).toHaveLength(1)
    expect(e.cartasReveladas).toEqual([e.baralho[0]])
  })
})

describe('resolução do ano', () => {
  it('alimentação: 6 trabalhadores e 4 cereais fazem 0 pontos e zeram o cereal', () => {
    const e = resolverAno(
      naAlocacao({ edificios0: { C4: 'prefeitura', B4: 'residencia', B5: 'residencia', B6: 'residencia' }, j0: { cereal: 4 } }),
    )
    const p = jogador(e, 0)
    expect(trabalhadores(e, 0)).toBe(6)
    expect(p.cereal).toBe(0)
    expect(p.placar.alimentacao + p.placar.fome).toBe(0)
    expect(p.placar.alimentacao).toBe(4)
    expect(p.placar.fome).toBe(-4)
    expect(resumoDe(e, 0)).toMatchObject({ alimentados: 4, semComida: 2, pontosAno: 0 })
  })

  it('cereal acima da capacidade é descartado depois da alimentação', () => {
    const e = resolverAno(naAlocacao({ j0: { cereal: 20 } }))
    // 2 trabalhadores comem 2; sobram 18; capacidade da Prefeitura é 5.
    expect(jogador(e, 0).cereal).toBe(5)
    expect(resumoDe(e, 0).descartado).toBe(13)
  })

  it('Campo na várzea: carta + 1 nos anos gordos, só a carta nos magros', () => {
    const ed = { C4: 'prefeitura', B4: 'residencia', C5: 'campo' } as const
    const baralho = [4, 4, 4, 4, 4, 4, 4, 1, 1, 1, 1, 1, 1, 1]
    const gordo = resolverAno(naAlocacao({ ano: 1, edificios0: ed, extra: { baralho } }, ['C5']))
    expect(resumoDe(gordo, 0).producao.cereal).toBe(5)
    const magro = resolverAno(naAlocacao({ ano: 8, edificios0: ed, extra: { baralho } }, ['C5']))
    expect(resumoDe(magro, 0).producao.cereal).toBe(1)
    // Fora da várzea, só a carta.
    const seco = resolverAno(naAlocacao({ ano: 1, edificios0: { C4: 'prefeitura', B4: 'residencia', B3: 'campo' }, extra: { baralho } }, ['B3']))
    expect(resumoDe(seco, 0).producao.cereal).toBe(4)
  })

  it('Grande Mercado produz 5 ouros; Pedreira em rocha e Pedreira Profunda ganham bônus', () => {
    const e = resolverAno(
      naAlocacao(
        {
          edificios0: { C4: 'prefeitura', B4: 'residencia', B5: 'residencia', C3: ['mercado', true], A2: 'pedreira', B3: ['pedreira', true] },
        },
        ['C3', 'A2', 'B3'],
      ),
    )
    expect(resumoDe(e, 0).producao.ouro).toBe(5)
    // A2 é rocha: 2 + 1. B3 evoluída: 2 + 1.
    expect(resumoDe(e, 0).producao.pedra).toBe(6)
  })

  it('preço anda 1 casa em direção à âncora da fase', () => {
    expect(resolverAno(naAlocacao({ ano: 1, extra: { preco: 4 } })).preco).toBe(3)
    expect(resolverAno(naAlocacao({ ano: 1, extra: { preco: 2 } })).preco).toBe(2)
    expect(resolverAno(naAlocacao({ ano: 8, extra: { preco: 4 } })).preco).toBe(5)
    expect(resolverAno(naAlocacao({ ano: 8, extra: { preco: 9 } })).preco).toBe(8)
  })

  it('o primeiro jogador gira 1 assento por ano; a demanda é 0 nos gordos e 4 nos magros', () => {
    const e2 = resolverAno(naAlocacao({ ano: 1 }))
    expect(e2.primeiro).toBe(1)
    expect(e2.vez).toBe(1)
    expect(e2.demandaCapital).toBe(0)
    const e3 = resolverAno({ ...e2, fase: 'alocacao' })
    expect(e3.primeiro).toBe(0)
    const e8 = resolverAno(naAlocacao({ ano: 7 }))
    expect(e8.ano).toBe(8)
    expect(e8.demandaCapital).toBe(regras.contratos.demandaPorAnoMagro)
  })
})

describe('fim de jogo', () => {
  it('Mercado, Campo e Pedreira sem trabalhador no ano 14 não contam PV', () => {
    const ed = { C4: 'prefeitura', B4: 'residencia', C3: 'mercado', B3: 'campo', A3: 'pedreira', B5: ['armazem', true] } as const
    const operando = cenario({ edificios0: ed, j0: { alocacao: ['C3', 'B3', 'A3'] } })
    const parado = cenario({ edificios0: ed, j0: { alocacao: [] } })
    // Prefeitura 0 + Residência 1 + Celeiro Real 3 = 4; operando soma Mercado 2 + Campo 1 + Pedreira 1.
    expect(pvImpressos(parado, 0)).toBe(4)
    expect(pvImpressos(operando, 0)).toBe(8)
  })

  it('sobras: 9 ouros, 5 cereais e 7 pedras valem 5 pontos', () => {
    expect(pontosDeSobras({ ouro: 9, cereal: 5, pedra: 7 })).toBe(5)
  })

  it('o ano 14 encerra a partida com PV, sobras e classificação', () => {
    const e = resolverAno(naAlocacao({ ano: 14, j0: { ouro: 8 }, j1: { ouro: 0 } }))
    expect(e.fase).toBe('fim')
    const p = jogador(e, 0)
    expect(p.placar.impressos).toBe(1) // Residência; Mercado sem trabalhador
    expect(p.placar.sobras).toBe(2 + 0 + Math.floor(p.pedra / regras.fimDeJogo.pedraPorPonto))
    expect(e.classificacao![0]!.jogador).toBe(0)
    expect(aplicar(e, 0, { tipo: 'passar' }).erro).toBe('A partida terminou')
  })

  it('desempate: alimentados no ano 14, depois cereal guardado', () => {
    const e = resolverAno(naAlocacao({ ano: 14, j0: { cereal: 2, ouro: 0, pedra: 0 }, j1: { cereal: 3, ouro: 0, pedra: 0 } }))
    // Ambos alimentam 2; Beto guarda 1 cereal a mais mas não muda as sobras (⌊0/2⌋ = ⌊1/2⌋).
    expect(pontuacao(jogador(e, 0))).toBe(pontuacao(jogador(e, 1)))
    expect(e.classificacao!.map((c) => [c.jogador, c.posicao])).toEqual([
      [1, 1],
      [0, 2],
    ])
    expect(e.classificacao![0]!.criterio).toBe('cerealGuardado')
  })
})

describe('partida completa', () => {
  /** Jogada simples e determinística: tenta construir, depois entregar, senão passa. */
  function jogadaSimples(e: GameState): Action {
    const j = e.vez
    if (e.fase === 'alocacao') {
      const comTrabalho = edificiosDe(e, j)
        .filter(([, t]) => precisaTrabalhador(t.type))
        .sort(([, a], [, b]) => Number(b.type === 'campo') - Number(a.type === 'campo'))
        .map(([c]) => c)
      return { tipo: 'alocar', casas: comTrabalho.slice(0, trabalhadores(e, j)) }
    }
    const disp = acoesDisponiveis(e, j)
    if (disp.entregar === null) return { tipo: 'entregar', quantidade: 1 }
    for (const ed of ['residencia', 'campo', 'armazem', 'mercado'] as const) {
      const casa = casasValidasConstrucao(e, j, ed)[0]
      if (casa) return { tipo: 'construir', edificio: ed, casa }
    }
    return { tipo: 'passar' }
  }

  it('4 jogadores, do início ao fim, sem ações recusadas e com o placar fechando', () => {
    let e = novaPartida({
      jogadores: ['A', 'B', 'C', 'D'].map((nome) => ({ nome, tipo: 'humano' as const })),
      margens: 'sorteio',
      semente: 2026,
    }).estado!
    while (e.fase === 'montagem') {
      const prox = proximaMontagem(e)!
      e = ok(e, prox.jogador, { tipo: 'montar', edificio: prox.edificio, casa: casasValidasMontagem(e)[0]! })
    }
    let passos = 0
    while (e.fase !== 'fim') {
      e = ok(e, e.vez, jogadaSimples(e))
      if (++passos > 10_000) throw new Error('partida não terminou')
    }
    expect(e.ano).toBe(regras.anos.total)
    expect(e.resumos).toHaveLength(regras.anos.total)
    expect(e.cartasReveladas).toEqual(e.baralho)
    for (const c of e.classificacao!) {
      const p = jogador(e, c.jogador)
      const s = p.placar
      expect(c.total).toBe(s.alimentacao + s.fome + s.contratos + s.impressos + s.sobras)
    }
    expect(e.jogadores.some((p) => p.placar.contratos > 0)).toBe(true)
  })
})
