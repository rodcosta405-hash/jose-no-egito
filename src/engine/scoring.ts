// Pontuação final, desempate e placar por fonte (docs/REGRAS.md seções 8 e 9).
import { regras as regrasPadrao, type Regras } from './config'
import { edificiosDe, pontuacao } from './queries'
import type { Classificado, CriterioDesempate, GameState, PlayerState } from './types'

/** PV impressos no lado visível; Mercado, Campo e Pedreira só contam se tiveram trabalhador no último ano. */
export function pvImpressos(estado: GameState, jogador: number, r: Regras = regrasPadrao): number {
  const p = estado.jogadores[jogador]
  if (!p) return 0
  let total = 0
  for (const [casa, t] of edificiosDe(estado, jogador)) {
    const def = r.edificios[t.type] as { pv: number; pvSoSeOperando?: boolean; verso?: { pv: number } }
    if (def.pvSoSeOperando && !p.alocacao.includes(casa)) continue
    total += t.evoluido && def.verso ? def.verso.pv : def.pv
  }
  return total
}

export function pontosDeSobras(p: Pick<PlayerState, 'ouro' | 'cereal' | 'pedra'>, r: Regras = regrasPadrao): number {
  const f = r.fimDeJogo
  return Math.floor(p.ouro / f.ouroPorPonto) + Math.floor(p.cereal / f.cerealPorPonto) + Math.floor(p.pedra / f.pedraPorPonto)
}

const valorDesempate: Record<string, (p: PlayerState) => number> = {
  trabalhadoresAlimentadosNoAno14: (p) => p.alimentadosUltimoAno,
  cerealGuardado: (p) => p.cereal,
}
export const criteriosDeDesempate = Object.keys(valorDesempate)

/** Ordena por pontos e pelos critérios de `desempate`; empatados em tudo dividem a posição. */
export function classificar(jogadores: PlayerState[], r: Regras = regrasPadrao): Classificado[] {
  const chaves: [CriterioDesempate, (p: PlayerState) => number][] = [
    ['pontos', pontuacao],
    ...r.desempate.map((k) => [k as CriterioDesempate, valorDesempate[k] ?? (() => 0)] as [CriterioDesempate, (p: PlayerState) => number]),
  ]
  const comparar = (a: PlayerState, b: PlayerState): number => {
    for (const [, f] of chaves) if (f(a) !== f(b)) return f(b) - f(a)
    return 0
  }
  const ordenados = [...jogadores].sort((a, b) => comparar(a, b) || a.id - b.id)
  const lista: Classificado[] = []
  ordenados.forEach((p, i) => {
    const anterior = ordenados[i - 1]
    const posicao = anterior && comparar(anterior, p) === 0 ? (lista[i - 1] as Classificado).posicao : i + 1
    const seguinte = ordenados[i + 1]
    const criterio: CriterioDesempate = seguinte ? (chaves.find(([, f]) => f(p) !== f(seguinte))?.[0] ?? 'empate') : 'pontos'
    lista.push({ jogador: p.id, posicao, total: pontuacao(p), criterio })
  })
  return lista
}

/** Soma PV impressos e sobras ao placar, classifica e encerra a partida. */
export function finalizarPartida(estado: GameState, r: Regras = regrasPadrao): GameState {
  const jogadores = estado.jogadores.map((p) => ({
    ...p,
    placar: { ...p.placar, impressos: pvImpressos(estado, p.id, r), sobras: pontosDeSobras(p, r) },
  }))
  const classificacao = classificar(jogadores, r)
  const vencedores = classificacao.filter((c) => c.posicao === 1).map((c) => jogadores[c.jogador]?.nome)
  return {
    ...estado,
    jogadores,
    classificacao,
    fase: 'fim',
    log: [...estado.log, { ano: estado.ano, jogador: null, texto: `Fim de jogo. Vencedor: ${vencedores.join(' e ')}.` }],
  }
}
