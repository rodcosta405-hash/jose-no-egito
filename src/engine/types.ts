import type { BuildingType, Regras } from './config'
import type { Coord, Margem } from './map'
import type { EstadoRng } from './rng'

export type { BuildingType } from './config'
export type { Coord, Margem } from './map'

export type TipoJogador = 'humano' | 'bot'
export type Fase = 'montagem' | 'acoes' | 'alocacao' | 'resolucao' | 'fim'

export interface Tile {
  owner: number
  type: BuildingType
  evoluido: boolean
}

export interface Placar {
  alimentacao: number
  fome: number
  contratos: number
  impressos: number
  sobras: number
}

export interface PlayerState {
  id: number
  nome: string
  tipo: TipoJogador
  estrategiaBot?: string
  margem: Margem
  ouro: number
  pedra: number
  cereal: number
  reserva: BuildingType[]
  /** Edifícios com trabalhador neste ano. */
  alocacao: Coord[]
  placar: Placar
  alimentadosUltimoAno: number
}

/** Onde a montagem está: volta 1 segue a ordem, volta 2 a ordem inversa. */
export interface ProgressoMontagem {
  volta: 1 | 2
  /** Posição do jogador da vez dentro da volta (0 = primeiro a montar nessa volta). */
  indice: number
  /** Qual edifício da lista da volta ele coloca agora. */
  passo: number
}

export interface LogEntry {
  ano: number
  jogador: number | null
  texto: string
}

export interface ResumoJogadorAno {
  jogador: number
  producao: { ouro: number; pedra: number; cereal: number }
  trabalhadores: number
  alimentados: number
  semComida: number
  /** Pontos de alimentação e fome deste ano. */
  pontosAno: number
  descartado: number
  /** Soma do placar ao fim do ano (inclui contratos). */
  totalAcumulado: number
}

export interface ResumoAno {
  ano: number
  carta: number
  preco: number
  jogadores: ResumoJogadorAno[]
}

export type CriterioDesempate = 'pontos' | 'trabalhadoresAlimentadosNoAno14' | 'cerealGuardado' | 'empate'

export interface Classificado {
  jogador: number
  posicao: number
  total: number
  /** O que separou este jogador do seguinte (ou 'empate' se nada separou). */
  criterio: CriterioDesempate
}

export interface GameState {
  semente: number
  rng: EstadoRng
  ano: number
  fase: Fase
  /** Ids dos jogadores na ordem de jogo sorteada. */
  ordem: number[]
  primeiro: number
  /** Volta de ações dentro do ano (1..acoesPorAno). */
  volta: number
  vez: number
  jogadores: PlayerState[]
  tabuleiro: Record<Coord, Tile>
  demarcacoes: Record<Coord, number>
  estoque: Record<Exclude<BuildingType, 'prefeitura'>, number>
  preco: number
  demandaCapital: number
  baralho: number[]
  cartasReveladas: number[]
  montagem: ProgressoMontagem | null
  resumos: ResumoAno[]
  classificacao: Classificado[] | null
  log: LogEntry[]
  /** Configuração usada em novaPartida (para exportar e reproduzir). */
  config: ConfigPartida
  /** Regras desta partida (padrão: config/regras.json; o modo designer pode trocar). */
  regras: Regras
  /** Todas as ações aceitas, em ordem: semente + config + ações reproduzem a partida. */
  acoes: AcaoRegistrada[]
}

export interface AcaoRegistrada {
  jogador: number
  acao: Action
}

export interface ConfigJogador {
  nome: string
  tipo: TipoJogador
  estrategiaBot?: string
}

export interface ConfigPartida {
  jogadores: ConfigJogador[]
  /** 'sorteio' ou a margem de cada jogador, na mesma ordem de `jogadores`. */
  margens: 'sorteio' | Margem[]
  semente: number
}

export type Action =
  | { tipo: 'construir'; edificio: BuildingType; casa: Coord; daReserva?: boolean }
  | { tipo: 'comerciar'; com: 'capital' | number; recurso: 'cereal' | 'pedra'; direcao: 'comprar' | 'vender'; quantidade: number }
  | { tipo: 'reservar'; edificio: BuildingType }
  | { tipo: 'demarcar'; casa: Coord }
  | { tipo: 'evoluir'; casa: Coord }
  | { tipo: 'entregar'; quantidade: number }
  | { tipo: 'passar' }
  | { tipo: 'alocar'; casas: Coord[] }
  | { tipo: 'montar'; edificio: BuildingType; casa: Coord }

export type ResultadoAcao = { estado: GameState; erro?: undefined } | { estado?: undefined; erro: string }
