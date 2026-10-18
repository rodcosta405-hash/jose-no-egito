// Nova partida e fase de montagem (docs/REGRAS.md seções 3 e 4).
import { regras as regrasPadrao, type BuildingType, type Regras } from './config'
import { margensDoMapa, obterMapa, type Coord, type Margem } from './map'
import { embaralhar, iniciarRng } from './rng'
import type { ConfigPartida, GameState, PlayerState, ResultadoAcao } from './types'
import { iniciarAno } from './year'

const nomeDe = (tipo: BuildingType, r: Regras) => r.edificios[tipo].nome
const nomeMargem: Record<Margem, string> = { oeste: 'oeste', leste: 'leste' }

export function novaPartida(config: ConfigPartida, r: Regras = regrasPadrao): ResultadoAcao {
  const n = config.jogadores.length
  if (n < r.jogadores.minimo || n > r.jogadores.maximo) {
    return { erro: `A partida precisa de ${r.jogadores.minimo} a ${r.jogadores.maximo} jogadores` }
  }
  if (!Number.isInteger(config.semente)) return { erro: 'A semente deve ser um número inteiro' }
  const limite = r.mapa.jogadoresPorMargem
  if (n > limite * margensDoMapa.length) return { erro: `No máximo ${limite} jogadores por margem` }

  let rng = iniciarRng(config.semente)

  // Ordem de jogo sorteada; o primeiro da ordem recebe o marcador de primeiro jogador.
  let ordem: number[]
  ;[ordem, rng] = embaralhar(config.jogadores.map((_, i) => i), rng)

  // Margens: escolhidas ou sorteadas de forma equilibrada (DECISOES.md, provisório).
  let margens: Margem[]
  if (config.margens === 'sorteio') {
    const equilibradas = config.jogadores.map((_, i) => margensDoMapa[i % margensDoMapa.length] as Margem)
    ;[margens, rng] = embaralhar(equilibradas, rng)
  } else {
    if (config.margens.length !== n) return { erro: 'Escolha uma margem para cada jogador' }
    for (const m of margensDoMapa) {
      if (config.margens.filter((x) => x === m).length > limite) {
        return { erro: `No máximo ${limite} jogadores na margem ${nomeMargem[m]}` }
      }
    }
    margens = [...config.margens]
  }

  // Baralho: sorteadasPorFase cartas de cada fase, gordas primeiro, cada grupo embaralhado.
  let gordas: number[]
  let magras: number[]
  ;[gordas, rng] = embaralhar(r.cartas.gordas, rng)
  ;[magras, rng] = embaralhar(r.cartas.magras, rng)
  const k = r.cartas.sorteadasPorFase
  const baralho = [...gordas.slice(0, k), ...magras.slice(0, k)]

  const jogadores: PlayerState[] = config.jogadores.map((j, id) => ({
    id,
    nome: j.nome,
    tipo: j.tipo,
    ...(j.estrategiaBot !== undefined ? { estrategiaBot: j.estrategiaBot } : {}),
    margem: margens[id] as Margem,
    ouro: r.inicial.ouro,
    pedra: r.inicial.pedra,
    cereal: r.inicial.cereal,
    reserva: [],
    alocacao: [],
    placar: { alimentacao: 0, fome: 0, contratos: 0, impressos: 0, sobras: 0 },
    alimentadosUltimoAno: 0,
  }))

  const primeiro = ordem[0] as number
  const estado: GameState = {
    semente: config.semente,
    rng,
    ano: 0,
    fase: 'montagem',
    ordem,
    primeiro,
    volta: 1,
    vez: primeiro,
    jogadores,
    tabuleiro: {},
    demarcacoes: {},
    estoque: { ...r.estoqueDeTiles },
    preco: r.precoCereal.inicio,
    demandaCapital: 0,
    baralho,
    cartasReveladas: [],
    montagem: { volta: 1, indice: 0, passo: 0 },
    resumos: [],
    classificacao: null,
    config: copiarJson(config),
    regras: r,
    acoes: [],
    log: [{ ano: 0, jogador: null, texto: `Ordem de jogo: ${ordem.map((i) => jogadores[i]?.nome).join(', ')}` }],
  }
  return { estado }
}

/** Cópia profunda de dados JSON (o motor não usa APIs do navegador). */
function copiarJson<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

/** Quem monta agora e qual edifício; null quando a montagem terminou. */
export function proximaMontagem(estado: GameState, r: Regras = estado.regras): { jogador: number; edificio: BuildingType } | null {
  const m = estado.montagem
  if (estado.fase !== 'montagem' || !m) return null
  const lista = m.volta === 1 ? r.montagem.primeiraVolta : r.montagem.segundaVolta
  const n = estado.ordem.length
  const jogador = estado.ordem[m.volta === 1 ? m.indice : n - 1 - m.indice] as number
  return { jogador, edificio: lista[m.passo] as BuildingType }
}

