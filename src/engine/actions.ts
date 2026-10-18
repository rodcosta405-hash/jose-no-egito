// Validação e aplicação das ações (docs/REGRAS.md seção 6). Uma ação inválida não altera o estado
// e devolve uma mensagem em português.
import { regras as regrasPadrao, type BuildingType, type Custo, type Recurso, type Regras } from './config'
import { obterMapa, type Coord } from './map'
import {
  anoMagro,
  conectadoACapital,
  conectadoAJogador,
  construivel,
  custoConstrucao,
  custoEvolucao,
  descreverCusto,
  motivoForaDaVez,
  ordemDoAno,
  podeNaVarzea,
  podePagar,
} from './queries'
import { montar } from './setup'
import type { Action, GameState, PlayerState, ResultadoAcao } from './types'
import { aplicarAlocacao, motivoAlocacaoInvalida } from './year'

type AcaoDe<T extends Action['tipo']> = Extract<Action, { tipo: T }>

export function aplicar(estado: GameState, jogador: number, acao: Action, r: Regras = regrasPadrao): ResultadoAcao {
  if (acao.tipo === 'montar') {
    if (estado.fase !== 'montagem') return { erro: 'A montagem já terminou' }
    return montar(estado, jogador, acao, r)
  }
  const motivo = validarAcao(estado, jogador, acao, r)
  if (motivo) return { erro: motivo }
  if (acao.tipo === 'alocar') return { estado: aplicarAlocacao(estado, jogador, acao.casas, r) }
  return { estado: avancarVez(executar(estado, jogador, acao, r), r) }
}

/** null se a ação é válida agora; senão, o motivo. */
export function validarAcao(estado: GameState, jogador: number, acao: Action, r: Regras = regrasPadrao): string | null {
  if (acao.tipo === 'montar') return estado.fase === 'montagem' ? null : 'A montagem já terminou'
  if (acao.tipo === 'alocar') return motivoAlocacaoInvalida(estado, jogador, acao.casas, r)
  const fora = motivoForaDaVez(estado, jogador)
  if (fora) return fora
  const p = estado.jogadores[jogador]
  if (!p) return 'Jogador inexistente'
  switch (acao.tipo) {
    case 'construir':
      return validarConstrucao(estado, p, acao, r)
    case 'comerciar':
      return validarComercio(estado, p, acao, r)
    case 'reservar':
      return validarReserva(estado, p, acao.edificio, r)
    case 'demarcar':
      return validarDemarcacao(estado, p, acao.casa, r)
    case 'evoluir':
      return validarEvolucao(estado, p, acao.casa, r)
    case 'entregar':
      return validarEntrega(estado, p, acao.quantidade, r)
    case 'passar':
      return null
  }
}

// ---------- validação ----------

const nomeDe = (tipo: BuildingType, r: Regras) => r.edificios[tipo].nome
const quantidadeValida = (q: number) => Number.isInteger(q) && q >= 1

function validarConstrucao(estado: GameState, p: PlayerState, acao: AcaoDe<'construir'>, r: Regras): string | null {
  const { edificio, casa } = acao
  const nome = nomeDe(edificio, r)
  if (!construivel(edificio, r)) return `${nome} não pode ser construída`
  if (acao.daReserva) {
    if (!p.reserva.includes(edificio)) return `Você não tem ${nome} na reserva`
  } else if (estado.estoque[edificio as keyof GameState['estoque']] <= 0) {
    return `Acabaram os tiles de ${nome}`
  }
  const motivoCasa = motivoCasaConstrucao(estado, p.id, edificio, casa, r)
  if (motivoCasa) return motivoCasa
  const custo = custoConstrucao(estado, p.id, edificio, r)
  if (!podePagar(p, custo)) return `Recursos insuficientes: ${nome} custa ${descreverCusto(custo)}`
  return null
}

function motivoCasaConstrucao(estado: GameState, jogador: number, edificio: BuildingType, casa: Coord, r: Regras): string | null {
  const mapa = obterMapa(r)
  const terreno = mapa.terreno[casa]
  if (!terreno) return `A casa ${casa} não existe no mapa`
  if (terreno === 'capital') return 'A Capital não recebe construções'
  if (estado.tabuleiro[casa]) return `A casa ${casa} já está ocupada`
  const marcador = estado.demarcacoes[casa]
  if (marcador !== undefined && marcador !== jogador) return 'Essa casa está demarcada por outro jogador'
  if (terreno === 'varzea' && !podeNaVarzea(edificio, r)) return 'Só Campos podem ser construídos na várzea'
  const vizinho = (mapa.vizinhos[casa] ?? []).some((v) => estado.tabuleiro[v]?.owner === jogador)
  if (!vizinho && marcador !== jogador) return 'Construa ao lado de um edifício seu ou numa casa demarcada por você'
  return null
}

