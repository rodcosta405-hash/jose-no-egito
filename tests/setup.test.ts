import { describe, expect, it } from 'vitest'
import { regras } from '../src/engine/config'
import { aplicar, casasValidasMontagem, novaPartida, obterMapa, proximaMontagem } from '../src/engine'
import type { ConfigPartida, GameState, Margem } from '../src/engine'

const config = (semente = 1, n = 4): ConfigPartida => ({
  jogadores: Array.from({ length: n }, (_, i) => ({ nome: `J${i + 1}`, tipo: 'humano' as const })),
  margens: 'sorteio',
  semente,
})

function partida(c: ConfigPartida = config()): GameState {
  const r = novaPartida(c)
  if (!r.estado) throw new Error(r.erro)
  return r.estado
}

/** O jogador da vez tenta pôr o edifício esperado na casa. */
function tentar(e: GameState, casa: string) {
  const prox = proximaMontagem(e)!
  return aplicar(e, prox.jogador, { tipo: 'montar', edificio: prox.edificio, casa })
}

/** Faz uma jogada de montagem válida (primeira casa válida). */
function montarUma(e: GameState): GameState {
  const r = tentar(e, casasValidasMontagem(e)[0]!)
  if (!r.estado) throw new Error(r.erro)
  return r.estado
}

describe('nova partida', () => {
  it('mesma semente gera o mesmo baralho; sementes diferentes, baralhos diferentes', () => {
    expect(partida(config(123)).baralho).toEqual(partida(config(123)).baralho)
    expect(partida(config(1)).baralho).not.toEqual(partida(config(2)).baralho)
  })

  it('baralho: 7 gordas seguidas de 7 magras', () => {
    const b = partida().baralho
    const k = regras.cartas.sorteadasPorFase
    expect(b).toHaveLength(2 * k)
    for (const c of b.slice(0, k)) expect(regras.cartas.gordas).toContain(c)
    for (const c of b.slice(k)) expect(regras.cartas.magras).toContain(c)
  })

  it('recursos iniciais, estoque, preço, demanda e ordem', () => {
    const e = partida()
    for (const p of e.jogadores) {
      expect([p.ouro, p.pedra, p.cereal]).toEqual([regras.inicial.ouro, regras.inicial.pedra, regras.inicial.cereal])
    }
    expect(e.estoque).toEqual(regras.estoqueDeTiles)
    expect(e.preco).toBe(regras.precoCereal.inicio)
    expect(e.demandaCapital).toBe(0)
    expect(e.fase).toBe('montagem')
    expect([...e.ordem].sort()).toEqual([0, 1, 2, 3])
    expect(e.primeiro).toBe(e.ordem[0])
    expect(e.vez).toBe(e.primeiro)
  })

  it('margens sorteadas ficam equilibradas', () => {
    for (let s = 0; s < 30; s++) {
      expect(partida(config(s)).jogadores.filter((p) => p.margem === 'oeste')).toHaveLength(2)
      expect(partida(config(s, 3)).jogadores.filter((p) => p.margem === 'oeste').length).toBeGreaterThanOrEqual(1)
    }
  })

  it('margens escolhidas: recusa mais de 2 na mesma margem', () => {
    const r = novaPartida({ ...config(), margens: ['oeste', 'oeste', 'oeste', 'leste'] })
    expect(r.erro).toBe('No máximo 2 jogadores na margem oeste')
  })

  it('recusa número de jogadores fora do limite', () => {
    expect(novaPartida(config(1, 1)).erro).toBe('A partida precisa de 2 a 4 jogadores')
    expect(novaPartida(config(1, 5)).erro).toBe('A partida precisa de 2 a 4 jogadores')
  })

  it('não muta o estado de entrada', () => {
    const e = partida()
    const antes = JSON.stringify(e)
    montarUma(e)
    expect(JSON.stringify(e)).toBe(antes)
  })
})

