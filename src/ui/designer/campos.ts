// Campos editáveis do regras.json no modo designer (lógica pura).
import { ErroDeConfiguracao, obterMapa, validarRegras } from '../../engine'
import type { Regras } from '../../engine'

export type TipoCampo = 'numero' | 'lista' | 'booleano'

export interface Campo {
  caminho: string
  tipo: TipoCampo
  grupo: string
}

const nomesDeGrupo: Record<string, string> = {
  anos: 'Anos',
  jogadores: 'Jogadores',
  acoesPorAno: 'Ações por ano',
  mapa: 'Mapa',
  inicial: 'Recursos iniciais',
  'edificios.prefeitura': 'Prefeitura',
  'edificios.residencia': 'Residência',
  'edificios.mercado': 'Mercado',
  'edificios.campo': 'Campo',
  'edificios.pedreira': 'Pedreira',
  'edificios.armazem': 'Armazém',
  estoqueDeTiles: 'Estoque de tiles',
  tilesVisiveisPorTipo: 'Tiles visíveis por tipo',
  cartas: 'Cartas',
  precoCereal: 'Preço do cereal',
  pedraNaCapital: 'Pedra na Capital',
  comercioEntreJogadores: 'Comércio entre jogadores',
  populacao: 'População',
  contratos: 'Contratos de José',
  acoesAuxiliares: 'Reservar e demarcar',
  fimDeJogo: 'Fim de jogo',
}

export function nomeDoGrupo(grupo: string): string {
  return nomesDeGrupo[grupo] ?? grupo
}

function grupoDe(caminho: string): string {
  const partes = caminho.split('.')
  return partes[0] === 'edificios' ? `edificios.${partes[1]}` : (partes[0] as string)
}

/** Todos os números, listas de números e booleanos do JSON (texto e listas de texto ficam para o JSON bruto). */
export function listarCampos(regras: unknown): Campo[] {
  const campos: Campo[] = []
  const visitar = (v: unknown, caminho: string) => {
    if (typeof v === 'number') campos.push({ caminho, tipo: 'numero', grupo: grupoDe(caminho) })
    else if (typeof v === 'boolean') campos.push({ caminho, tipo: 'booleano', grupo: grupoDe(caminho) })
    else if (Array.isArray(v)) {
      if (v.length > 0 && v.every((x) => typeof x === 'number')) campos.push({ caminho, tipo: 'lista', grupo: grupoDe(caminho) })
    } else if (v && typeof v === 'object') {
      for (const [k, filho] of Object.entries(v)) visitar(filho, caminho ? `${caminho}.${k}` : k)
    }
  }
  visitar(regras, '')
  return campos
}

export function ler(obj: unknown, caminho: string): unknown {
  let atual = obj
  for (const p of caminho.split('.')) {
    if (atual === null || typeof atual !== 'object') return undefined
    atual = (atual as Record<string, unknown>)[p]
  }
  return atual
}

/** Cópia com o valor trocado no caminho (a entrada não é alterada). */
export function comValor<T>(obj: T, caminho: string, valor: unknown): T {
  const copia = JSON.parse(JSON.stringify(obj)) as T
  const partes = caminho.split('.')
  let atual = copia as Record<string, unknown>
  for (const p of partes.slice(0, -1)) atual = atual[p] as Record<string, unknown>
  atual[partes[partes.length - 1] as string] = valor
  return copia
}

/** "3, 3, 4" → [3, 3, 4]; null se algum item não for número. */
export function lerLista(texto: string): number[] | null {
  const itens = texto.split(/[,;\s]+/).filter((x) => x !== '')
  const nums = itens.map(Number)
  return itens.length > 0 && nums.every((n) => Number.isFinite(n)) ? nums : null
}

export interface Verificacao {
  regras: Regras | null
  erros: string[]
  avisos: string[]
}

export function verificar(rascunho: unknown): Verificacao {
  try {
    const regras = validarRegras(rascunho)
    const avisos: string[] = []
    const mapa = obterMapa(regras)
    for (const m of ['oeste', 'leste'] as const) {
      const n = mapa.casasDaMargem[m].length
      if (n !== 23) avisos.push(`A margem ${m} tem ${n} casas (no mapa original são 23).`)
    }
    return { regras, erros: [], avisos }
  } catch (e) {
    return { regras: null, erros: e instanceof ErroDeConfiguracao ? e.problemas : [(e as Error).message], avisos: [] }
  }
}

/** Caminhos cujo valor difere do padrão. */
export function alterados(rascunho: unknown, padrao: unknown): string[] {
  return listarCampos(padrao)
    .map((c) => c.caminho)
    .filter((c) => JSON.stringify(ler(rascunho, c)) !== JSON.stringify(ler(padrao, c)))
}
