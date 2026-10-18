import { describe, expect, it } from 'vitest'
import { jogarPartidaDeBots, simular, taxaVitoria } from '../src/bots/simulacao'
import { aplicar, custoConstrucao, novaPartida, regras, validarRegras } from '../src/engine'
import type { Regras } from '../src/engine'
import { alterados, comValor, ler, lerLista, listarCampos, verificar } from '../src/ui/designer/campos'

const com = (caminho: string, valor: unknown): Regras => validarRegras(comValor(regras, caminho, valor))

describe('regras dentro da partida', () => {
  it('a partida usa as regras com que foi criada, sem ninguém passar r', () => {
    const r2 = com('edificios.campo.custo.ouro', 5)
    const e = novaPartida({ jogadores: [{ nome: 'A', tipo: 'humano' }, { nome: 'B', tipo: 'humano' }], margens: 'sorteio', semente: 1 }, r2).estado!
    expect(e.regras).toBe(r2)
    expect(custoConstrucao(e, 0, 'campo')).toEqual({ ouro: 5 })
    // Ações também seguem as regras da partida.
    const r3 = com('acoesAuxiliares.custoDemarcacao', 99)
    const f = novaPartida({ jogadores: [{ nome: 'A', tipo: 'humano' }, { nome: 'B', tipo: 'humano' }], margens: 'sorteio', semente: 1 }, r3).estado!
    expect(f.regras.acoesAuxiliares.custoDemarcacao).toBe(99)
    expect(aplicar(f, 0, { tipo: 'passar' }).erro).toBe('Termine a montagem antes de outras ações')
  })

  it('partida de bots com regras editadas termina usando essas regras', () => {
    const r2 = com('anos.total', 10)
    const e = jogarPartidaDeBots(['populoso', 'entregador'], 4, r2)
    expect(e.ano).toBe(10)
    expect(e.resumos).toHaveLength(10)
  })
})

describe('campos do modo designer', () => {
  it('lista números, listas de números e booleanos; ignora textos e listas de casas', () => {
    const campos = listarCampos(regras)
    const caminhos = campos.map((c) => c.caminho)
    expect(caminhos).toContain('contratos.pontosPorCereal')
    expect(caminhos).toContain('edificios.residencia.verso.custo.pedra')
    expect(campos.find((c) => c.caminho === 'cartas.gordas')?.tipo).toBe('lista')
    expect(campos.find((c) => c.caminho === 'pedraNaCapital.capitalCompraPedra')?.tipo).toBe('booleano')
    expect(caminhos).not.toContain('mapa.varzea')
    expect(caminhos).not.toContain('versao')
    expect(campos.find((c) => c.caminho === 'edificios.mercado.produzOuro')?.grupo).toBe('edificios.mercado')
  })

  it('comValor não altera a entrada; alterados aponta as diferenças', () => {
    const r2 = comValor(regras, 'contratos.pontosPorCereal', 2)
    expect(regras.contratos.pontosPorCereal).toBe(3)
    expect(ler(r2, 'contratos.pontosPorCereal')).toBe(2)
    expect(alterados(r2, regras)).toEqual(['contratos.pontosPorCereal'])
  })

  it('lê listas de cartas', () => {
    expect(lerLista('3, 3, 4;5  5')).toEqual([3, 3, 4, 5, 5])
    expect(lerLista('3, x')).toBeNull()
    expect(lerLista('')).toBeNull()
  })

  it('verificar lista os erros do validador e avisa sobre margens diferentes de 23', () => {
    expect(verificar(regras)).toEqual({ regras, erros: [], avisos: [] })
    const ruim = verificar(comValor(regras, 'cartas.sorteadasPorFase', 20))
    expect(ruim.regras).toBeNull()
    expect(ruim.erros[0]).toMatch(/cartas.gordas" tem 10 cartas/)
    const mapa = verificar(comValor(regras, 'mapa.rochas', [...regras.mapa.rochas, 'B2']))
    expect(mapa.regras).not.toBeNull()
    expect(mapa.avisos).toEqual([])
    const semVarzea = verificar(comValor(regras, 'mapa.varzea', regras.mapa.varzea.filter((c) => c !== 'C5')))
    expect(semVarzea.avisos.length).toBeGreaterThan(0)
  })
})

describe('aceite da Fase 6', () => {
  it('contratos valendo 2 em vez de 3: o entregador vence menos (200 partidas, mesmas sementes)', () => {
    const mesa = ['populoso', 'entregador', 'populoso', 'entregador']
    const padrao = simular(mesa, 200, 1)
    const editado = simular(mesa, 200, 1, com('contratos.pontosPorCereal', 2))
    const antes = taxaVitoria(padrao.porEstrategia.entregador!)
    const depois = taxaVitoria(editado.porEstrategia.entregador!)
    expect(depois).toBeLessThan(antes)
    expect(editado.porEstrategia.entregador!.placar.contratos).toBeLessThan(padrao.porEstrategia.entregador!.placar.contratos)
  }, 60_000)
})
