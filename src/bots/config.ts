// Estratégias treinadas (config/bots.json). Os nomes dos parâmetros seguem docs/BOTS.md.
import botsBrutos from '../../config/bots.json'

export type ChaveOrdem = 'res' | 'mk' | 'cp' | 'pd' | 'upg'

export interface ParametrosBot {
  res_t: number
  mk_t: number
  cp_t: number
  pd_t: number
  stop_res: number
  upg_from: number
  lean_buy: number
  sell_min: number
  store_from: number
  store: number
  keep: number
  keep_c: number
  capital_w: number
  order: ChaveOrdem[]
  fat_fill: boolean
  mk_first: boolean
  use_c: boolean
}

export interface Estrategia {
  id: string
  nome: string
  descricao: string
  params: ParametrosBot
}

const numeros = ['res_t', 'mk_t', 'cp_t', 'pd_t', 'stop_res', 'upg_from', 'lean_buy', 'sell_min', 'store_from', 'store', 'keep', 'keep_c', 'capital_w'] as const
const booleanos = ['fat_fill', 'mk_first', 'use_c'] as const
const chavesOrdem: ChaveOrdem[] = ['res', 'mk', 'cp', 'pd', 'upg']

export function validarEstrategias(dado: unknown): Estrategia[] {
  const problemas: string[] = []
  const lista = (dado as { estrategias?: unknown })?.estrategias
  if (!Array.isArray(lista) || lista.length === 0) throw new Error('config/bots.json inválido: "estrategias" deve ser uma lista não vazia')
  lista.forEach((e: Record<string, unknown>, i) => {
    const onde = `estrategias[${i}]`
    for (const k of ['id', 'nome', 'descricao']) if (typeof e?.[k] !== 'string') problemas.push(`"${onde}.${k}" deveria ser um texto`)
    const p = e?.params as Record<string, unknown> | undefined
    if (!p) return void problemas.push(`"${onde}.params" ausente`)
    for (const k of numeros) if (typeof p[k] !== 'number') problemas.push(`"${onde}.params.${k}" deveria ser um número`)
    for (const k of booleanos) if (typeof p[k] !== 'boolean') problemas.push(`"${onde}.params.${k}" deveria ser verdadeiro ou falso`)
    const ordem = p.order
    if (!Array.isArray(ordem) || ordem.some((o) => !chavesOrdem.includes(o as ChaveOrdem))) {
      problemas.push(`"${onde}.params.order" deveria ser uma lista com ${chavesOrdem.join(', ')}`)
    }
  })
  if (problemas.length > 0) throw new Error(`config/bots.json inválido:\n${problemas.map((p) => `  - ${p}`).join('\n')}`)
  return lista as Estrategia[]
}

export const estrategias: Estrategia[] = validarEstrategias(botsBrutos)

export function estrategiaPorId(id: string | undefined): Estrategia {
  const e = estrategias.find((x) => x.id === id)
  if (!e) throw new Error(`Estratégia de bot desconhecida: "${id}"`)
  return e
}

export const referenciaDeResultados = botsBrutos.referenciaDeResultados
