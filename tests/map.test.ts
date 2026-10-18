import { describe, expect, it } from 'vitest'
import { regras } from '../src/engine/config'
import { distanciaACapital, obterMapa, paraCoord, paraPosicao } from '../src/engine/map'

const mapa = obterMapa()
const girar = (c: string) => {
  const p = paraPosicao(c)!
  return paraCoord(mapa.colunas - 1 - p.x, mapa.linhas - 1 - p.y)
}

describe('mapa', () => {
  it('converte notação de xadrez', () => {
    expect(paraPosicao('A1')).toEqual({ x: 0, y: 0 })
    expect(paraPosicao('H8')).toEqual({ x: 7, y: 7 })
    expect(paraCoord(2, 4)).toBe('C5')
    expect(mapa.casas).toHaveLength(64)
  })

  it('vizinhança só ortogonal', () => {
    expect([...mapa.vizinhos['A1']!].sort()).toEqual(['A2', 'B1'])
    expect([...mapa.vizinhos['D4']!].sort()).toEqual(['C4', 'D3', 'D5', 'E4'])
  })

  it('as duas margens têm 23 casas e são simétricas por rotação de 180°', () => {
    expect(mapa.casasDaMargem.oeste).toHaveLength(23)
    expect(mapa.casasDaMargem.leste).toHaveLength(23)
    expect(mapa.casasDaMargem.oeste.map(girar).sort()).toEqual([...mapa.casasDaMargem.leste].sort())
  })

  it('a várzea tem 14 casas e nenhuma casa é várzea e rocha ao mesmo tempo', () => {
    expect(mapa.casas.filter((c) => mapa.terreno[c] === 'varzea')).toHaveLength(14)
    for (const c of regras.mapa.rochas) expect(regras.mapa.varzea).not.toContain(c)
    expect(mapa.casas.filter((c) => mapa.terreno[c] === 'rocha')).toHaveLength(regras.mapa.rochas.length)
  })

  it('Capital e várzea não pertencem a margem; toda outra casa pertence', () => {
    for (const c of mapa.casas) {
      const t = mapa.terreno[c]
      if (t === 'capital' || t === 'varzea') expect(mapa.margem[c]).toBeNull()
      else expect(mapa.margem[c]).not.toBeNull()
    }
  })

  it('distância à Capital', () => {
    expect(distanciaACapital('C4')).toBe(1)
    expect(distanciaACapital('A1')).toBe(6)
  })
})
