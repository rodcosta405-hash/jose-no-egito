import { describe, expect, it } from 'vitest'
import { casasValidasMontagem, novaPartida, proximaMontagem } from '../src/engine'
import type { ConfigJogador, GameState } from '../src/engine'
import {
  carregar,
  confirmarResumo,
  criarSessao,
  desfazer,
  executar,
  passoDoBot,
  podeDesfazer,
  resumoPendente,
  salvar,
  vezDoBot,
  type Armazenamento,
  type Sessao,
} from '../src/ui/sessao'

const humano = (nome: string): ConfigJogador => ({ nome, tipo: 'humano' })
const bot = (nome: string): ConfigJogador => ({ nome, tipo: 'bot', estrategiaBot: 'populoso' })

function partida(jogadores: ConfigJogador[], semente = 5): GameState {
  return novaPartida({ jogadores, margens: 'sorteio', semente }).estado!
}

function memoria(): Armazenamento & { dados: Map<string, string> } {
  const dados = new Map<string, string>()
  return { dados, getItem: (k) => dados.get(k) ?? null, setItem: (k, v) => void dados.set(k, v), removeItem: (k) => void dados.delete(k) }
}

/** O humano da vez coloca a peça da montagem na primeira casa válida. */
function montarHumano(s: Sessao): Sessao {
  const prox = proximaMontagem(s.estado)!
  return executar(s, prox.jogador, { tipo: 'montar', edificio: prox.edificio, casa: casasValidasMontagem(s.estado)[0]! }).sessao!
}

/** Joga humanos e bots até a condição, com humanos sempre passando / sem alocar. */
function avancarAte(s: Sessao, parar: (s: Sessao) => boolean): Sessao {
  for (let i = 0; i < 10_000 && !parar(s); i++) {
    if (resumoPendente(s)) s = confirmarResumo(s)
    else if (vezDoBot(s)) s = passoDoBot(s)
    else if (s.estado.fase === 'montagem') s = montarHumano(s)
    else {
      const acao = s.estado.fase === 'alocacao' ? { tipo: 'alocar' as const, casas: [] } : { tipo: 'passar' as const }
      s = executar(s, s.estado.vez, acao).sessao!
    }
  }
  return s
}

describe('sessão da interface', () => {
  it('desfaz as ações seguidas do mesmo humano na montagem', () => {
    let s = criarSessao(partida([humano('Ana'), humano('Beto')]))
    const inicial = s.estado
    s = montarHumano(s)
    s = montarHumano(s)
    expect(podeDesfazer(s)).toBe(true)
    expect(s.desfazer).toHaveLength(2)
    s = desfazer(desfazer(s))
    expect(s.estado).toBe(inicial)
    expect(podeDesfazer(s)).toBe(false)
  })

  it('a ação de outro jogador fecha a janela de desfazer', () => {
    let s = criarSessao(partida([humano('Ana'), humano('Beto')]))
    for (let i = 0; i < 3; i++) s = montarHumano(s) // primeiro jogador termina suas 3 peças
    const dono = s.donoDesfazer
    s = montarHumano(s) // outro jogador age
    expect(s.donoDesfazer).not.toBe(dono)
    expect(s.desfazer).toHaveLength(1)
  })

  it('jogada de bot não pode ser desfeita', () => {
    let s = criarSessao(partida([bot('B1'), bot('B2')]))
    s = passoDoBot(s)
    expect(podeDesfazer(s)).toBe(false)
  })

  it('o resumo do ano pausa os bots até ser confirmado', () => {
    let s = criarSessao(partida([humano('Ana'), bot('B1'), bot('B2')]))
    s = avancarAte(s, (x) => resumoPendente(x) !== null)
    expect(resumoPendente(s)!.ano).toBe(1)
    expect(vezDoBot(s)).toBe(false)
    expect(executar(s, s.estado.vez, { tipo: 'passar' }).erro).toBe('Confira o resumo do ano antes de continuar')
    s = confirmarResumo(s)
    expect(resumoPendente(s)).toBeNull()
  })

  it('a partida inteira com 1 humano e 3 bots chega ao fim', () => {
    const s = avancarAte(criarSessao(partida([humano('Ana'), bot('B1'), bot('B2'), bot('B3')])), (x) => x.estado.fase === 'fim' && !resumoPendente(x))
    expect(s.estado.fase).toBe('fim')
    expect(s.erroBot).toBeNull()
  })

  it('salva e carrega a sessão; dados corrompidos são ignorados', () => {
    const mem = memoria()
    const s = montarHumano(criarSessao(partida([humano('Ana'), bot('B1')])))
    salvar(s, mem)
    expect(carregar(mem)).toEqual(s)
    mem.setItem('jose-no-egito:partida:v1', '{quebrado')
    expect(carregar(mem)).toBeNull()
    const quebrado: Armazenamento = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('cheio') }, removeItem: () => {} }
    expect(carregar(quebrado)).toBeNull()
    expect(() => salvar(s, quebrado)).not.toThrow()
  })
})