function validarComercio(estado: GameState, p: PlayerState, acao: AcaoDe<'comerciar'>, r: Regras): string | null {
  const { recurso, direcao, quantidade: q } = acao
  if (!quantidadeValida(q)) return 'Escolha uma quantidade de pelo menos 1'
  if (recurso !== 'cereal' && recurso !== 'pedra') return 'Só se comercia cereal ou pedra'

  if (acao.com === 'capital') {
    if (!conectadoACapital(estado, p.id, r)) return 'Você precisa estar conectado à Capital'
    if (recurso === 'pedra') {
      if (direcao === 'vender' && !r.pedraNaCapital.capitalCompraPedra) return 'A Capital não compra pedra'
      if (direcao === 'vender') return p.pedra >= q ? null : `Você tem só ${p.pedra} pedra`
      const total = q * r.pedraNaCapital.precoCompra
      return p.ouro >= total ? null : `Ouro insuficiente: ${q} pedra custam ${total} ouros`
    }
    if (direcao === 'vender') return p.cereal >= q ? null : `Você tem só ${p.cereal} cereal`
    const { total } = comprarDaCapital(estado.preco, q, r)
    return p.ouro >= total ? null : `Ouro insuficiente: ${q} cereal custam ${total} ouros`
  }

  const outro = estado.jogadores[acao.com]
  if (!outro || outro.id === p.id) return 'Escolha outro jogador para comerciar'
  if (!conectadoAJogador(estado, p.id, outro.id, r)) return `Você não está conectado a ${outro.nome}`
  const total = q * precoEntreJogadores(estado, recurso, r)
  const [vendedor, comprador] = direcao === 'comprar' ? [outro, p] : [p, outro]
  if (vendedor[recurso] < q) {
    return vendedor === p ? `Você tem só ${p[recurso]} ${recurso}` : `${outro.nome} tem só ${outro[recurso]} ${recurso}`
  }
  if (comprador.ouro < total) {
    return comprador === p ? `Ouro insuficiente: custa ${total} ouros` : `${outro.nome} não tem ${total} ouros`
  }
  return null
}

function validarReserva(estado: GameState, p: PlayerState, edificio: BuildingType, r: Regras): string | null {
  const nome = nomeDe(edificio, r)
  if (!construivel(edificio, r)) return `${nome} não pode ser reservada`
  if (p.reserva.length >= r.acoesAuxiliares.reservaMaxima) return `Sua reserva está cheia (máximo ${r.acoesAuxiliares.reservaMaxima})`
  if (estado.estoque[edificio as keyof GameState['estoque']] <= 0) return `Acabaram os tiles de ${nome}`
  return null
}

function validarDemarcacao(estado: GameState, p: PlayerState, casa: Coord, r: Regras): string | null {
  const mapa = obterMapa(r)
  const terreno = mapa.terreno[casa]
  if (!terreno) return `A casa ${casa} não existe no mapa`
  if (terreno === 'capital') return 'A Capital não pode ser demarcada'
  if (estado.tabuleiro[casa]) return `A casa ${casa} já está ocupada`
  if (estado.demarcacoes[casa] !== undefined) return 'Essa casa já está demarcada'
  const minhas = Object.values(estado.demarcacoes).filter((d) => d === p.id).length
  if (minhas >= r.acoesAuxiliares.demarcacaoMaxima) return `Você já tem ${minhas} demarcações no tabuleiro (máximo ${r.acoesAuxiliares.demarcacaoMaxima})`
  if (!(mapa.vizinhos[casa] ?? []).some((v) => estado.tabuleiro[v]?.owner === p.id)) return 'Demarque uma casa ao lado de um edifício seu'
  if (p.ouro < r.acoesAuxiliares.custoDemarcacao) return `Demarcar custa ${r.acoesAuxiliares.custoDemarcacao} ouro`
  return null
}