describe('montagem', () => {
  const margemDaVez = (e: GameState): Margem => e.jogadores[proximaMontagem(e)!.jogador]!.margem

  it('Prefeitura fora da própria margem é recusada', () => {
    const e = partida()
    const m = margemDaVez(e)
    expect(tentar(e, m === 'oeste' ? 'H5' : 'A4').erro).toBe(`A Prefeitura deve ficar na sua margem (${m})`)
  })

  it('Prefeitura na várzea é recusada', () => {
    expect(tentar(partida(), 'C5').erro).toBe('Só Campos podem ser construídos na várzea')
  })

  it('Capital, casa ocupada e casa inexistente são recusadas', () => {
    const e = partida()
    expect(tentar(e, 'D4').erro).toBe('A Capital não recebe construções')
    expect(tentar(e, 'J9').erro).toBe('A casa J9 não existe no mapa')
    const casa = casasValidasMontagem(e)[0]!
    const depois = tentar(e, casa).estado!
    expect(tentar(depois, casa).erro).toBe(`A casa ${casa} já está ocupada`)
  })

  it('fora da vez e edifício fora da ordem são recusados', () => {
    const e = partida()
    const prox = proximaMontagem(e)!
    expect(aplicar(e, e.ordem[1]!, { tipo: 'montar', edificio: 'prefeitura', casa: 'A4' }).erro).toMatch(/^Não é a sua vez/)
    expect(aplicar(e, prox.jogador, { tipo: 'montar', edificio: 'mercado', casa: 'A4' }).erro).toBe('Agora coloque: Prefeitura')
  })

  it('Residência desconectada é recusada', () => {
    let e = partida()
    const [pref, longe] = margemDaVez(e) === 'oeste' ? ['A8', 'B3'] : ['H1', 'G6']
    e = tentar(e, pref!).estado!
    expect(tentar(e, longe!).erro).toBe('Coloque ao lado de um edifício seu')
  })

  it('casas válidas para a Prefeitura são as 23 da própria margem', () => {
    const e = partida()
    const m = margemDaVez(e)
    expect([...casasValidasMontagem(e)].sort()).toEqual([...obterMapa().casasDaMargem[m]].sort())
  })

  it('a segunda volta acontece na ordem inversa e a montagem leva ao ano 1', () => {
    let e = partida()
    const n = e.ordem.length
    const voltaUm = regras.montagem.primeiraVolta.length
    const voltaDois = regras.montagem.segundaVolta.length
    const primeira: number[] = []
    for (let i = 0; i < n * voltaUm; i++) {
      if (i % voltaUm === 0) primeira.push(proximaMontagem(e)!.jogador)
      e = montarUma(e)
    }
    expect(primeira).toEqual(e.ordem)
    const segunda: number[] = []
    for (let i = 0; i < n * voltaDois; i++) {
      if (i % voltaDois === 0) segunda.push(proximaMontagem(e)!.jogador)
      e = montarUma(e)
    }
    expect(segunda).toEqual([...e.ordem].reverse())
    expect(e.fase).toBe('acoes')
    expect(e.ano).toBe(1)
    expect(e.vez).toBe(e.primeiro)
    expect(e.montagem).toBeNull()
    expect(Object.keys(e.tabuleiro)).toHaveLength(n * regras.inicial.edificios.length)
    // Edifícios iniciais não consomem estoque nem recursos.
    expect(e.estoque).toEqual(regras.estoqueDeTiles)
    for (const p of e.jogadores) expect(p.ouro).toBe(regras.inicial.ouro)
  })

  it('Campo na várzea é aceito; Pedreira na várzea é recusada', () => {
    let e = partida()
    // Oeste: Prefeitura em C4, vizinha da várzea em C5. Leste: canto H1.
    const casas: Record<Margem, string[][]> = {
      oeste: [['C4', 'B4', 'C3'], ['A8', 'B8', 'A7']],
      leste: [['F5', 'G5', 'F6'], ['H1', 'G1', 'H2']],
    }
    for (const j of e.ordem) {
      for (const c of casas[e.jogadores[j]!.margem].shift()!) e = tentar(e, c).estado!
    }
    const dono = e.tabuleiro['C4']!.owner
    while (proximaMontagem(e)!.jogador !== dono) e = montarUma(e)
    expect(proximaMontagem(e)!.edificio).toBe('campo')
    expect(casasValidasMontagem(e)).toContain('C5')
    const comCampo = tentar(e, 'C5')
    expect(comCampo.erro).toBeUndefined()
    expect(comCampo.estado!.tabuleiro['C5']).toEqual({ owner: dono, type: 'campo', evoluido: false })
    // C6 é várzea vizinha do Campo em C5: a Pedreira não pode ir para lá.
    expect(tentar(comCampo.estado!, 'C6').erro).toBe('Só Campos podem ser construídos na várzea')
    expect(casasValidasMontagem(comCampo.estado!)).not.toContain('C6')
  })

  it('jogador cercado pode montar em qualquer casa livre da própria margem (provisório)', () => {
    // Semente 1 sempre na primeira casa válida: o jogador que abre em A1 fica cercado na Pedreira.
    let e = partida(config(1))
    while (!(proximaMontagem(e)!.edificio === 'pedreira' && e.tabuleiro['A1']?.owner === proximaMontagem(e)!.jogador)) {
      e = montarUma(e)
    }
    const j = proximaMontagem(e)!.jogador
    const validas = casasValidasMontagem(e)
    expect(validas.length).toBeGreaterThan(0)
    const mapa = obterMapa()
    for (const c of validas) {
      expect(mapa.margem[c]).toBe(e.jogadores[j]!.margem)
      expect(mapa.vizinhos[c]!.some((v) => e.tabuleiro[v]?.owner === j)).toBe(false)
    }
    expect(tentar(e, 'H5').erro).toMatch(/^Sem espaço ao lado dos seus edifícios/)
  })

  it('ações de jogo são recusadas durante a montagem', () => {
    const e = partida()
    expect(aplicar(e, e.vez, { tipo: 'passar' }).erro).toBe('Termine a montagem antes de outras ações')
  })
})
