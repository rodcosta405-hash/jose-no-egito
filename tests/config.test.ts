import { describe, expect, it } from 'vitest'
import regrasBrutas from '../config/regras.json'
import { ErroDeConfiguracao, regras, validarRegras } from '../src/engine/config'

const copia = (): Record<string, any> => structuredClone(regrasBrutas)

describe('config/regras.json', () => {
  it('o arquivo do repositório é válido', () => {
    expect(regras.versao).toBe(regrasBrutas.versao)
    expect(() => validarRegras(copia())).not.toThrow()
  })

  it('campo removido gera erro legível com o caminho', () => {
    const r = copia()
    delete r.edificios.mercado.produzOuro
    expect(() => validarRegras(r)).toThrow(ErroDeConfiguracao)
    expect(() => validarRegras(r)).toThrow('campo obrigatório ausente: "edificios.mercado.produzOuro"')
  })

  it('seção inteira removida é apontada', () => {
    const r = copia()
    delete r.contratos
    expect(() => validarRegras(r)).toThrow('"contratos.pontosPorCereal"')
  })

  it('lista todos os problemas de uma vez', () => {
    const r = copia()
    delete r.acoesPorAno
    r.precoCereal.inicio = 'quatro'
    try {
      validarRegras(r)
      expect.unreachable()
    } catch (e) {
      const erro = e as ErroDeConfiguracao
      expect(erro.problemas).toHaveLength(2)
      expect(erro.message).toContain('"acoesPorAno"')
      expect(erro.message).toContain('"precoCereal.inicio" deveria ser um número inteiro, mas é o texto "quatro"')
    }
  })

  it('recusa casa fora do mapa', () => {
    const r = copia()
    r.mapa.varzea.push('J9')
    expect(() => validarRegras(r)).toThrow('casa "J9" fora do mapa 8×8')
  })

  it('recusa preço inicial fora da trilha', () => {
    const r = copia()
    r.precoCereal.inicio = 11
    expect(() => validarRegras(r)).toThrow('"precoCereal.inicio" (11) está fora da trilha 1–10')
  })

  it('recusa baralho menor que o número de cartas sorteadas', () => {
    const r = copia()
    r.cartas.magras = [0, 1]
    expect(() => validarRegras(r)).toThrow('"cartas.magras" tem 2 cartas')
  })

  it('recusa casa que é várzea e rocha ao mesmo tempo', () => {
    const r = copia()
    r.mapa.rochas.push('C5')
    expect(() => validarRegras(r)).toThrow('casa "C5" aparece em "mapa.varzea" e em "mapa.rochas"')
  })

  it('recusa montagem que não bate com os edifícios iniciais', () => {
    const r = copia()
    r.montagem.segundaVolta = ['campo']
    expect(() => validarRegras(r)).toThrow('devem ter exatamente os edifícios de "inicial.edificios"')
  })

  it('recusa critério de desempate desconhecido', () => {
    const r = copia()
    r.desempate = ['sorte']
    expect(() => validarRegras(r)).toThrow('critério desconhecido "sorte"')
  })

  it('recusa recurso desconhecido em custo', () => {
    const r = copia()
    r.edificios.campo.custo = { ouro: 2, madeira: 1 }
    expect(() => validarRegras(r)).toThrow('recurso desconhecido')
  })
})
