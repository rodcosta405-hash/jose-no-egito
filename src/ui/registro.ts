// Registro de playtest por ano (tempo, carta, preço, pontos de cada jogador) e exportação em CSV.
// Lógica pura, testável no Node.
import { pontuacao } from '../engine'
import type { GameState, Regras } from '../engine'

/** Milissegundos gastos em cada ano, medidos pela interface. */
export type Tempos = Record<number, number>

export interface LinhaRegistro {
  ano: number | 'Fim'
  fase: string
  carta: number | null
  preco: number | null
  tempoMs: number | null
  /** Na ordem de estado.jogadores. */
  pontos: { noAno: number; acumulado: number }[]
}

export function linhasRegistro(estado: GameState, tempos: Tempos, r: Regras = estado.regras): LinhaRegistro[] {
  const linhas: LinhaRegistro[] = []
  let anteriores = estado.jogadores.map(() => 0)
  for (const resumo of estado.resumos) {
    const totais = estado.jogadores.map((p) => resumo.jogadores.find((x) => x.jogador === p.id)?.totalAcumulado ?? 0)
    linhas.push({
      ano: resumo.ano,
      fase: resumo.ano <= r.anos.gordos ? 'Gorda' : 'Magra',
      carta: resumo.carta,
      preco: resumo.preco,
      tempoMs: tempos[resumo.ano] ?? null,
      pontos: totais.map((t, i) => ({ noAno: t - (anteriores[i] ?? 0), acumulado: t })),
    })
    anteriores = totais
  }
  if (estado.fase === 'fim') {
    // PV impressos e sobras entram depois do último ano.
    const finais = estado.jogadores.map(pontuacao)
    linhas.push({
      ano: 'Fim',
      fase: 'PV e sobras',
      carta: null,
      preco: null,
      tempoMs: null,
      pontos: finais.map((t, i) => ({ noAno: t - (anteriores[i] ?? 0), acumulado: t })),
    })
  }
  return linhas
}

export function formatarTempo(ms: number | null): string {
  if (ms === null) return ''
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Campo de CSV: entre aspas se tiver separador, aspas ou quebra de linha. */
function campo(v: string | number | null): string {
  const t = v === null ? '' : String(v)
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

/**
 * CSV para planilha em português: separador ";", UTF-8 com BOM (acentos corretos no Excel),
 * colunas Ano; Fase; Carta; Preço; Tempo (min:s); e, por jogador, pontos no ano e acumulado.
 */
export function gerarCsv(estado: GameState, tempos: Tempos, r: Regras = estado.regras): string {
  const cabecalho = ['Ano', 'Fase', 'Carta', 'Preço', 'Tempo (min:s)']
  for (const p of estado.jogadores) cabecalho.push(`${p.nome} pontos no ano`, `${p.nome} acumulado`)
  const linhas = linhasRegistro(estado, tempos, r).map((l) => [
    l.ano,
    l.fase,
    l.carta,
    l.preco,
    formatarTempo(l.tempoMs),
    ...l.pontos.flatMap((p) => [p.noAno, p.acumulado]),
  ])
  return '﻿' + [cabecalho, ...linhas].map((cols) => cols.map(campo).join(';')).join('\r\n') + '\r\n'
}
