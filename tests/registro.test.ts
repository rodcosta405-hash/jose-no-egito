import { describe, expect, it } from 'vitest'
import { jogarPartidaDeBots } from '../src/bots/simulacao'
import { casasValidasMontagem, novaPartida, pontuacao, proximaMontagem, regras } from '../src/engine'
import type { ConfigJogador } from '../src/engine'
import { formatarTempo, gerarCsv, linhasRegistro } from '../src/ui/registro'
import { carregar, confirmarResumo, criarSessao, executar, passoDoBot, resumoPendente, salvar, vezDoBot, type Sessao } from '../src/ui/sessao'

describe('registro de playtest', () => {
  it('uma linha por ano e a linha final; pontos no ano somam o acumulado', () => {
    const e = jogarPartidaDeBots(['populoso', 'entregador', 'populoso', 'entregador'], 12)
    const linhas = linhasRegistro(e, { 1: 65_000 })
    expect(linhas).toHaveLength(regras.anos.total + 1)
    expect(linhas[0]).toMatchObject({ ano: 1, fase: 'Gorda', carta: e.baralho[0], tempoMs: 65_000 })
    expect(linhas[7]).toMatchObject({ ano: 8, fase: 'Magra' })
    const fim = linhas.at(-1)!
    expect(fim.ano).toBe('Fim')
    e.jogadores.forEach((p, i) => {
      expect(fim.pontos[i]!.acumulado).toBe(pontuacao(p))
      expect(linhas.reduce((s, l) => s + l.pontos[i]!.noAno, 0)).toBe(pontuacao(p))
    })
  })

  it('CSV com BOM, ";" e uma coluna de pontos no ano e acumulado por jogador', () => {
    const e = jogarPartidaDeBots(['populoso', 'entregador'], 3)
    const csv = gerarCsv(e, { 1: 125_000 })
    expect(csv.startsWith('﻿')).toBe(true)
    const linhas = csv.slice(1).trimEnd().split('\r\n')
    expect(linhas[0]).toBe(`Ano;Fase;Carta;Preço;Tempo (min:s);${e.jogadores[0]!.nome} pontos no ano;${e.jogadores[0]!.nome} acumulado;${e.jogadores[1]!.nome} pontos no ano;${e.jogadores[1]!.nome} acumulado`)
    expect(linhas).toHaveLength(1 + regras.anos.total + 1)
    expect(linhas[1]!.split(';')).toHaveLength(9)
    expect(linhas[1]!.split(';')[4]).toBe('2:05')
  })

  it('nomes com ";" ou aspas são escapados', () => {
    const e = novaPartida({ jogadores: [{ nome: 'Ana; "a rainha"', tipo: 'humano' }, { nome: 'Beto', tipo: 'humano' }], margens: 'sorteio', semente: 1 }).estado!
    expect(gerarCsv(e, {})).toContain('"Ana; ""a rainha"" pontos no ano"')
  })

  it('formata o tempo em min:s', () => {
    expect([formatarTempo(0), formatarTempo(59_400), formatarTempo(61_000), formatarTempo(null)]).toEqual(['0:00', '0:59', '1:01', ''])
  })
})

describe('cronômetro dos anos', () => {
  const bots = (n: number): ConfigJogador[] => Array.from({ length: n }, (_, i) => ({ nome: `B${i}`, tipo: 'bot', estrategiaBot: 'populoso' }))

  /** Avança com o relógio andando `passo` ms a cada jogada. */
  function jogar(s: Sessao, relogio: { t: number }, passo: number, ate: (s: Sessao) => boolean): Sessao {
    for (let i = 0; i < 5000 && !ate(s); i++) {
      relogio.t += passo
      s = vezDoBot(s) ? passoDoBot(s, relogio.t) : s
    }
    return s
  }

  it('mede do início do ano até o resumo e não conta a pausa do resumo', () => {
    const relogio = { t: 1_000_000 }
    let s = criarSessao(novaPartida({ jogadores: bots(2), margens: 'sorteio', semente: 2 }).estado!, 'normal', relogio.t)
    s = jogar(s, relogio, 1000, (x) => x.estado.fase === 'acoes')
    const inicioAno1 = relogio.t
    s = jogar(s, relogio, 1000, (x) => resumoPendente(x) !== null)
    expect(s.tempos[1]).toBe(relogio.t - inicioAno1)
    relogio.t += 60_000 // o resumo fica um minuto na tela
    s = confirmarResumo(s, relogio.t)
    const inicioAno2 = relogio.t
    s = jogar(s, relogio, 1000, (x) => resumoPendente(x) !== null)
    expect(s.tempos[2]).toBe(relogio.t - inicioAno2)
  })

  it('o tempo com a página fechada não conta', () => {
    const mem = new Map<string, string>()
    const arm = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: () => {} }
    let s = criarSessao(novaPartida({ jogadores: [{ nome: 'A', tipo: 'humano' }, ...bots(1)], margens: 'sorteio', semente: 3 }).estado!, 'normal', 0)
    while (s.estado.fase === 'montagem') {
      if (vezDoBot(s)) s = passoDoBot(s, 0)
      else {
        const p = proximaMontagem(s.estado)!
        s = executar(s, p.jogador, { tipo: 'montar', edificio: p.edificio, casa: casasValidasMontagem(s.estado)[0]! }, 0).sessao!
      }
    }
    // 10 s jogando, salva e fecha; volta 1 hora depois e joga mais 5 s.
    salvar(s, arm, 10_000)
    s = carregar(arm, 3_610_000)!
    while (!resumoPendente(s)) {
      if (vezDoBot(s)) s = passoDoBot(s, 3_615_000)
      else s = executar(s, s.estado.vez, s.estado.fase === 'alocacao' ? { tipo: 'alocar', casas: [] } : { tipo: 'passar' }, 3_615_000).sessao!
    }
    expect(s.tempos[1]).toBe(15_000)
  })
})
