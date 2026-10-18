import { describe, expect, it } from 'vitest'
import {
  acoesDisponiveis,
  aplicar,
  capacidadeCereal,
  casasValidasConstrucao,
  custoConstrucao,
  regras,
} from '../src/engine'
import type { Action, GameState } from '../src/engine'
import { cenario, jogador, ok as okCom } from './helpers'

const ok = (e: GameState, j: number, a: Action) => okCom(aplicar, e, j, a)
const erro = (e: GameState, j: number, a: Action) => aplicar(e, j, a).erro

describe('construir', () => {
  it('custo da Residência sobe com as que você já tem', () => {
    const com = (n: number) => {
      const res: Record<string, 'residencia'> = {}
      ;['B4', 'B5', 'B6'].slice(0, n).forEach((c) => (res[c] = 'residencia'))
      return cenario({ edificios0: { C4: 'prefeitura', ...res } })
    }
    expect(custoConstrucao(com(1), 0, 'residencia')).toEqual({ ouro: 2, pedra: 2 })
    expect(custoConstrucao(com(2), 0, 'residencia')).toEqual({ ouro: 4, pedra: 3 })
    expect(custoConstrucao(com(3), 0, 'residencia')).toEqual({ ouro: 6, pedra: 4 })
  })

  it('constrói ao lado de um edifício seu, paga e consome estoque', () => {
    const e = ok(cenario(), 0, { tipo: 'construir', edificio: 'campo', casa: 'B3' })
    expect(e.tabuleiro['B3']).toEqual({ owner: 0, type: 'campo', evoluido: false })
    expect(jogador(e, 0).ouro).toBe(regras.inicial.ouro - 2)
    expect(e.estoque.campo).toBe(regras.estoqueDeTiles.campo - 1)
  })

  it('construir longe do território é recusado', () => {
    expect(erro(cenario(), 0, { tipo: 'construir', edificio: 'campo', casa: 'A8' })).toBe(
      'Construa ao lado de um edifício seu ou numa casa demarcada por você',
    )
  })

  it('construir sobre a própria demarcação é aceito e devolve o marcador', () => {
    const e = ok(cenario({ extra: { demarcacoes: { A8: 0 } } }), 0, { tipo: 'construir', edificio: 'campo', casa: 'A8' })
    expect(e.tabuleiro['A8']?.owner).toBe(0)
    expect(e.demarcacoes['A8']).toBeUndefined()
  })

  it('casa demarcada por outro jogador é recusada', () => {
    expect(erro(cenario({ extra: { demarcacoes: { B3: 1 } } }), 0, { tipo: 'construir', edificio: 'campo', casa: 'B3' })).toBe(
      'Essa casa está demarcada por outro jogador',
    )
  })

  it('na várzea só Campo', () => {
    expect(erro(cenario(), 0, { tipo: 'construir', edificio: 'pedreira', casa: 'C5' })).toBe('Só Campos podem ser construídos na várzea')
    expect(erro(cenario(), 0, { tipo: 'construir', edificio: 'campo', casa: 'C5' })).toBeUndefined()
  })

  it('Capital, casa ocupada, Prefeitura e falta de recursos são recusadas', () => {
    expect(erro(cenario(), 0, { tipo: 'construir', edificio: 'campo', casa: 'D4' })).toBe('A Capital não recebe construções')
    expect(erro(cenario(), 0, { tipo: 'construir', edificio: 'campo', casa: 'B4' })).toBe('A casa B4 já está ocupada')
    expect(erro(cenario(), 0, { tipo: 'construir', edificio: 'prefeitura', casa: 'B3' })).toBe('Prefeitura não pode ser construída')
    expect(erro(cenario({ j0: { ouro: 0 } }), 0, { tipo: 'construir', edificio: 'campo', casa: 'B3' })).toBe(
      'Recursos insuficientes: Campo custa 2 ouro',
    )
  })

  it('estoque esgotado só permite construir da reserva', () => {
    const vazio = cenario({ extra: { estoque: { ...regras.estoqueDeTiles, campo: 0 } }, j0: { reserva: ['campo'] } })
    expect(erro(vazio, 0, { tipo: 'construir', edificio: 'campo', casa: 'B3' })).toBe('Acabaram os tiles de Campo')
    const e = ok(vazio, 0, { tipo: 'construir', edificio: 'campo', casa: 'B3', daReserva: true })
    expect(jogador(e, 0).reserva).toEqual([])
    expect(e.estoque.campo).toBe(0)
    expect(jogador(e, 0).ouro).toBe(regras.inicial.ouro - 2)
  })

  it('não muta o estado de entrada', () => {
    const e = cenario()
    const antes = JSON.stringify(e)
    ok(e, 0, { tipo: 'construir', edificio: 'campo', casa: 'B3' })
    expect(JSON.stringify(e)).toBe(antes)
  })

  it('casas válidas para construir', () => {
    const casas = casasValidasConstrucao(cenario(), 0, 'pedreira')
    expect(casas).toContain('B3')
    expect(casas).not.toContain('C5')
    expect(casas).not.toContain('D4')
  })
})

