// Alocação de trabalhadores do bot (docs/BOTS.md seção 5): porte de allocate.
import { edificiosDe } from '../engine'
import type { Coord, GameState, Regras } from '../engine'
import { anoGordo, cap, camposOrdenados, criarContexto, W } from './helpers'

export function alocarBot(estado: GameState, jogador: number, r?: Regras): Coord[] {
  const c = criarContexto(estado, jogador, r)
  const gordo = anoGordo(c)
  const cartas = gordo ? c.r.cartas.gordas : c.r.cartas.magras
  const cartaMedia = cartas.reduce((a, b) => a + b, 0) / cartas.length
  const bonusVarzea = gordo ? c.r.edificios.campo.bonusVarzeaAnosGordos : c.r.edificios.campo.bonusVarzeaAnosMagros

  const meus = edificiosDe(estado, jogador)
  const mercados = meus.filter(([, t]) => t.type === 'mercado').map(([casa]) => casa)
  const pedreiras = meus.filter(([, t]) => t.type === 'pedreira').map(([casa]) => casa)
  const pedreirasOrdenadas = [...pedreiras.filter((x) => c.mapa.terreno[x] === 'rocha'), ...pedreiras.filter((x) => c.mapa.terreno[x] !== 'rocha')]
  const campos = camposOrdenados(c)

  const alocacao: Coord[] = []
  let livres = W(c)
  let estoque = c.p.cereal - livres
  const capacidade = cap(c)
  const por = (casa: Coord) => {
    alocacao.push(casa)
    livres--
  }

  if (c.params.mk_first) for (const m of mercados) if (livres > 0) por(m)
  for (const campo of campos) {
    if (livres === 0 || (gordo && estoque >= capacidade)) break
    por(campo)
    estoque += cartaMedia + (c.mapa.terreno[campo] === 'varzea' ? bonusVarzea : 0)
  }
  for (const m of mercados) if (livres > 0 && !alocacao.includes(m)) por(m)
  for (const q of pedreirasOrdenadas) if (livres > 0) por(q)
  for (const campo of campos) if (livres > 0 && !alocacao.includes(campo)) por(campo)
  return alocacao
}
