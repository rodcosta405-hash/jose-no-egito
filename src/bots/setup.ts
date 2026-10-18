// Montagem do bot (docs/BOTS.md seção 6): porte de make_setup (referencia/mapa_em_s.py).
import { casasValidasMontagem, distanciaManhattan, proximaMontagem } from '../engine'
import type { Action, GameState, Regras } from '../engine'
import { criarContexto, melhorCasa, notaPrefeitura } from './helpers'

export function montarBot(estado: GameState, r?: Regras): { jogador: number; acao: Action } {
  const prox = proximaMontagem(estado, r)
  if (!prox) throw new Error('A montagem já terminou')
  const c = criarContexto(estado, prox.jogador, r)
  // O motor já filtra as casas válidas (inclusive a regra provisória do jogador cercado).
  const validas = casasValidasMontagem(estado, r)

  let casa: string | null
  if (prox.edificio === 'prefeitura') {
    const ocupadas = Object.keys(estado.tabuleiro)
    const longe = validas.filter((x) => ocupadas.every((o) => distanciaManhattan(x, o) >= 3))
    const candidatas = longe.length > 0 ? longe : validas
    casa = null
    let nota = -Infinity
    for (const x of candidatas) {
      const n = notaPrefeitura(c, x)
      if (n > nota) {
        nota = n
        casa = x
      }
    }
  } else {
    casa = melhorCasa(c, prox.edificio, validas)
  }
  if (!casa) throw new Error(`Bot sem casa para ${prox.edificio} na montagem`)
  return { jogador: prox.jogador, acao: { tipo: 'montar', edificio: prox.edificio, casa } }
}
