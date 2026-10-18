import { describe, expect, it } from 'vitest'
import { embaralhar, iniciarRng, inteiro, proximo } from '../src/engine/rng'

describe('rng', () => {
  it('mesma semente gera a mesma sequência', () => {
    const seq = (s: number) => {
      let e = iniciarRng(s)
      const out: number[] = []
      for (let i = 0; i < 5; i++) {
        let x: number
        ;[x, e] = proximo(e)
        out.push(x)
      }
      return out
    }
    expect(seq(42)).toEqual(seq(42))
    expect(seq(42)).not.toEqual(seq(43))
  })

  it('valores ficam nos intervalos', () => {
    let e = iniciarRng(7)
    for (let i = 0; i < 1000; i++) {
      let x: number
      ;[x, e] = inteiro(6, e)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(6)
    }
  })

  it('embaralhar não altera a lista original e mantém os elementos', () => {
    const lista = [1, 2, 3, 4, 5, 6]
    const [copia] = embaralhar(lista, iniciarRng(1))
    expect(lista).toEqual([1, 2, 3, 4, 5, 6])
    expect([...copia].sort()).toEqual(lista)
  })
})
