// Estrutura do ano (docs/REGRAS.md seção 5): início do ano, alocação e resolução.
import type { Regras } from './config'
import { obterMapa, type Coord } from './map'
import { anoMagro, capacidadeCereal, ordemDoAno, pontuacao, precisaTrabalhador, trabalhadores } from './queries'
import { finalizarPartida } from './scoring'
import type { GameState, PlayerState, ResumoJogadorAno } from './types'

/** Prepara o ano `ano`: gira o primeiro jogador (a partir do ano 2) e fixa a demanda da Capital. */
export function iniciarAno(estado: GameState, ano: number, r: Regras = estado.regras): GameState {
  let primeiro = estado.primeiro
  if (ano > 1) {
    const i = estado.ordem.indexOf(primeiro)
    primeiro = estado.ordem[(i + 1) % estado.ordem.length] as number
  }
  const magro = ano > r.anos.gordos
  const fase = magro ? 'magro' : 'gordo'
  return {
    ...estado,
    ano,
    primeiro,
    fase: 'acoes',
    volta: 1,
    vez: primeiro,
    demandaCapital: magro ? r.contratos.demandaPorAnoMagro : 0,
    log: [
      ...estado.log,
      {
        ano,
        jogador: null,
        texto: `Começa o ano ${ano} (${fase}). Primeiro jogador: ${estado.jogadores[primeiro]?.nome}.`,
      },
    ],
  }
}

// ---------- alocação ----------

export function motivoAlocacaoInvalida(estado: GameState, jogador: number, casas: Coord[], r: Regras = estado.regras): string | null {
  if (estado.fase !== 'alocacao') return 'Agora não é a hora de alocar trabalhadores'
  if (jogador !== estado.vez) return `Não é a sua vez: agora aloca ${estado.jogadores[estado.vez]?.nome}`
  if (new Set(casas).size !== casas.length) return 'No máximo 1 trabalhador por edifício'
  for (const c of casas) {
    const t = estado.tabuleiro[c]
    if (!t || t.owner !== jogador) return `A casa ${c} não tem edifício seu`
    if (!precisaTrabalhador(t.type, r)) return `${r.edificios[t.type].nome} não recebe trabalhador`
  }
  const w = trabalhadores(estado, jogador, r)
  if (casas.length > w) return `Você tem só ${w} trabalhadores`
  return null
}

/** Aplica a alocação já validada; o último jogador a alocar dispara a resolução do ano. */
export function aplicarAlocacao(estado: GameState, jogador: number, casas: Coord[], r: Regras = estado.regras): GameState {
  const e: GameState = {
    ...estado,
    jogadores: estado.jogadores.map((p) => (p.id === jogador ? { ...p, alocacao: [...casas] } : p)),
  }
  const ordem = ordemDoAno(e)
  const i = ordem.indexOf(jogador)
  if (i < ordem.length - 1) return { ...e, vez: ordem[i + 1] as number }
  return resolverAno(e, r)
}

// ---------- resolução ----------

/** Carta, preço, produção, alimentação e armazenagem; depois abre o próximo ano ou encerra a partida. */
export function resolverAno(estado: GameState, r: Regras = estado.regras): GameState {
  const mapa = obterMapa(r)
  const magro = anoMagro(estado, r)
  const carta = estado.baralho[estado.ano - 1] as number

  const ancora = magro ? r.precoCereal.ancoraMagros : r.precoCereal.ancoraGordos
  const preco = estado.preco + Math.sign(ancora - estado.preco)

  const resumos: ResumoJogadorAno[] = []
  const jogadores: PlayerState[] = estado.jogadores.map((p) => {
    const producao = { ouro: 0, pedra: 0, cereal: 0 }
    for (const c of p.alocacao) {
      const t = estado.tabuleiro[c]
      if (!t || t.owner !== p.id) continue
      const terreno = mapa.terreno[c]
      if (t.type === 'campo') {
        const def = r.edificios.campo
        producao.cereal += carta + (terreno === 'varzea' ? (magro ? def.bonusVarzeaAnosMagros : def.bonusVarzeaAnosGordos) : 0)
      } else if (t.type === 'pedreira') {
        const def = r.edificios.pedreira
        producao.pedra += def.produzPedra + (terreno === 'rocha' ? def.bonusRocha : 0) + (t.evoluido ? def.verso.bonusPedra : 0)
      } else if (t.type === 'mercado') {
        const def = r.edificios.mercado
        producao.ouro += def.produzOuro + (t.evoluido ? def.verso.bonusOuro : 0)
      }
    }

    const w = trabalhadores(estado, p.id, r)
    const consumo = r.populacao.consumoPorTrabalhador
    let cereal = p.cereal + producao.cereal
    const alimentados = Math.min(w, Math.floor(cereal / consumo))
    cereal -= alimentados * consumo
    const semComida = w - alimentados
    const ptsAlim = alimentados * r.populacao.pontosAlimentado
    const ptsFome = semComida * r.populacao.pontosSemComida

    const cap = capacidadeCereal(estado, p.id, r)
    const descartado = Math.max(0, cereal - cap)
    cereal -= descartado

    const novo: PlayerState = {
      ...p,
      ouro: p.ouro + producao.ouro,
      pedra: p.pedra + producao.pedra,
      cereal,
      alimentadosUltimoAno: alimentados,
      placar: { ...p.placar, alimentacao: p.placar.alimentacao + ptsAlim, fome: p.placar.fome + ptsFome },
    }
    resumos.push({
      jogador: p.id,
      producao,
      trabalhadores: w,
      alimentados,
      semComida,
      pontosAno: ptsAlim + ptsFome,
      descartado,
      totalAcumulado: pontuacao(novo),
    })
    return novo
  })

  const resolvido: GameState = {
    ...estado,
    preco,
    jogadores,
    cartasReveladas: [...estado.cartasReveladas, carta],
    resumos: [...estado.resumos, { ano: estado.ano, carta, preco, jogadores: resumos }],
    log: [...estado.log, { ano: estado.ano, jogador: null, texto: `Carta do ano ${estado.ano}: ${carta}. Preço do cereal: ${preco}.` }],
  }
  if (estado.ano >= r.anos.total) return finalizarPartida(resolvido, r)
  return iniciarAno(resolvido, estado.ano + 1, r)
}
