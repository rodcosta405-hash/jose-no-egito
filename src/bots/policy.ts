// Decisão de ação do bot (docs/BOTS.md seções 3 e 4): porte de act_param do simulador Python.
import {
  conectadoACapital,
  conectadoAJogador,
  contar,
  custoConstrucao,
  custoEvolucao,
  edificiosDe,
  podePagar,
} from '../engine'
import type { Action, BuildingType, Coord } from '../engine'
import {
  anoGordo,
  cap,
  criarContexto,
  excedente,
  expansao,
  melhorCasa,
  necessidadeMagra,
  prodMagra,
  pyInt,
  pyRound,
  sobraTrabalhadores,
  W,
  type Contexto,
} from './helpers'
import type { GameState, Regras } from '../engine'

export function agirBot(estado: GameState, jogador: number, r?: Regras): Action {
  const c = criarContexto(estado, jogador, r)
  return decidir(c) ?? { tipo: 'passar' }
}

function decidir(c: Contexto): Action | null {
  const { params: k, p, estado, r } = c
  const ano = estado.ano
  const w = W(c)
  const spare = sobraTrabalhadores(c)
  const capacidade = cap(c)

  if (!anoGordo(c)) {
    const esperado = prodMagra(c, w, 'media')
    const falta = pyRound(w - (p.cereal + esperado))
    if (falta > 0) {
      const a = comprarCereal(c, falta, k.lean_buy)
      if (a) return a
    }
    if (k.use_c) {
      const extra = pyInt(p.cereal - k.keep_c * necessidadeMagra(c))
      if (extra > 0) {
        const a = entregar(c, extra)
        if (a) return a
      }
    }
    const sobra = pyInt(p.cereal - k.keep * necessidadeMagra(c))
    if (sobra > 0 && estado.preco >= k.sell_min) {
      const a = venderCereal(c, sobra, k.sell_min)
      if (a) return a
    }
  } else {
    const minGorda = Math.min(...r.cartas.gordas)
    const bonus = r.edificios.campo.bonusVarzeaAnosGordos
    const prodMin = p.alocacao
      .filter((casa) => estado.tabuleiro[casa]?.type === 'campo' && estado.tabuleiro[casa]?.owner === c.j)
      .reduce((s, casa) => s + minGorda + (c.mapa.terreno[casa] === 'varzea' ? bonus : 0), 0)
    const transborda = pyInt(p.cereal + prodMin - w - capacidade)
    if (transborda > 0) {
      const a = venderCereal(c, transborda, 1)
      if (a) return a
    }
    if (ano >= k.store_from && capacidade < k.store * necessidadeMagra(c)) {
      const a = tentar(c, 'armazem')
      if (a) return a
    }
  }

  for (const chave of k.order) {
    let a: Action | null = null
    if (chave === 'res' && contar(estado, c.j, 'residencia') < k.res_t && ano <= k.stop_res) {
      a = tentar(c, 'residencia')
    } else if (chave === 'mk' && contar(estado, c.j, 'mercado') < k.mk_t && spare > 0) {
      a = tentar(c, 'mercado')
    } else if (chave === 'cp' && contar(estado, c.j, 'campo') < k.cp_t && spare > 0) {
      const varzea = expansao(c).filter((x) => c.mapa.terreno[x] === 'varzea')
      a = (varzea.length > 0 ? construir(c, 'campo', varzea) : null) ?? tentar(c, 'campo')
    } else if (chave === 'pd' && contar(estado, c.j, 'pedreira') < k.pd_t && spare > 0) {
      a = tentar(c, 'pedreira')
    } else if (chave === 'upg' && ano >= k.upg_from) {
      const reserva = anoGordo(c) ? 0 : Math.max(0, pyInt(w - prodMagra(c, w, 'media') - p.cereal)) * estado.preco
      a = evoluir(c, reserva)
    }
    if (a) return a
  }

  if (anoGordo(c) && k.fat_fill && ano >= 4) {
    const quer = pyInt(Math.min(k.store * necessidadeMagra(c), capacidade) - p.cereal)
    if (quer > 0) {
      const a = comprarCereal(c, quer, 3)
      if (a) return a
    }
  }
  return null
}

// ---------- construção ----------

/** Constrói se há tile, recurso e casa (o `build` do Python). */
function construir(c: Contexto, tipo: BuildingType, candidatas?: Coord[]): Action | null {
  if (c.estado.estoque[tipo as keyof GameState['estoque']] <= 0) return null
  if (!podePagar(c.p, custoConstrucao(c.estado, c.j, tipo, c.r))) return null
  const casa = melhorCasa(c, tipo, candidatas)
  return casa ? { tipo: 'construir', edificio: tipo, casa } : null
}