/** Motivo pelo qual a casa não serve para o edifício na montagem, ou null se serve. */
export function motivoCasaInvalidaMontagem(
  estado: GameState,
  jogador: number,
  edificio: BuildingType,
  casa: Coord,
  r: Regras = estado.regras,
): string | null {
  const mapa = obterMapa(r)
  const motivo = motivoCasaLivre(estado, edificio, casa, r)
  if (motivo) return motivo

  const p = estado.jogadores[jogador]
  if (!p) return 'Jogador inexistente'
  const temEdificio = Object.values(estado.tabuleiro).some((t) => t.owner === jogador)
  if (!temEdificio) {
    if (mapa.margem[casa] !== p.margem) return `A ${nomeDe(edificio, r)} deve ficar na sua margem (${nomeMargem[p.margem]})`
    return null
  }
  if (conectada(estado, jogador, casa, r)) return null
  // Jogador cercado, sem casa conectada válida: pode usar qualquer casa livre da própria margem
  // (DECISOES.md, provisório).
  const cercado = !mapa.casas.some((c) => motivoCasaLivre(estado, edificio, c, r) === null && conectada(estado, jogador, c, r))
  if (cercado) {
    if (mapa.margem[casa] === p.margem) return null
    return `Sem espaço ao lado dos seus edifícios: coloque em qualquer casa livre da sua margem (${nomeMargem[p.margem]})`
  }
  return 'Coloque ao lado de um edifício seu'
}

function motivoCasaLivre(estado: GameState, edificio: BuildingType, casa: Coord, r: Regras): string | null {
  const terreno = obterMapa(r).terreno[casa]
  if (!terreno) return `A casa ${casa} não existe no mapa`
  if (terreno === 'capital') return 'A Capital não recebe construções'
  if (estado.tabuleiro[casa]) return `A casa ${casa} já está ocupada`
  if (terreno === 'varzea' && !podeNaVarzea(edificio, r)) return 'Só Campos podem ser construídos na várzea'
  return null
}

function conectada(estado: GameState, jogador: number, casa: Coord, r: Regras): boolean {
  return (obterMapa(r).vizinhos[casa] ?? []).some((v) => estado.tabuleiro[v]?.owner === jogador)
}

function podeNaVarzea(edificio: BuildingType, r: Regras): boolean {
  const def = r.edificios[edificio] as { podeNaVarzea?: boolean }
  return def.podeNaVarzea === true
}

export function montar(
  estado: GameState,
  jogador: number,
  acao: { tipo: 'montar'; edificio: BuildingType; casa: Coord },
  r: Regras = estado.regras,
): ResultadoAcao {
  const prox = proximaMontagem(estado, r)
  if (!prox) return { erro: 'A montagem já terminou' }
  if (jogador !== prox.jogador) return { erro: `Não é a sua vez: agora monta ${estado.jogadores[prox.jogador]?.nome}` }
  if (acao.edificio !== prox.edificio) return { erro: `Agora coloque: ${nomeDe(prox.edificio, r)}` }
  const motivo = motivoCasaInvalidaMontagem(estado, jogador, acao.edificio, acao.casa, r)
  if (motivo) return { erro: motivo }

  const nome = estado.jogadores[jogador]?.nome ?? ''
  const tabuleiro = { ...estado.tabuleiro, [acao.casa]: { owner: jogador, type: acao.edificio, evoluido: false } }
  const log = [...estado.log, { ano: 0, jogador, texto: `${nome} colocou ${nomeDe(acao.edificio, r)} em ${acao.casa}` }]

  // Avança: próximo edifício, próximo jogador, segunda volta (ordem inversa) ou fim da montagem.
  const m = estado.montagem as NonNullable<GameState['montagem']>
  const lista = m.volta === 1 ? r.montagem.primeiraVolta : r.montagem.segundaVolta
  let { volta, indice, passo } = m
  passo++
  if (passo >= lista.length) {
    passo = 0
    indice++
    if (indice >= estado.ordem.length) {
      indice = 0
      if (volta === 1) volta = 2
      else {
        const montado: GameState = { ...estado, tabuleiro, montagem: null, log: [...log, { ano: 0, jogador: null, texto: 'Montagem concluída.' }] }
        return { estado: iniciarAno(montado, 1, r) }
      }
    }
  }
  const novo: GameState = { ...estado, tabuleiro, log, montagem: { volta, indice, passo } }
  return { estado: { ...novo, vez: (proximaMontagem(novo, r) as { jogador: number }).jogador } }
}
