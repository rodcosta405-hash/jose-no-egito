// Carrega e valida config/regras.json. Nenhum número de regra fica no código:
// tudo é lido daqui, com tipos fortes, e a carga falha com mensagem clara.
import regrasBrutas from '../../config/regras.json'

export type Recurso = 'ouro' | 'pedra' | 'cereal'
export type Custo = Partial<Record<Recurso, number>>

export interface Verso {
  nome: string
  custo: Custo
  pv: number
  bonusOuro?: number
  bonusPedra?: number
  bonusCapacidade?: number
}

export interface EdificioBase {
  nome: string
  pv: number
}

export interface Regras {
  versao: string
  anos: { total: number; gordos: number }
  acoesPorAno: number
  mapa: {
    colunas: number
    linhas: number
    notacao: string
    capital: string[]
    varzea: string[]
    rochas: string[]
    margens: { oeste: { sementeFloodFill: string }; leste: { sementeFloodFill: string } }
    jogadoresPorMargem: number
  }
  inicial: { ouro: number; pedra: number; cereal: number; edificios: string[] }
  edificios: {
    prefeitura: EdificioBase & { capacidadeCereal: number; construivel: boolean }
    residencia: EdificioBase & {
      custo: Custo
      escaladaPorResidenciaExtra: Custo
      trabalhadores: number
      precisaTrabalhador: boolean
      verso: Verso
    }
    mercado: EdificioBase & {
      custo: Custo
      precisaTrabalhador: boolean
      produzOuro: number
      pvSoSeOperando: boolean
      verso: Verso & { bonusOuro: number }
    }
    campo: EdificioBase & {
      custo: Custo
      precisaTrabalhador: boolean
      produzCereal: string
      bonusVarzeaAnosGordos: number
      bonusVarzeaAnosMagros: number
      podeNaVarzea: boolean
      pvSoSeOperando: boolean
      verso: Verso
    }
    pedreira: EdificioBase & {
      custo: Custo
      precisaTrabalhador: boolean
      produzPedra: number
      bonusRocha: number
      pvSoSeOperando: boolean
      verso: Verso & { bonusPedra: number }
    }
    armazem: EdificioBase & {
      custo: Custo
      precisaTrabalhador: boolean
      capacidadeCereal: number
      verso: Verso & { bonusCapacidade: number }
    }
  }
  estoqueDeTiles: { residencia: number; mercado: number; campo: number; pedreira: number; armazem: number }
  tilesVisiveisPorTipo: number
  cartas: { gordas: number[]; magras: number[]; sorteadasPorFase: number }
  precoCereal: { minimo: number; maximo: number; inicio: number; ancoraGordos: number; ancoraMagros: number }
  pedraNaCapital: { precoCompra: number; capitalCompraPedra: boolean }
  comercioEntreJogadores: { precoCereal: string; precoPedra: number; moveTrilha: boolean }
  populacao: { consumoPorTrabalhador: number; pontosAlimentado: number; pontosSemComida: number }
  contratos: { pontosPorCereal: number; demandaPorAnoMagro: number }
  acoesAuxiliares: { reservaMaxima: number; demarcacaoMaxima: number; custoDemarcacao: number }
  fimDeJogo: { ouroPorPonto: number; cerealPorPonto: number; pedraPorPonto: number }
  desempate: string[]
}

export class ErroDeConfiguracao extends Error {
  constructor(public readonly problemas: string[]) {
    super(`config/regras.json inválido:\n${problemas.map((p) => `  - ${p}`).join('\n')}`)
    this.name = 'ErroDeConfiguracao'
  }
}

// ---------- verificador ----------

type Tipo = 'inteiro' | 'texto' | 'booleano' | 'objeto' | 'lista'

class Verificador {
  readonly problemas: string[] = []

  constructor(private readonly raiz: unknown) {}

  private ler(caminho: string): { existe: boolean; valor: unknown } {
    let atual: unknown = this.raiz
    for (const parte of caminho.split('.')) {
      if (typeof atual !== 'object' || atual === null || !(parte in atual)) return { existe: false, valor: undefined }
      atual = (atual as Record<string, unknown>)[parte]
    }
    return { existe: true, valor: atual }
  }

  campo(caminho: string, tipo: Tipo, opcional = false): unknown {
    const { existe, valor } = this.ler(caminho)
    if (!existe) {
      if (!opcional) this.problemas.push(`campo obrigatório ausente: "${caminho}"`)
      return undefined
    }
    const ok =
      tipo === 'inteiro' ? Number.isInteger(valor)
      : tipo === 'texto' ? typeof valor === 'string'
      : tipo === 'booleano' ? typeof valor === 'boolean'
      : tipo === 'lista' ? Array.isArray(valor)
      : typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    if (!ok) this.problemas.push(`"${caminho}" deveria ser ${nomeDoTipo[tipo]}, mas é ${descrever(valor)}`)
    return ok ? valor : undefined
  }

  inteiros(caminho: string, ...nomes: string[]) {
    for (const n of nomes) this.campo(`${caminho}.${n}`, 'inteiro')
  }