function validarEvolucao(estado: GameState, p: PlayerState, casa: Coord, r: Regras): string | null {
  const tile = estado.tabuleiro[casa]
  if (!tile || tile.owner !== p.id) return 'Escolha um edifício seu'
  const custo = custoEvolucao(tile.type, r)
  if (!custo) return `${nomeDe(tile.type, r)} não evolui`
  if (tile.evoluido) return 'Esse edifício já está evoluído'
  if (!podePagar(p, custo)) return `Recursos insuficientes: evoluir custa ${descreverCusto(custo)}`
  return null
}

function validarEntrega(estado: GameState, p: PlayerState, q: number, r: Regras): string | null {
  if (!anoMagro(estado, r)) return 'Só nos anos magros'
  if (!conectadoACapital(estado, p.id, r)) return 'Você precisa estar conectado à Capital'
  if (estado.demandaCapital <= 0) return 'A Capital já recebeu todo o cereal deste ano'
  if (p.cereal <= 0) return 'Você não tem cereal'
  if (!quantidadeValida(q)) return 'Escolha uma quantidade de pelo menos 1'
  if (q > p.cereal) return `Você tem só ${p.cereal} cereal`
  if (q > estado.demandaCapital) return `A Capital só aceita mais ${estado.demandaCapital} cereal neste ano`
  return null
}

// ---------- preços ----------

/** Compra unidade a unidade: cada unidade sobe o preço 1 casa e custa o novo preço. */
export function comprarDaCapital(preco: number, q: number, r: Regras = regrasPadrao): { total: number; precoFinal: number } {
  let total = 0
  for (let i = 0; i < q; i++) {
    preco = Math.min(preco + 1, r.precoCereal.maximo)
    total += preco
  }
  return { total, precoFinal: preco }
}

/** Venda unidade a unidade: cada unidade desce o preço 1 casa e rende o novo preço. */
export function venderACapital(preco: number, q: number, r: Regras = regrasPadrao): { total: number; precoFinal: number } {
  let total = 0
  for (let i = 0; i < q; i++) {
    preco = Math.max(preco - 1, r.precoCereal.minimo)
    total += preco
  }
  return { total, precoFinal: preco }
}

/** Preço unitário entre jogadores: cereal ao preço da trilha (sem mover o marcador), pedra a preço fixo. */
export function precoEntreJogadores(estado: GameState, recurso: 'cereal' | 'pedra', r: Regras = regrasPadrao): number {
  return recurso === 'cereal' ? estado.preco : r.comercioEntreJogadores.precoPedra
}

// ---------- execução (a ação já foi validada) ----------

function comJogador(estado: GameState, id: number, f: (p: PlayerState) => Partial<PlayerState>): GameState {
  return { ...estado, jogadores: estado.jogadores.map((p) => (p.id === id ? { ...p, ...f(p) } : p)) }
}

function pagar(p: PlayerState, custo: Custo): Partial<PlayerState> {
  const novo: Partial<PlayerState> = {}
  for (const [k, v] of Object.entries(custo) as [Recurso, number][]) novo[k] = p[k] - v
  return novo
}

function registrar(estado: GameState, jogador: number, texto: string): GameState {
  const nome = estado.jogadores[jogador]?.nome ?? ''
  return { ...estado, log: [...estado.log, { ano: estado.ano, jogador, texto: `${nome} ${texto}` }] }
}

