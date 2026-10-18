// Sessão de jogo na interface: estado do motor + desfazer + pausa do resumo do ano + persistência.
// Lógica pura (sem React), para poder ser testada no Node.
import { jogadaDoBot } from '../bots'
import { aplicar } from '../engine'
import type { Action, GameState, ResumoAno } from '../engine'

export type Velocidade = 'lenta' | 'normal' | 'instantanea'
export const atrasoDaVelocidade: Record<Velocidade, number> = { lenta: 1000, normal: 400, instantanea: 0 }
export const nomesDaVelocidade: Record<Velocidade, string> = { lenta: 'Lenta', normal: 'Normal', instantanea: 'Instantânea' }

export interface Sessao {
  estado: GameState
  /** Estados anteriores às ações seguidas do humano `donoDesfazer`; some quando outro jogador age. */
  desfazer: GameState[]
  donoDesfazer: number | null
  /** Quantos resumos de ano o jogador já confirmou. */
  resumosVistos: number
  velocidade: Velocidade
  /** Erro do motor numa jogada de bot (não deveria acontecer): para os bots e mostra o problema. */
  erroBot: string | null
}

export function criarSessao(estado: GameState, velocidade: Velocidade = 'normal'): Sessao {
  return { estado, desfazer: [], donoDesfazer: null, resumosVistos: estado.resumos.length, velocidade, erroBot: null }
}

export function executar(s: Sessao, jogador: number, acao: Action): { sessao: Sessao; erro?: undefined } | { sessao?: undefined; erro: string } {
  if (resumoPendente(s)) return { erro: 'Confira o resumo do ano antes de continuar' }
  const r = aplicar(s.estado, jogador, acao)
  if (!r.estado) return { erro: r.erro }
  const humano = s.estado.jogadores[jogador]?.tipo === 'humano'
  const mesmoDono = humano && s.donoDesfazer === jogador
  // A resolução do ano fecha a janela de desfazer: depois dela já há informação nova (a carta).
  const resolveuAno = r.estado.resumos.length > s.estado.resumos.length
  const desfazer = humano && !resolveuAno ? [...(mesmoDono ? s.desfazer : []), s.estado] : []
  return { sessao: { ...s, estado: r.estado, desfazer, donoDesfazer: desfazer.length > 0 ? jogador : null } }
}

export function podeDesfazer(s: Sessao): boolean {
  return s.desfazer.length > 0
}

export function desfazer(s: Sessao): Sessao {
  const anterior = s.desfazer[s.desfazer.length - 1]
  if (!anterior) return s
  const resto = s.desfazer.slice(0, -1)
  return { ...s, estado: anterior, desfazer: resto, donoDesfazer: resto.length > 0 ? s.donoDesfazer : null }
}

/** Resumo de ano ainda não confirmado (a interface mostra e espera "Continuar"). */
export function resumoPendente(s: Sessao): ResumoAno | null {
  return s.estado.resumos.length > s.resumosVistos ? (s.estado.resumos[s.resumosVistos] ?? null) : null
}

export function confirmarResumo(s: Sessao): Sessao {
  return { ...s, resumosVistos: Math.min(s.resumosVistos + 1, s.estado.resumos.length) }
}

/** É a vez de um bot e nada está pausando a partida? */
export function vezDoBot(s: Sessao): boolean {
  if (s.estado.fase === 'fim' || resumoPendente(s) || s.erroBot) return false
  return s.estado.jogadores[s.estado.vez]?.tipo === 'bot'
}

export function passoDoBot(s: Sessao): Sessao {
  if (!vezDoBot(s)) return s
  try {
    const { jogador, acao } = jogadaDoBot(s.estado)
    const r = executar(s, jogador, acao)
    return r.sessao ?? { ...s, erroBot: `O motor recusou a jogada de ${s.estado.jogadores[jogador]?.nome}: ${r.erro}` }
  } catch (e) {
    return { ...s, erroBot: `Erro do bot: ${(e as Error).message}` }
  }
}

// ---------- persistência ----------

const CHAVE = 'jose-no-egito:partida:v1'

export interface Armazenamento {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

export function salvar(s: Sessao, armazenamento: Armazenamento): void {
  try {
    armazenamento.setItem(CHAVE, JSON.stringify(s))
  } catch {
    // Sem armazenamento disponível (navegação privada, cota cheia): segue sem salvar.
  }
}

export function carregar(armazenamento: Armazenamento): Sessao | null {
  try {
    const bruto = armazenamento.getItem(CHAVE)
    if (!bruto) return null
    const s = JSON.parse(bruto) as Partial<Sessao>
    if (!s.estado || !Array.isArray(s.estado.jogadores) || !Array.isArray(s.desfazer)) return null
    return { erroBot: null, velocidade: 'normal', donoDesfazer: null, resumosVistos: s.estado.resumos?.length ?? 0, ...s } as Sessao
  } catch {
    return null
  }
}

export function apagarSalva(armazenamento: Armazenamento): void {
  try {
    armazenamento.removeItem(CHAVE)
  } catch {
    // ignora
  }
}
