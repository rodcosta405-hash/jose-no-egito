// Nomes, cores e padrões usados só para mostrar o jogo (nenhuma regra aqui).
import { regras } from '../engine'
import type { BuildingType, Custo, Tile } from '../engine'

export interface Identidade {
  cor: string
  padrao: 'listras' | 'pontos' | 'xadrez' | 'liso'
  nomePadrao: string
  numero: number
}

const cores = ['#b03a2e', '#1f5f99', '#1e7d45', '#9a6a00']
const padroes: Identidade['padrao'][] = ['liso', 'listras', 'pontos', 'xadrez']
const nomesPadrao: Record<Identidade['padrao'], string> = { liso: 'liso', listras: 'listras', pontos: 'pontos', xadrez: 'xadrez' }

export function identidade(jogador: number): Identidade {
  const padrao = padroes[jogador % padroes.length]!
  return { cor: cores[jogador % cores.length]!, padrao, nomePadrao: nomesPadrao[padrao], numero: jogador + 1 }
}

export const sigla: Record<BuildingType, string> = {
  prefeitura: 'Pf',
  residencia: 'R',
  mercado: 'M',
  campo: 'C',
  pedreira: 'Pd',
  armazem: 'A',
}

export function nomeEdificio(tipo: BuildingType): string {
  return regras.edificios[tipo].nome
}

export function nomeDoTile(t: Tile): string {
  const def = regras.edificios[t.type] as { nome: string; verso?: { nome: string } }
  return t.evoluido && def.verso ? def.verso.nome : def.nome
}

export function textoCusto(c: Custo): string {
  const partes: string[] = []
  if (c.ouro) partes.push(`${c.ouro} ouro`)
  if (c.pedra) partes.push(`${c.pedra} pedra`)
  if (c.cereal) partes.push(`${c.cereal} cereal`)
  return partes.length > 0 ? partes.join(' + ') : 'grátis'
}

export const umaCasa = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','))
