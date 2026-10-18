// Partidas só com bots, sem interface. Sem I/O: o script de linha de comando só imprime o resultado.
import { aplicar, novaPartida, pontuacao, regras as regrasPadrao } from '../engine'
import type { GameState, Margem, Placar, Regras } from '../engine'
import { estrategiaPorId } from './config'
import { jogadaDoBot } from './index'

export class AcaoRecusadaDoBot extends Error {}

/** Joga uma partida inteira só com bots. Lança AcaoRecusadaDoBot se o motor recusar alguma jogada. */
export function jogarPartidaDeBots(mesa: string[], semente: number, r: Regras = regrasPadrao): GameState {
  const inicio = novaPartida(
    {
      jogadores: mesa.map((id, i) => ({ nome: `${estrategiaPorId(id).nome} ${i + 1}`, tipo: 'bot', estrategiaBot: id })),
      margens: 'sorteio',
      semente,
    },
    r,
  )
  if (!inicio.estado) throw new Error(inicio.erro)
  let e = inicio.estado
  let passos = 0
  while (e.fase !== 'fim') {
    const { jogador, acao } = jogadaDoBot(e, r)
    const res = aplicar(e, jogador, acao, r)
    if (!res.estado) {
      throw new AcaoRecusadaDoBot(`Semente ${semente}, ano ${e.ano}, ${e.jogadores[jogador]?.nome}: ${JSON.stringify(acao)} → ${res.erro}`)
    }
    e = res.estado
    if (++passos > 100_000) throw new Error(`Semente ${semente}: partida não terminou`)
  }
  return e
}

export interface Agregado {
  jogos: number
  vitorias: number
  pontos: number
  placar: Placar
}

export interface ResultadoSimulacao {
  partidas: number
  mesa: string[]
  porEstrategia: Record<string, Agregado>
  porEstrategiaEMargem: Record<string, Record<Margem, Agregado>>
  porMargem: Record<Margem, Agregado>
  pontosMedios: number
}

const vazio = (): Agregado => ({ jogos: 0, vitorias: 0, pontos: 0, placar: { alimentacao: 0, fome: 0, contratos: 0, impressos: 0, sobras: 0 } })

function somar(a: Agregado, pontos: number, placar: Placar, vitoria: number) {
  a.jogos++
  a.vitorias += vitoria
  a.pontos += pontos
  for (const k of Object.keys(placar) as (keyof Placar)[]) a.placar[k] += placar[k]
}

/**
 * Roda `partidas` partidas com a mesa dada. Vitória dividida entre os empatados em pontos
 * (como no simulador Python, para comparar com referenciaDeResultados).
 */
export function simular(
  mesa: string[],
  partidas: number,
  semente0 = 1,
  r: Regras = regrasPadrao,
  aoProgresso?: (feitas: number) => void,
): ResultadoSimulacao {
  const porEstrategia: Record<string, Agregado> = {}
  const porEstrategiaEMargem: Record<string, Record<Margem, Agregado>> = {}
  const porMargem: Record<Margem, Agregado> = { oeste: vazio(), leste: vazio() }
  let total = 0
  let n = 0
  for (let i = 0; i < partidas; i++) {
    const e = jogarPartidaDeBots(mesa, semente0 + i, r)
    const pts = e.jogadores.map(pontuacao)
    const melhor = Math.max(...pts)
    const vencedores = pts.filter((x) => x === melhor).length
    e.jogadores.forEach((p, k) => {
      const id = p.estrategiaBot as string
      const v = pts[k] === melhor ? 1 / vencedores : 0
      somar((porEstrategia[id] ??= vazio()), pts[k]!, p.placar, v)
      somar(((porEstrategiaEMargem[id] ??= { oeste: vazio(), leste: vazio() })[p.margem]), pts[k]!, p.placar, v)
      somar(porMargem[p.margem], pts[k]!, p.placar, v)
      total += pts[k]!
      n++
    })
    aoProgresso?.(i + 1)
  }
  return { partidas, mesa, porEstrategia, porEstrategiaEMargem, porMargem, pontosMedios: total / n }
}

export const media = (a: Agregado) => a.pontos / a.jogos
export const taxaVitoria = (a: Agregado) => a.vitorias / a.jogos