  listaDe(caminho: string, tipo: 'inteiro' | 'texto', naoVazia = true): unknown[] | undefined {
    const lista = this.campo(caminho, 'lista') as unknown[] | undefined
    if (!lista) return undefined
    if (naoVazia && lista.length === 0) this.problemas.push(`"${caminho}" não pode ser uma lista vazia`)
    lista.forEach((v, i) => {
      const ok = tipo === 'inteiro' ? Number.isInteger(v) : typeof v === 'string'
      if (!ok) this.problemas.push(`"${caminho}[${i}]" deveria ser ${nomeDoTipo[tipo]}, mas é ${descrever(v)}`)
    })
    return lista
  }

  custo(caminho: string) {
    const obj = this.campo(caminho, 'objeto') as Record<string, unknown> | undefined
    if (!obj) return
    for (const [k, v] of Object.entries(obj)) {
      if (!recursos.includes(k as Recurso)) this.problemas.push(`"${caminho}.${k}": recurso desconhecido (use ouro, pedra ou cereal)`)
      else if (!Number.isInteger(v) || (v as number) < 0) this.problemas.push(`"${caminho}.${k}" deveria ser um inteiro ≥ 0`)
    }
  }

  verso(caminho: string, ...bonus: string[]) {
    this.campo(`${caminho}.nome`, 'texto')
    this.custo(`${caminho}.custo`)
    this.campo(`${caminho}.pv`, 'inteiro')
    for (const b of bonus) this.campo(`${caminho}.${b}`, 'inteiro')
  }

  falhar(msg: string) {
    this.problemas.push(msg)
  }
}

const recursos: Recurso[] = ['ouro', 'pedra', 'cereal']
const nomeDoTipo: Record<Tipo, string> = {
  inteiro: 'um número inteiro',
  texto: 'um texto',
  booleano: 'verdadeiro ou falso',
  objeto: 'um objeto',
  lista: 'uma lista',
}

function descrever(v: unknown): string {
  if (v === null) return 'nulo'
  if (Array.isArray(v)) return 'uma lista'
  if (typeof v === 'number') return `o número ${v}`
  if (typeof v === 'string') return `o texto "${v}"`
  if (typeof v === 'boolean') return String(v)
  return typeof v === 'object' ? 'um objeto' : typeof v
}

// ---------- validação ----------