describe('comerciar com a Capital', () => {
  const rico = (preco: number) => cenario({ j0: { ouro: 50, cereal: 5 }, extra: { preco } })

  it('comprar 3 com o preço em 4 custa 18 e deixa o preço em 7', () => {
    const e = ok(rico(4), 0, { tipo: 'comerciar', com: 'capital', recurso: 'cereal', direcao: 'comprar', quantidade: 3 })
    expect(jogador(e, 0).ouro).toBe(50 - 18)
    expect(jogador(e, 0).cereal).toBe(8)
    expect(e.preco).toBe(7)
  })

  it('vender 2 com o preço em 7 rende 11 e deixa o preço em 5', () => {
    const e = ok(rico(7), 0, { tipo: 'comerciar', com: 'capital', recurso: 'cereal', direcao: 'vender', quantidade: 2 })
    expect(jogador(e, 0).ouro).toBe(50 + 11)
    expect(e.preco).toBe(5)
  })

  it('o preço nunca sai de 1 a 10', () => {
    const alto = ok(rico(9), 0, { tipo: 'comerciar', com: 'capital', recurso: 'cereal', direcao: 'comprar', quantidade: 3 })
    expect(alto.preco).toBe(10)
    expect(jogador(alto, 0).ouro).toBe(50 - 30)
    const baixo = ok(rico(2), 0, { tipo: 'comerciar', com: 'capital', recurso: 'cereal', direcao: 'vender', quantidade: 3 })
    expect(baixo.preco).toBe(1)
    expect(jogador(baixo, 0).ouro).toBe(50 + 3)
  })

  it('ouro insuficiente e falta de conexão são recusados', () => {
    expect(erro(cenario({ extra: { preco: 4 } }), 0, { tipo: 'comerciar', com: 'capital', recurso: 'cereal', direcao: 'comprar', quantidade: 3 })).toBe(
      'Ouro insuficiente: 3 cereal custam 18 ouros',
    )
    const e = { ...cenario(), vez: 1 }
    expect(erro(e, 1, { tipo: 'comerciar', com: 'capital', recurso: 'cereal', direcao: 'comprar', quantidade: 1 })).toBe(
      'Você precisa estar conectado à Capital',
    )
  })

  it('pedra: a Capital vende a 2 e não compra', () => {
    const e = ok(cenario(), 0, { tipo: 'comerciar', com: 'capital', recurso: 'pedra', direcao: 'comprar', quantidade: 1 })
    expect(jogador(e, 0).ouro).toBe(regras.inicial.ouro - 2)
    expect(jogador(e, 0).pedra).toBe(regras.inicial.pedra + 1)
    expect(erro(cenario(), 0, { tipo: 'comerciar', com: 'capital', recurso: 'pedra', direcao: 'vender', quantidade: 1 })).toBe(
      'A Capital não compra pedra',
    )
  })
})

