// Consultas para a interface, os bots e o próprio motor: o que é válido agora, sem alterar o estado.
// actions.ts também importa este arquivo; o ciclo é seguro porque validarAcao só é usada dentro de funções.
import { validarAcao } from './actions'
import { regras as regrasPadrao, tiposDeEdificio, type BuildingType, type Custo, type Recurso, type Regras } from './config'
import { obterMapa, type Coord } from './map'
import { motivoCasaInvalidaMontagem, proximaMontagem } from './setup'
import type { Action, GameState, PlayerState, Tile } from './types'

export { proximaMontagem } from './setup'

// ---------- montagem ----------

/** Casas onde o jogador da vez pode pôr o próximo edifício da montagem. */
export function casasValidasMontagem(estado: GameState, r: Regras = regrasPadrao): Coord[] {
  const prox = proximaMontagem(estado, r)
  if (!prox) return []
  return obterMapa(r).casas.filter((c) => motivoCasaInvalidaMontagem(estado, prox.jogador, prox.edificio, c, r) === null)
}

// ---------- ano e turno ----------

export function anoMagro(estado: GameState, r: Regras = regrasPadrao): boolean {
  return estado.ano > r.anos.gordos
}

/** Ordem de jogo deste ano, começando pelo primeiro jogador. */
export function ordemDoAno(estado: GameState): number[] {
  const i = estado.ordem.indexOf(estado.primeiro)
  return [...estado.ordem.slice(i), ...estado.ordem.slice(0, i)]
}

// ---------- edifícios e jogador ----------

export function edificiosDe(estado: GameState, jogador: number): [Coord, Tile][] {
  return Object.entries(estado.tabuleiro).filter(([, t]) => t.owner === jogador)
}

export function contar(estado: GameState, jogador: number, tipo: BuildingType): number {
  return edificiosDe(estado, jogador).filter(([, t]) => t.type === tipo).length
}

export function precisaTrabalhador(tipo: BuildingType, r: Regras = regrasPadrao): boolean {
  return (r.edificios[tipo] as { precisaTrabalhador?: boolean }).precisaTrabalhador === true
}

export function construivel(tipo: BuildingType, r: Regras = regrasPadrao): boolean {
  return (r.edificios[tipo] as { construivel?: boolean }).construivel !== false
}

export function podeNaVarzea(tipo: BuildingType, r: Regras = regrasPadrao): boolean {
  return (r.edificios[tipo] as { podeNaVarzea?: boolean }).podeNaVarzea === true
}

export function trabalhadores(estado: GameState, jogador: number, r: Regras = regrasPadrao): number {
  return contar(estado, jogador, 'residencia') * r.edificios.residencia.trabalhadores
}

export function capacidadeCereal(estado: GameState, jogador: number, r: Regras = regrasPadrao): number {
  let cap = 0
  for (const [, t] of edificiosDe(estado, jogador)) {
    if (t.type === 'prefeitura') cap += r.edificios.prefeitura.capacidadeCereal
    if (t.type === 'armazem') cap += r.edificios.armazem.capacidadeCereal + (t.evoluido ? r.edificios.armazem.verso.bonusCapacidade : 0)
  }
  return cap
}

export function pontuacao(p: PlayerState): number {
  const s = p.placar
  return s.alimentacao + s.fome + s.contratos + s.impressos + s.sobras
}

// ---------- conexões ----------

export function conectadoACapital(estado: GameState, jogador: number, r: Regras = regrasPadrao): boolean {
  const mapa = obterMapa(r)
  return edificiosDe(estado, jogador).some(([c]) => (mapa.vizinhos[c] ?? []).some((v) => mapa.terreno[v] === 'capital'))
}

export function conectadoAJogador(estado: GameState, jogador: number, outro: number, r: Regras = regrasPadrao): boolean {
  if (jogador === outro) return false
  const mapa = obterMapa(r)
  return edificiosDe(estado, jogador).some(([c]) => (mapa.vizinhos[c] ?? []).some((v) => estado.tabuleiro[v]?.owner === outro))
}

// ---------- custos ----------

export function custoConstrucao(estado: GameState, jogador: number, tipo: BuildingType, r: Regras = regrasPadrao): Custo {
  const def = r.edificios[tipo] as { custo?: Custo }
  const base: Custo = { ...(def.custo ?? {}) }
  if (tipo === 'residencia') {
    const extras = Math.max(0, contar(estado, jogador, 'residencia') - 1)
    for (const [k, v] of Object.entries(r.edificios.residencia.escaladaPorResidenciaExtra) as [Recurso, number][]) {
      base[k] = (base[k] ?? 0) + v * extras
    }
  }
  return base
}

export function custoEvolucao(tipo: BuildingType, r: Regras = regrasPadrao): Custo | null {
  const def = r.edificios[tipo] as { verso?: { custo: Custo } }
  return def.verso ? { ...def.verso.custo } : null
}

