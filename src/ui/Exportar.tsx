import { useState } from 'react'
import { exportarPartida } from '../engine'
import type { GameState } from '../engine'
import { gerarCsv, type Tempos } from './registro'

export function baixarArquivo(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const prefixo = (e: GameState) => `jose-no-egito-semente-${e.semente}-ano-${e.ano}`

export function BotoesExportar({ estado, tempos, comJson = true }: { estado: GameState; tempos: Tempos; comJson?: boolean }) {
  const [erro, setErro] = useState<string | null>(null)
  const json = () => {
    try {
      const dados = { ...exportarPartida(estado, undefined, { tempos }), exportadaEm: new Date().toISOString() }
      baixarArquivo(`${prefixo(estado)}.json`, JSON.stringify(dados, null, 1), 'application/json')
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  const csv = () => baixarArquivo(`${prefixo(estado)}-registro.csv`, gerarCsv(estado, tempos), 'text/csv;charset=utf-8')
  return (
    <>
      {comJson && (
        <button className="botao" onClick={json}>
          Exportar partida (JSON)
        </button>
      )}
      <button className="botao" onClick={csv} disabled={estado.resumos.length === 0} title={estado.resumos.length === 0 ? 'Nenhum ano terminou ainda' : undefined}>
        Registro de playtest (CSV)
      </button>
      {erro && <span className="erro">{erro}</span>}
    </>
  )
}
