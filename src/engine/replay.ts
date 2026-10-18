// Exportar uma partida (semente + configuração + ações + regras usadas) e reproduzi-la passo a passo.
import { aplicar } from './actions'
import { regras as regrasPadrao, validarRegras, type Regras } from './config'
import { novaPartida } from './setup'
import type { AcaoRegistrada, ConfigPartida, GameState } from './types'

export const FORMATO_PARTIDA = 'jose-no-egito/partida'
export const VERSAO_PARTIDA = 1

export interface PartidaExportada {
  formato: typeof FORMATO_PARTIDA
  versao: number
  exportadaEm?: string
  versaoRegras: string
  config: ConfigPartida
  /** Cópia do regras.json usado, para reproduzir mesmo que os números mudem depois. */
  regras: Regras
  acoes: AcaoRegistrada[]
  /** Dados de quem exportou que o motor não usa (por exemplo, tempos do registro de playtest). */
  extra?: Record<string, unknown>
}

export function exportarPartida(estado: GameState, r: Regras = regrasPadrao, extra?: Record<string, unknown>): PartidaExportada {
  if (!estado.config || !Array.isArray(estado.acoes)) {
    throw new Error('Esta partida foi começada antes da exportação existir e não pode ser reproduzida')
  }
  return {
    formato: FORMATO_PARTIDA,
    versao: VERSAO_PARTIDA,
    versaoRegras: r.versao,
    config: estado.config,
    regras: r,
    acoes: estado.acoes,
    ...(extra ? { extra } : {}),
  }
}

export interface Reproducao {
  /** estados[0] é a partida recém-criada; estados[i] é o estado depois da ação i. */
  estados: GameState[]
  regras: Regras
  dados: PartidaExportada
}

export function reproduzir(dados: unknown): { reproducao: Reproducao; erro?: undefined } | { reproducao?: undefined; erro: string } {
  const d = dados as Partial<PartidaExportada> | null
  if (!d || typeof d !== 'object' || d.formato !== FORMATO_PARTIDA) return { erro: 'Este arquivo não é uma partida de José no Egito' }
  if (d.versao !== VERSAO_PARTIDA) return { erro: `Versão de arquivo não suportada: ${String(d.versao)}` }
  if (!d.config || !Array.isArray(d.acoes)) return { erro: 'Arquivo incompleto: faltam a configuração ou as ações' }

  let r: Regras
  try {
    r = validarRegras(d.regras)
  } catch (e) {
    return { erro: `As regras guardadas no arquivo são inválidas.\n${(e as Error).message}` }
  }

  const inicio = novaPartida(d.config, r)
  if (!inicio.estado) return { erro: `Não foi possível recriar a partida: ${inicio.erro}` }
  const estados: GameState[] = [inicio.estado]
  let e = inicio.estado
  for (let i = 0; i < d.acoes.length; i++) {
    const a = d.acoes[i]
    if (!a || typeof a.jogador !== 'number' || !a.acao) return { erro: `Ação ${i + 1} malformada no arquivo` }
    const res = aplicar(e, a.jogador, a.acao, r)
    if (!res.estado) return { erro: `A ação ${i + 1} foi recusada ao reproduzir: ${res.erro}` }
    e = res.estado
    estados.push(e)
  }
  return { reproducao: { estados, regras: r, dados: d as PartidaExportada } }
}