describe('comerciar com outro jogador', () => {
  // Beto com um Campo em B5, vizinho da Residência de Ana em B4.
  const vizinhos = () =>
    cenario({
      edificios1: { H1: 'prefeitura', G1: 'residencia', B5: 'campo' },
      j0: { ouro: 20 },
      j1: { cereal: 6 },
      extra: { preco: 5 },
    })

  it('cereal ao preço da trilha, sem mover o marcador', () => {
    const e = ok(vizinhos(), 0, { tipo: 'comerciar', com: 1, recurso: 'cereal', direcao: 'comprar', quantidade: 2 })
    expect(jogador(e, 0).ouro).toBe(10)
    expect(jogador(e, 0).cereal).toBe(regras.inicial.cereal + 2)
    expect(jogador(e, 1).ouro).toBe(regras.inicial.ouro + 10)
    expect(jogador(e, 1).cereal).toBe(4)
    expect(e.preco).toBe(5)
    expect(e.vez).toBe(1) // só quem joga gasta a ação
  })

  it('pedra a 2 por unidade', () => {
    const e = ok(vizinhos(), 0, { tipo: 'comerciar', com: 1, recurso: 'pedra', direcao: 'vender', quantidade: 1 })
    expect(jogador(e, 0).pedra).toBe(regras.inicial.pedra - 1)
    expect(jogador(e, 0).ouro).toBe(20 + 2)
    expect(jogador(e, 1).ouro).toBe(regras.inicial.ouro - 2)
  })

  it('sem conexão, sem recurso do parceiro ou sem ouro do parceiro é recusado', () => {
    expect(erro(cenario(), 0, { tipo: 'comerciar', com: 1, recurso: 'cereal', direcao: 'comprar', quantidade: 1 })).toBe(
      'Você não está conectado a Beto',
    )
    expect(erro(vizinhos(), 0, { tipo: 'comerciar', com: 1, recurso: 'cereal', direcao: 'comprar', quantidade: 7 })).toBe('Beto tem só 6 cereal')
    expect(erro(vizinhos(), 0, { tipo: 'comerciar', com: 1, recurso: 'cereal', direcao: 'vender', quantidade: 1 })).toBe('Beto não tem 5 ouros')
  })
})

describe('reservar e demarcar', () => {
  it('reservar tira do estoque, sem custo, até o máximo', () => {
    let e = ok(cenario(), 0, { tipo: 'reservar', edificio: 'armazem' })
    expect(jogador(e, 0).reserva).toEqual(['armazem'])
    expect(e.estoque.armazem).toBe(regras.estoqueDeTiles.armazem - 1)
    expect(jogador(e, 0).ouro).toBe(regras.inicial.ouro)
    e = { ...e, vez: 0, jogadores: e.jogadores.map((p) => (p.id === 0 ? { ...p, reserva: ['armazem', 'campo'] } : p)) }
    expect(erro(e, 0, { tipo: 'reservar', edificio: 'campo' })).toBe('Sua reserva está cheia (máximo 2)')
  })

  it('demarcar custa 1 ouro, exige vizinhança e respeita o máximo por jogador', () => {
    const e = ok(cenario(), 0, { tipo: 'demarcar', casa: 'C5' })
    expect(e.demarcacoes['C5']).toBe(0)
    expect(jogador(e, 0).ouro).toBe(regras.inicial.ouro - 1)
    expect(erro(cenario(), 0, { tipo: 'demarcar', casa: 'A8' })).toBe('Demarque uma casa ao lado de um edifício seu')
    expect(erro(cenario({ extra: { demarcacoes: { A8: 0, A7: 0 } } }), 0, { tipo: 'demarcar', casa: 'B3' })).toBe(
      'Você já tem 2 demarcações no tabuleiro (máximo 2)',
    )
    expect(erro(cenario({ extra: { demarcacoes: { B3: 1 } } }), 0, { tipo: 'demarcar', casa: 'B3' })).toBe('Essa casa já está demarcada')
  })

  it('casa demarcada não conecta à Capital', () => {
    // Beto não tem edifício vizinho da Capital; a demarcação dele em E3 não conta.
    const e = { ...cenario({ extra: { demarcacoes: { E3: 1 } } }), vez: 1 }
    expect(erro(e, 1, { tipo: 'comerciar', com: 'capital', recurso: 'pedra', direcao: 'comprar', quantidade: 1 })).toBe(
      'Você precisa estar conectado à Capital',
    )
  })
})