function executar(estado: GameState, j: number, acao: Exclude<Action, AcaoDe<'montar'> | AcaoDe<'alocar'>>, r: Regras): GameState {
  switch (acao.tipo) {
    case 'construir': {
      const { edificio, casa } = acao
      const custo = custoConstrucao(estado, j, edificio, r)
      let e = comJogador(estado, j, (p) => ({
        ...pagar(p, custo),
        ...(acao.daReserva ? { reserva: semUm(p.reserva, edificio) } : {}),
      }))
      const demarcacoes = { ...e.demarcacoes }
      delete demarcacoes[casa]
      e = {
        ...e,
        tabuleiro: { ...e.tabuleiro, [casa]: { owner: j, type: edificio, evoluido: false } },
        demarcacoes,
        estoque: acao.daReserva ? e.estoque : { ...e.estoque, [edificio]: e.estoque[edificio as keyof GameState['estoque']] - 1 },
      }
      return registrar(e, j, `construiu ${nomeDe(edificio, r)} em ${casa}${acao.daReserva ? ' (da reserva)' : ''}`)
    }

    case 'comerciar': {
      const { recurso, direcao, quantidade: q } = acao
      if (acao.com === 'capital') {
        if (recurso === 'pedra') {
          const total = q * r.pedraNaCapital.precoCompra
          const e = comJogador(estado, j, (p) => ({ ouro: p.ouro - total, pedra: p.pedra + q }))
          return registrar(e, j, `comprou ${q} pedra da Capital por ${total} ouros`)
        }
        if (direcao === 'comprar') {
          const { total, precoFinal } = comprarDaCapital(estado.preco, q, r)
          const e = comJogador({ ...estado, preco: precoFinal }, j, (p) => ({ ouro: p.ouro - total, cereal: p.cereal + q }))
          return registrar(e, j, `comprou ${q} cereal da Capital por ${total} ouros (preço agora ${precoFinal})`)
        }
        const { total, precoFinal } = venderACapital(estado.preco, q, r)
        const e = comJogador({ ...estado, preco: precoFinal }, j, (p) => ({ ouro: p.ouro + total, cereal: p.cereal - q }))
        return registrar(e, j, `vendeu ${q} cereal à Capital por ${total} ouros (preço agora ${precoFinal})`)
      }
      const outro = acao.com
      const total = q * precoEntreJogadores(estado, recurso, r)
      const [vendedor, comprador] = direcao === 'comprar' ? [outro, j] : [j, outro]
      let e = comJogador(estado, vendedor, (p) => ({ ouro: p.ouro + total, [recurso]: p[recurso] - q }))
      e = comJogador(e, comprador, (p) => ({ ouro: p.ouro - total, [recurso]: p[recurso] + q }))
      const nomeOutro = estado.jogadores[outro]?.nome ?? ''
      const verbo = direcao === 'comprar' ? `comprou ${q} ${recurso} de ${nomeOutro}` : `vendeu ${q} ${recurso} a ${nomeOutro}`
      return registrar(e, j, `${verbo} por ${total} ouros`)
    }

    case 'reservar': {
      const { edificio } = acao
      let e = comJogador(estado, j, (p) => ({ reserva: [...p.reserva, edificio] }))
      e = { ...e, estoque: { ...e.estoque, [edificio]: e.estoque[edificio as keyof GameState['estoque']] - 1 } }
      return registrar(e, j, `reservou ${nomeDe(edificio, r)}`)
    }

    case 'demarcar': {
      let e = comJogador(estado, j, (p) => ({ ouro: p.ouro - r.acoesAuxiliares.custoDemarcacao }))
      e = { ...e, demarcacoes: { ...e.demarcacoes, [acao.casa]: j } }
      return registrar(e, j, `demarcou ${acao.casa}`)
    }

    case 'evoluir': {
      const tile = estado.tabuleiro[acao.casa]!
      const custo = custoEvolucao(tile.type, r)!
      let e = comJogador(estado, j, (p) => pagar(p, custo))
      e = { ...e, tabuleiro: { ...e.tabuleiro, [acao.casa]: { ...tile, evoluido: true } } }
      const verso = (r.edificios[tile.type] as { verso: { nome: string } }).verso.nome
      return registrar(e, j, `evoluiu ${nomeDe(tile.type, r)} em ${acao.casa} para ${verso}`)
    }

    case 'entregar': {
      const q = acao.quantidade
      const pontos = q * r.contratos.pontosPorCereal
      let e = comJogador(estado, j, (p) => ({ cereal: p.cereal - q, placar: { ...p.placar, contratos: p.placar.contratos + pontos } }))
      e = { ...e, demandaCapital: e.demandaCapital - q }
      return registrar(e, j, `entregou ${q} cereal a José (+${pontos} pontos)`)
    }

    case 'passar':
      return registrar(estado, j, 'passou')
  }
}

function semUm<T>(lista: T[], item: T): T[] {
  const i = lista.indexOf(item)
  return i < 0 ? lista : [...lista.slice(0, i), ...lista.slice(i + 1)]
}

/** Próximo jogador na volta; depois da última volta, passa para a alocação. */
function avancarVez(estado: GameState, r: Regras): GameState {
  const ordem = ordemDoAno(estado)
  const i = ordem.indexOf(estado.vez)
  if (i < ordem.length - 1) return { ...estado, vez: ordem[i + 1] as number }
  if (estado.volta < r.acoesPorAno) return { ...estado, volta: estado.volta + 1, vez: ordem[0] as number }
  return { ...estado, fase: 'alocacao', vez: ordem[0] as number }
}