export function validarRegras(dado: unknown): Regras {
  const v = new Verificador(dado)

  v.campo('versao', 'texto')
  v.inteiros('anos', 'total', 'gordos')
  v.campo('acoesPorAno', 'inteiro')

  const colunas = v.campo('mapa.colunas', 'inteiro') as number | undefined
  const linhas = v.campo('mapa.linhas', 'inteiro') as number | undefined
  v.campo('mapa.notacao', 'texto')
  const casas: [string, unknown[] | undefined][] = [
    ['mapa.capital', v.listaDe('mapa.capital', 'texto')],
    ['mapa.varzea', v.listaDe('mapa.varzea', 'texto')],
    ['mapa.rochas', v.listaDe('mapa.rochas', 'texto')],
  ]
  const sementeOeste = v.campo('mapa.margens.oeste.sementeFloodFill', 'texto')
  const sementeLeste = v.campo('mapa.margens.leste.sementeFloodFill', 'texto')
  casas.push(['mapa.margens.oeste.sementeFloodFill', sementeOeste === undefined ? undefined : [sementeOeste]])
  casas.push(['mapa.margens.leste.sementeFloodFill', sementeLeste === undefined ? undefined : [sementeLeste]])
  v.campo('mapa.jogadoresPorMargem', 'inteiro')
  if (colunas !== undefined && linhas !== undefined) {
    for (const [caminho, lista] of casas) {
      for (const c of lista ?? []) {
        if (typeof c === 'string' && !casaValida(c, colunas, linhas)) {
          v.falhar(`"${caminho}": casa "${c}" fora do mapa ${colunas}×${linhas}`)
        }
      }
    }
  }

  v.inteiros('inicial', 'ouro', 'pedra', 'cereal')
  v.listaDe('inicial.edificios', 'texto')

  const e = 'edificios'
  for (const tipo of ['prefeitura', 'residencia', 'mercado', 'campo', 'pedreira', 'armazem']) {
    v.campo(`${e}.${tipo}.nome`, 'texto')
    v.campo(`${e}.${tipo}.pv`, 'inteiro')
  }
  v.campo(`${e}.prefeitura.capacidadeCereal`, 'inteiro')
  v.campo(`${e}.prefeitura.construivel`, 'booleano')

  v.custo(`${e}.residencia.custo`)
  v.custo(`${e}.residencia.escaladaPorResidenciaExtra`)
  v.campo(`${e}.residencia.trabalhadores`, 'inteiro')
  v.campo(`${e}.residencia.precisaTrabalhador`, 'booleano')
  v.verso(`${e}.residencia.verso`)

  v.custo(`${e}.mercado.custo`)
  v.campo(`${e}.mercado.precisaTrabalhador`, 'booleano')
  v.campo(`${e}.mercado.produzOuro`, 'inteiro')
  v.campo(`${e}.mercado.pvSoSeOperando`, 'booleano')
  v.verso(`${e}.mercado.verso`, 'bonusOuro')

  v.custo(`${e}.campo.custo`)
  v.campo(`${e}.campo.precisaTrabalhador`, 'booleano')
  v.campo(`${e}.campo.produzCereal`, 'texto')
  v.inteiros(`${e}.campo`, 'bonusVarzeaAnosGordos', 'bonusVarzeaAnosMagros')
  v.campo(`${e}.campo.podeNaVarzea`, 'booleano')
  v.campo(`${e}.campo.pvSoSeOperando`, 'booleano')
  v.verso(`${e}.campo.verso`)

  v.custo(`${e}.pedreira.custo`)
  v.campo(`${e}.pedreira.precisaTrabalhador`, 'booleano')
  v.inteiros(`${e}.pedreira`, 'produzPedra', 'bonusRocha')
  v.campo(`${e}.pedreira.pvSoSeOperando`, 'booleano')
  v.verso(`${e}.pedreira.verso`, 'bonusPedra')

  v.custo(`${e}.armazem.custo`)
  v.campo(`${e}.armazem.precisaTrabalhador`, 'booleano')
  v.campo(`${e}.armazem.capacidadeCereal`, 'inteiro')
  v.verso(`${e}.armazem.verso`, 'bonusCapacidade')

  v.inteiros('estoqueDeTiles', 'residencia', 'mercado', 'campo', 'pedreira', 'armazem')
  v.campo('tilesVisiveisPorTipo', 'inteiro')

  const gordas = v.listaDe('cartas.gordas', 'inteiro')
  const magras = v.listaDe('cartas.magras', 'inteiro')
  const sorteadas = v.campo('cartas.sorteadasPorFase', 'inteiro') as number | undefined
  if (sorteadas !== undefined) {
    if (gordas && gordas.length < sorteadas) v.falhar(`"cartas.gordas" tem ${gordas.length} cartas, menos que sorteadasPorFase (${sorteadas})`)
    if (magras && magras.length < sorteadas) v.falhar(`"cartas.magras" tem ${magras.length} cartas, menos que sorteadasPorFase (${sorteadas})`)
  }

  v.inteiros('precoCereal', 'minimo', 'maximo', 'inicio', 'ancoraGordos', 'ancoraMagros')
  const pc = (dado as Partial<Regras> | null)?.precoCereal
  if (pc && Number.isInteger(pc.minimo) && Number.isInteger(pc.maximo)) {
    if (pc.minimo > pc.maximo) v.falhar('"precoCereal.minimo" é maior que "precoCereal.maximo"')
    for (const k of ['inicio', 'ancoraGordos', 'ancoraMagros'] as const) {
      if (Number.isInteger(pc[k]) && (pc[k] < pc.minimo || pc[k] > pc.maximo)) {
        v.falhar(`"precoCereal.${k}" (${pc[k]}) está fora da trilha ${pc.minimo}–${pc.maximo}`)
      }
    }
  }

  v.campo('pedraNaCapital.precoCompra', 'inteiro')
  v.campo('pedraNaCapital.capitalCompraPedra', 'booleano')
  v.campo('comercioEntreJogadores.precoCereal', 'texto')
  v.campo('comercioEntreJogadores.precoPedra', 'inteiro')
  v.campo('comercioEntreJogadores.moveTrilha', 'booleano')
  v.inteiros('populacao', 'consumoPorTrabalhador', 'pontosAlimentado', 'pontosSemComida')
  v.inteiros('contratos', 'pontosPorCereal', 'demandaPorAnoMagro')
  v.inteiros('acoesAuxiliares', 'reservaMaxima', 'demarcacaoMaxima', 'custoDemarcacao')
  v.inteiros('fimDeJogo', 'ouroPorPonto', 'cerealPorPonto', 'pedraPorPonto')
  v.listaDe('desempate', 'texto', false)

  const anos = (dado as Partial<Regras> | null)?.anos
  if (anos && Number.isInteger(anos.total) && Number.isInteger(anos.gordos) && anos.gordos > anos.total) {
    v.falhar('"anos.gordos" é maior que "anos.total"')
  }

  if (v.problemas.length > 0) throw new ErroDeConfiguracao(v.problemas)
  return dado as Regras
}

function casaValida(casa: string, colunas: number, linhas: number): boolean {
  const m = /^([A-Z])(\d+)$/.exec(casa)
  if (!m || !m[1] || !m[2]) return false
  const col = m[1].charCodeAt(0) - 'A'.charCodeAt(0)
  const lin = Number(m[2])
  return col >= 0 && col < colunas && lin >= 1 && lin <= linhas
}

/** Regras padrão, validadas na carga do módulo. */
export const regras: Regras = validarRegras(regrasBrutas)