describe('evoluir', () => {
  it('troca o lado, paga o verso e o Celeiro Real soma 8 de capacidade', () => {
    const base = cenario({ edificios0: { C4: 'prefeitura', B4: 'residencia', C3: 'mercado', B3: 'armazem' }, j0: { ouro: 10, pedra: 10 } })
    const sem = cenario({ edificios0: { C4: 'prefeitura', B4: 'residencia', C3: 'mercado' } })
    expect(capacidadeCereal(base, 0) - capacidadeCereal(sem, 0)).toBe(5)
    const e = ok(base, 0, { tipo: 'evoluir', casa: 'B3' })
    expect(e.tabuleiro['B3']?.evoluido).toBe(true)
    expect(capacidadeCereal(e, 0) - capacidadeCereal(sem, 0)).toBe(8)
    expect(jogador(e, 0).ouro).toBe(8)
    expect(jogador(e, 0).pedra).toBe(7)
  })

  it('Prefeitura não evolui; evoluído não evolui de novo; edifício alheio é recusado', () => {
    const e = cenario({ edificios0: { C4: 'prefeitura', B4: 'residencia', C3: ['mercado', true] }, j0: { ouro: 10, pedra: 10 } })
    expect(erro(e, 0, { tipo: 'evoluir', casa: 'C4' })).toBe('Prefeitura não evolui')
    expect(erro(e, 0, { tipo: 'evoluir', casa: 'C3' })).toBe('Esse edifício já está evoluído')
    expect(erro(e, 0, { tipo: 'evoluir', casa: 'H1' })).toBe('Escolha um edifício seu')
  })
})

describe('entregar', () => {
  it('só nos anos magros', () => {
    expect(erro(cenario({ j0: { cereal: 5 } }), 0, { tipo: 'entregar', quantidade: 1 })).toBe('Só nos anos magros')
  })

  it('exige conexão com a Capital', () => {
    const e = { ...cenario({ ano: 8, j1: { cereal: 5 } }), vez: 1 }
    expect(erro(e, 1, { tipo: 'entregar', quantidade: 1 })).toBe('Você precisa estar conectado à Capital')
  })

  it('respeita a demanda de 4 por ano somando todos os jogadores', () => {
    // Beto conectado à Capital por uma Residência em E3.
    let e = cenario({
      ano: 8,
      edificios1: { H1: 'prefeitura', G1: 'residencia', E3: 'residencia' },
      j0: { cereal: 5 },
      j1: { cereal: 5 },
    })
    e = ok(e, 0, { tipo: 'entregar', quantidade: 3 })
    expect(e.demandaCapital).toBe(1)
    expect(jogador(e, 0).placar.contratos).toBe(3 * regras.contratos.pontosPorCereal)
    expect(jogador(e, 0).cereal).toBe(2)
    expect(erro(e, 1, { tipo: 'entregar', quantidade: 2 })).toBe('A Capital só aceita mais 1 cereal neste ano')
    e = ok(e, 1, { tipo: 'entregar', quantidade: 1 })
    expect(e.demandaCapital).toBe(0)
    expect(erro(e, 0, { tipo: 'entregar', quantidade: 1 })).toBe('A Capital já recebeu todo o cereal deste ano')
  })
})

describe('vez e barra de ações', () => {
  it('duas voltas a partir do primeiro jogador e depois alocação', () => {
    let e = cenario()
    e = ok(e, 0, { tipo: 'passar' })
    expect(erro(e, 0, { tipo: 'passar' })).toBe('Não é a sua vez: agora joga Beto')
    e = ok(e, 1, { tipo: 'passar' })
    expect(e.volta).toBe(2)
    expect(e.vez).toBe(0)
    e = ok(e, 0, { tipo: 'passar' })
    e = ok(e, 1, { tipo: 'passar' })
    expect(e.fase).toBe('alocacao')
    expect(e.vez).toBe(0)
    expect(erro(e, 0, { tipo: 'passar' })).toBe('Agora é a hora de alocar trabalhadores')
  })

  it('mostra o motivo dos botões indisponíveis', () => {
    const d = acoesDisponiveis(cenario({ j0: { ouro: 0, pedra: 0 } }), 0)
    expect(d.passar).toBeNull()
    expect(d.entregar).toBe('Só nos anos magros')
    expect(d.reservar).toBeNull()
    expect(d.comerciar).toBeNull()
    expect(d.demarcar).toBe('Nenhuma demarcação possível agora')
    expect(d.construir).toMatch(/^Nenhuma construção possível/)
    expect(acoesDisponiveis(cenario(), 1).passar).toBe('Não é a sua vez: agora joga Ana')
  })
})
