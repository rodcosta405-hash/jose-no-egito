// Sessão de jogo na interface: estado do motor + desfazer + pausa do resumo do ano + persistência.
// Lógica pura (sem React), para poder ser testada no Node.
import { jogadaDoBot } from '../bots'
import { aplicar, regras as regrasPadrao } from '../engine'
import type { Action, GameState, ResumoAno } from '../engine'
import type { Tempos } from './registro'

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
  /** Tempo gasto em cada ano já resolvido (registro de playtest). */
  tempos: Tempos
  cronometro: Cronometro
}

/** Mede o ano em andamento. Parado (desde = null) na montagem e enquanto um resumo espera "Continuar". */
export interface Cronometro {
  ano: number
  acumuladoMs: number
  desde: number | null
  /** Só no que foi salvo: o cronômetro corria quando a página foi salva e deve voltar a correr ao carregar. */
  retomar?: boolean
}

export function criarSessao(estado: GameState, velocidade: Velocidade = 'normal', agora = Date.now()): Sessao {
  return {
    estado,
    desfazer: [],
    donoDesfazer: null,
    resumosVistos: estado.resumos.length,
    velocidade,
    erroBot: null,
    tempos: {},
    cronometro: { ano: estado.ano, acumuladoMs: 0, desde: estado.fase === 'acoes' || estado.fase === 'alocacao' ? agora : null },
  }
}

const decorrido = (c: Cronometro, agora: number) => c.acumuladoMs + (c.desde === null ? 0 : agora - c.desde)

/** Atualiza tempos e cronômetro depois que o estado mudou de `antes` para `depois`. */
function cronometrar(s: Sessao, antes: GameState, depois: GameState, agora: number): Pick<Sessao, 'tempos' | 'cronometro'> {
  if (depois.resumos.length > antes.resumos.length) {
    // Ano resolvido: guarda o tempo e para o relógio até o resumo ser confirmado.
    const tempos = { ...s.tempos, [antes.ano]: s.cronometro.ano === antes.ano ? decorrido(s.cronometro, agora) : 0 }
    return { tempos, cronometro: { ano: depois.ano, acumuladoMs: 0, desde: null } }
  }
  if (depois.fase !== 'montagem' && s.cronometro.ano !== depois.ano) {
    // Fim da montagem: começa o ano 1.
    return { tempos: s.tempos, cronometro: { ano: depois.ano, acumuladoMs: 0, desde: agora } }
  }
  return { tempos: s.tempos, cronometro: s.cronometro }
}

export function executar(s: Sessao, jogador: number, acao: Action, agora = Date.now()): { sessao: Sessao; erro?: undefined } | { sessao?: undefined; erro: string } {
  if (resumoPendente(s)) return { erro: 'Confira o resumo do ano antes de continuar' }
  const r = aplicar(s.estado, jogador, acao)
  if (!r.estado) return { erro: r.erro }
  const humano = s.estado.jogadores[jogador]?.tipo === 'humano'
  const mesmoDono = humano && s.donoDesfazer === jogador
  // A resolução do ano fecha a janela de desfazer: depois dela já há informação nova (a carta).
  const resolveuAno = r.estado.resumos.length > s.estado.resumos.length
  const desfazer = humano && !resolveuAno ? [...(mesmoDono ? s.desfazer : []), s.estado] : []
  return {
    sessao: { ...s, ...cronometrar(s, s.estado, r.estado, agora), estado: r.estado, desfazer, donoDesfazer: desfazer.length > 0 ? jogador : null },
  }
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

export function confirmarResumo(s: Sessao, agora = Date.now()): Sessao {
  const novo = { ...s, resumosVistos: Math.min(s.resumosVistos + 1, s.estado.resumos.length) }
  // Confirmado o último resumo, o relógio do novo ano começa a correr.
  if (!resumoPendente(novo) && novo.estado.fase !== 'fim' && novo.cronometro.desde === null) {
    return { ...novo, cronometro: { ...novo.cronometro, desde: agora } }
  }
  return novo
}

/** É a vez de um bot e nada está pausando a partida? */
export function vezDoBot(s: Sessao): boolean {
  if (s.estado.fase === 'fim' || resumoPendente(s) || s.erroBot) return false
  return s.estado.jogadores[s.estado.vez]?.tipo === 'bot'
}

export function passoDoBot(s: Sessao, agora = Date.now()): Sessao {
  if (!vezDoBot(s)) return s
  try {
    const { jogador, acao } = jogadaDoBot(s.estado)
    const r = executar(s, jogador, acao, agora)
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

/** Salva com o relógio "congelado": o tempo com a página fechada não entra no registro. */
export function salvar(s: Sessao, armazenamento: Armazenamento, agora = Date.now()): void {
  const c = s.cronometro
  const cronometro: Cronometro = c.desde === null ? c : { ano: c.ano, acumuladoMs: decorrido(c, agora), desde: null, retomar: true }
  try {
    armazenamento.setItem(CHAVE, JSON.stringify({ ...s, cronometro }))
  } catch {
    // Sem armazenamento disponível (navegação privada, cota cheia): segue sem salvar.
  }
}

export function carregar(armazenamento: Armazenamento, agora = Date.now()): Sessao | null {
  try {
    const bruto = armazenamento.getItem(CHAVE)
    if (!bruto) return null
    const s = JSON.parse(bruto) as Partial<Sessao>
    if (!s.estado || !Array.isArray(s.estado.jogadores) || !Array.isArray(s.desfazer)) return null
    // Partidas salvas antes das regras irem para o estado usam as regras padrão.
    const comRegras = (e: GameState): GameState => (e.regras ? e : { ...e, regras: regrasPadrao })
    s.estado = comRegras(s.estado)
    s.desfazer = s.desfazer.map(comRegras)
    const base = { erroBot: null, velocidade: 'normal', donoDesfazer: null, resumosVistos: s.estado.resumos?.length ?? 0, tempos: {}, ...s } as Sessao
    const c = base.cronometro ?? { ano: base.estado.ano, acumuladoMs: 0, desde: null }
    const cronometro: Cronometro = c.retomar ? { ano: c.ano, acumuladoMs: c.acumuladoMs, desde: agora } : c
    return { ...base, cronometro }
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
