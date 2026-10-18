// Consultas para a interface e os bots: o que é válido agora, sem alterar o estado.
import { regras as regrasPadrao, type Regras } from './config'
import { obterMapa, type Coord } from './map'
import { motivoCasaInvalidaMontagem, proximaMontagem } from './setup'
import type { GameState } from './types'

export { proximaMontagem } from './setup'

/** Casas onde o jogador da vez pode pôr o próximo edifício da montagem. */
export function casasValidasMontagem(estado: GameState, r: Regras = regrasPadrao): Coord[] {
  const prox = proximaMontagem(estado, r)
  if (!prox) return []
  return obterMapa(r).casas.filter((c) => motivoCasaInvalidaMontagem(estado, prox.jogador, prox.edificio, c, r) === null)
}