/** BOTS.md §3: constrói ou, faltando só pedra, compra a pedra que falta (gasta a ação). */
function tentar(c: Contexto, tipo: BuildingType): Action | null {
  const a = construir(c, tipo)
  if (a) return a
  const custo = custoConstrucao(c.estado, c.j, tipo, c.r)
  const falta = (custo.pedra ?? 0) - c.p.pedra
  const precoPedra = c.r.pedraNaCapital.precoCompra
  const ouroDepois = c.p.ouro - (custo.ouro ?? 0)
  if ((custo.pedra ?? 0) > 0 && falta > 0 && ouroDepois >= falta * precoPedra && conectadoACapital(c.estado, c.j, c.r)) {
    return { tipo: 'comerciar', com: 'capital', recurso: 'pedra', direcao: 'comprar', quantidade: falta }
  }
  return null
}

// ---------- comércio ----------

export function comprarCereal(c: Contexto, qtd: number, teto: number): Action | null {
  const { estado, p, r } = c
  // 1. Vizinho bot conectado com maior excedente.
  let melhor: number | null = null
  let disponivel = 0
  for (const q of estado.jogadores) {
    if (q.id === c.j || q.tipo !== 'bot' || !conectadoAJogador(estado, c.j, q.id, r)) continue
    const e = excedente(c, q.id)
    if (e > disponivel) {
      melhor = q.id
      disponivel = e
    }
  }
  if (melhor !== null && estado.preco <= teto) {
    const n = Math.min(qtd, disponivel, Math.floor(p.ouro / estado.preco))
    if (n > 0) return { tipo: 'comerciar', com: melhor, recurso: 'cereal', direcao: 'comprar', quantidade: n }
  }
  // 2. Capital, unidade a unidade até o teto ou o ouro.
  if (!conectadoACapital(estado, c.j, r)) return null
  let preco = estado.preco
  let total = 0
  let n = 0
  while (n < qtd) {
    const novo = Math.min(preco + 1, r.precoCereal.maximo)
    if (novo > teto || p.ouro - total < novo) break
    preco = novo
    total += novo
    n++
  }
  return n > 0 ? { tipo: 'comerciar', com: 'capital', recurso: 'cereal', direcao: 'comprar', quantidade: n } : null
}

export function venderCereal(c: Contexto, qtd: number, precoMinimo: number): Action | null {
  const { estado, p, r } = c
  if (!conectadoACapital(estado, c.j, r) || qtd <= 0) return null
  let preco = estado.preco
  let n = 0
  while (n < qtd && p.cereal - n > 0) {
    const novo = Math.max(preco - 1, r.precoCereal.minimo)
    if (novo < precoMinimo) break
    preco = novo
    n++
  }
  return n > 0 ? { tipo: 'comerciar', com: 'capital', recurso: 'cereal', direcao: 'vender', quantidade: n } : null
}

function entregar(c: Contexto, qtd: number): Action | null {
  if (anoGordo(c) || !conectadoACapital(c.estado, c.j, c.r)) return null
  const q = Math.min(qtd, c.estado.demandaCapital, c.p.cereal)
  return q > 0 ? { tipo: 'entregar', quantidade: q } : null
}

// ---------- evolução ----------

const ordemEvolucao: Partial<Record<BuildingType, number>> = { mercado: 0, pedreira: 1, residencia: 2, armazem: 3, campo: 4 }

function evoluir(c: Contexto, reservaOuro: number): Action | null {
  const candidatos = edificiosDe(c.estado, c.j)
    .filter(([, t]) => !t.evoluido && ordemEvolucao[t.type] !== undefined && custoEvolucao(t.type, c.r))
    .sort(([ca, a], [cb, b]) => {
      const d = (ordemEvolucao[a.type] as number) - (ordemEvolucao[b.type] as number)
      return d !== 0 ? d : Number(!c.p.alocacao.includes(ca)) - Number(!c.p.alocacao.includes(cb))
    })
  for (const [casa, t] of candidatos) {
    if (t.type === 'campo' && !c.p.alocacao.includes(casa) && !anoGordo(c)) continue
    const custo = custoEvolucao(t.type, c.r)!
    if (c.p.ouro - reservaOuro >= (custo.ouro ?? 0) && c.p.pedra >= (custo.pedra ?? 0)) return { tipo: 'evoluir', casa }
  }
  return null
}
