import { describe, expect, it } from 'vitest'
import { jogarPartidaDeBots } from '../src/bots/simulacao'
import { exportarPartida, novaPartida, regras, reproduzir, validarRegras } from '../src/engine'
import type { GameState } from '../src/engine'

/** Ida e volta pelo texto, como num arquivo baixado e carregado de novo. */
const viaArquivo = (x: unknown) => JSON.parse(JSON.stringify(x)) as unknown

describe('exportar e reproduzir', () => {
  it('reproduzir o JSON exportado chega exatamente à mesma partida', () => {
    for (const semente of [1, 2, 3]) {
      const final = jogarPartidaDeBots(['populoso', 'entregador', 'entregador_cauteloso', 'populoso'], semente)
      const r = reproduzir(viaArquivo(exportarPartida(final)))
      expect(r.erro).toBeUndefined()
      const estados = r.reproducao!.estados
      expect(estados).toHaveLength(final.acoes.length + 1)
      expect(estados[estados.length - 1]).toEqual(final)
    }
  })

  it('as regras exportadas são as usadas, mesmo que diferentes das padrão', () => {
    const r2 = validarRegras({ ...structuredClone(regras), versao: 'teste', contratos: { ...regras.contratos, pontosPorCereal: 2 } })
    const final = jogarPartidaDeBots(['entregador', 'entregador'], 9, r2)
    const dados = exportarPartida(final, r2)
    expect(dados.versaoRegras).toBe('teste')
    const r = reproduzir(viaArquivo(dados))
    expect(r.reproducao!.regras.contratos.pontosPorCereal).toBe(2)
    expect(r.reproducao!.estados.at(-1)).toEqual(final)
  })

  it('reproduz partida em andamento e guarda dados extras', () => {
    let e: GameState = novaPartida({ jogadores: [{ nome: 'A', tipo: 'humano' }, { nome: 'B', tipo: 'humano' }], margens: 'sorteio', semente: 4 }).estado!
    const dados = exportarPartida(e, regras, { tempos: { 1: 1000 } })
    expect(dados.extra).toEqual({ tempos: { 1: 1000 } })
    e = reproduzir(viaArquivo(dados)).reproducao!.estados[0]!
    expect(e.fase).toBe('montagem')
  })

  it('arquivos inválidos dão erro em português', () => {
    expect(reproduzir({ ola: 1 }).erro).toBe('Este arquivo não é uma partida de José no Egito')
    expect(reproduzir(null).erro).toBe('Este arquivo não é uma partida de José no Egito')
    const final = jogarPartidaDeBots(['populoso', 'entregador'], 5)
    const dados = viaArquivo(exportarPartida(final)) as Record<string, any>
    expect(reproduzir({ ...dados, versao: 99 }).erro).toBe('Versão de arquivo não suportada: 99')
    const semCampo = structuredClone(dados)
    delete semCampo.regras.acoesPorAno
    expect(reproduzir(semCampo).erro).toMatch(/^As regras guardadas no arquivo são inválidas/)
    const adulterado = structuredClone(dados)
    adulterado.acoes[0].acao.casa = 'D4'
    expect(reproduzir(adulterado).erro).toBe('A ação 1 foi recusada ao reproduzir: A Capital não recebe construções')
  })

  it('partida sem lista de ações não pode ser exportada', () => {
    const e = jogarPartidaDeBots(['populoso', 'entregador'], 6)
    const antiga = { ...e, acoes: undefined } as unknown as GameState
    expect(() => exportarPartida(antiga)).toThrow('não pode ser reproduzida')
  })
})