export function podePagar(p: PlayerState, custo: Custo): boolean {
  return (Object.entries(custo) as [Recurso, number][]).every(([k, v]) => p[k] >= v)
}

export function descreverCusto(custo: Custo): string {
  const partes = (Object.entries(custo) as [Recurso, number][]).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`)
  return partes.length > 0 ? partes.join(' + ') : 'nada'
}

// ---------- validade das ações (as mensagens são as mesmas que o motor devolve) ----------

/** Casas onde o jogador pode construir este tipo agora. */
export function casasValidasConstrucao(
  estado: GameState,
  jogador: number,
  edificio: BuildingType,
  daReserva = false,
  r: Regras = regrasPadrao,
): Coord[] {
  return obterMapa(r).casas.filter((casa) => validarAcao(estado, jogador, { tipo: 'construir', edificio, casa, daReserva }, r) === null)
}

export function casasValidasDemarcacao(estado: GameState, jogador: number, r: Regras = regrasPadrao): Coord[] {
  return obterMapa(r).casas.filter((casa) => validarAcao(estado, jogador, { tipo: 'demarcar', casa }, r) === null)
}

export function casasValidasEvolucao(estado: GameState, jogador: number, r: Regras = regrasPadrao): Coord[] {
  return edificiosDe(estado, jogador)
    .map(([c]) => c)
    .filter((casa) => validarAcao(estado, jogador, { tipo: 'evoluir', casa }, r) === null)
}

export type TipoAcaoDoAno = 'construir' | 'comerciar' | 'reservar' | 'demarcar' | 'evoluir' | 'entregar' | 'passar'

/**
 * Para cada botão da barra de ações: null se há ao menos uma jogada válida desse tipo,
 * ou o motivo para mostrar ao jogador.
 */
export function acoesDisponiveis(estado: GameState, jogador: number, r: Regras = regrasPadrao): Record<TipoAcaoDoAno, string | null> {
  const geral = motivoForaDaVez(estado, jogador)
  const p = estado.jogadores[jogador]
  if (geral || !p) {
    const m = geral ?? 'Jogador inexistente'
    return { construir: m, comerciar: m, reservar: m, demarcar: m, evoluir: m, entregar: m, passar: m }
  }

  const algum = (acoes: Action[], seNenhuma: string): string | null => {
    let primeiro: string | null = null
    for (const a of acoes) {
      const m = validarAcao(estado, jogador, a, r)
      if (m === null) return null
      primeiro ??= m
    }
    return acoes.length === 1 && primeiro ? primeiro : seNenhuma
  }
  const casas = obterMapa(r).casas
  const tipos = tiposDeEdificio.filter((t) => construivel(t, r))

  const construcoes: Action[] = []
  for (const edificio of tipos) {
    for (const casa of casas) {
      construcoes.push({ tipo: 'construir', edificio, casa })
      if (p.reserva.includes(edificio)) construcoes.push({ tipo: 'construir', edificio, casa, daReserva: true })
    }
  }

  const parceiros = estado.jogadores.filter((q) => conectadoAJogador(estado, jogador, q.id, r))
  const comerciar =
    conectadoACapital(estado, jogador, r) || parceiros.length > 0 ? null : 'Você precisa estar conectado à Capital ou a outro jogador'

  return {
    construir: algum(construcoes, 'Nenhuma construção possível agora (falta recurso, tile ou espaço)'),
    comerciar,
    reservar:
      p.reserva.length >= r.acoesAuxiliares.reservaMaxima
        ? `Sua reserva está cheia (máximo ${r.acoesAuxiliares.reservaMaxima})`
        : algum(tipos.map((edificio) => ({ tipo: 'reservar', edificio })), 'Não há tiles disponíveis para reservar'),
    demarcar: algum(
      casas.map((casa) => ({ tipo: 'demarcar', casa })),
      'Nenhuma demarcação possível agora',
    ),
    evoluir: algum(
      edificiosDe(estado, jogador).map(([casa]) => ({ tipo: 'evoluir', casa })),
      'Nenhum edifício pode ser evoluído agora (falta recurso ou já estão evoluídos)',
    ),
    entregar: algum([{ tipo: 'entregar', quantidade: 1 }], ''),
    passar: null,
  }
}

/** Motivo comum a todas as ações do ano: fase errada ou vez de outro jogador. */
export function motivoForaDaVez(estado: GameState, jogador: number): string | null {
  if (estado.fase === 'fim') return 'A partida terminou'
  if (estado.fase === 'montagem') return 'Termine a montagem antes de outras ações'
  if (estado.fase !== 'acoes') return 'Agora é a hora de alocar trabalhadores'
  if (jogador !== estado.vez) return `Não é a sua vez: agora joga ${estado.jogadores[estado.vez]?.nome}`
  return null
}
