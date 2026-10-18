import { useCallback, useEffect, useState } from 'react'
import type { Action, GameState } from '../engine'
import {
  apagarSalva,
  atrasoDaVelocidade,
  carregar,
  confirmarResumo,
  criarSessao,
  desfazer,
  executar,
  passoDoBot,
  salvar,
  vezDoBot,
  type Sessao,
  type Velocidade,
} from './sessao'

const armazenamento = (() => {
  try {
    return window.localStorage
  } catch {
    return null
  }
})()

export function temPartidaSalva(): boolean {
  return armazenamento ? carregar(armazenamento) !== null : false
}

export function useJogo() {
  // Recarregar a página continua a partida salva.
  const [sessao, setSessao] = useState<Sessao | null>(() => (armazenamento ? carregar(armazenamento) : null))

  // Salva a cada mudança e também ao esconder ou fechar a página (o cronômetro do ano fica certo).
  useEffect(() => {
    if (!sessao || !armazenamento) return
    salvar(sessao, armazenamento)
    const aoSair = () => salvar(sessao, armazenamento)
    document.addEventListener('visibilitychange', aoSair)
    window.addEventListener('pagehide', aoSair)
    return () => {
      document.removeEventListener('visibilitychange', aoSair)
      window.removeEventListener('pagehide', aoSair)
    }
  }, [sessao])

  // Bots jogam sozinhos, um passo por vez, no ritmo escolhido.
  useEffect(() => {
    if (!sessao || !vezDoBot(sessao)) return
    const t = window.setTimeout(() => setSessao((s) => (s ? passoDoBot(s) : s)), atrasoDaVelocidade[sessao.velocidade])
    return () => window.clearTimeout(t)
  }, [sessao])

  const agir = useCallback(
    (jogador: number, acao: Action): string | undefined => {
      if (!sessao) return 'Nenhuma partida em andamento'
      const r = executar(sessao, jogador, acao)
      if (r.erro !== undefined) return r.erro
      setSessao(r.sessao)
      return undefined
    },
    [sessao],
  )

  return {
    sessao,
    agir,
    comecar: (estado: GameState, velocidade?: Velocidade) => setSessao(criarSessao(estado, velocidade)),
    continuarSalva: () => {
      const s = armazenamento ? carregar(armazenamento) : null
      if (s) setSessao(s)
    },
    /** Volta à tela inicial; a partida continua salva. */
    irParaMenu: () => setSessao(null),
    /** Encerra de vez: apaga a partida salva. */
    encerrar: () => {
      if (armazenamento) apagarSalva(armazenamento)
      setSessao(null)
    },
    desfazer: () => setSessao((s) => (s ? desfazer(s) : s)),
    confirmarResumo: () => setSessao((s) => (s ? confirmarResumo(s) : s)),
    mudarVelocidade: (v: Velocidade) => setSessao((s) => (s ? { ...s, velocidade: v } : s)),
  }
}

export type Jogo = ReturnType<typeof useJogo>
