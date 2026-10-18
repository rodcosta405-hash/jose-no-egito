// Reproduzir uma partida exportada, passo a passo, só para ver.
import { useState, type ChangeEvent } from 'react'
import { reproduzir } from '../engine'
import type { Reproducao } from '../engine'
import { Cabecalho, Historico, Marca, OutrosJogadores } from './Paineis'
import type { Tempos } from './registro'
import { FimDeJogo } from './Resultados'
import { Tabuleiro } from './Tabuleiro'

const nenhuma = new Set<string>()

export function TelaReproducao({ aoVoltar }: { aoVoltar: () => void }) {
  const [rep, setRep] = useState<Reproducao | null>(null)
  const [i, setI] = useState(0)
  const [erro, setErro] = useState<string | null>(null)

  const carregarArquivo = async (ev: ChangeEvent<HTMLInputElement>) => {
    const arquivo = ev.target.files?.[0]
    if (!arquivo) return
    let dados: unknown
    try {
      dados = JSON.parse(await arquivo.text())
    } catch {
      setRep(null)
      return setErro('O arquivo não é um JSON válido')
    }
    const r = reproduzir(dados)
    if (!r.reproducao) {
      setRep(null)
      return setErro(r.erro)
    }
    setErro(null)
    setRep(r.reproducao)
    setI(0)
  }

  if (!rep) {
    return (
      <main className="nova-partida">
        <h1>Reproduzir partida</h1>
        <p>Escolha um arquivo exportado (JSON). A partida é refeita ação por ação com as regras guardadas no arquivo.</p>
        <label className="campo">
          Arquivo{' '}
          <input type="file" accept="application/json,.json" onChange={carregarArquivo} />
        </label>
        {erro && <p className="erro" style={{ whiteSpace: 'pre-line' }}>{erro}</p>}
        <button className="botao" onClick={aoVoltar}>
          Voltar
        </button>
      </main>
    )
  }

  const { estados, dados } = rep
  const ultimo = estados.length - 1
  const e = estados[i]!
  const anterior = i > 0 ? estados[i - 1]! : null
  const novidades = anterior ? e.log.slice(anterior.log.length) : []
  const acaoAtual = i > 0 ? dados.acoes[i - 1] : undefined
  const tempos = (dados.extra?.tempos ?? {}) as Tempos
  const ir = (k: number) => setI(Math.max(0, Math.min(ultimo, k)))

  return (
    <div className="mesa">
      <div className="barra-vez">
        <strong>
          Reprodução · semente {e.semente} · regras {dados.versaoRegras}
        </strong>
        <button className="botao secundario" onClick={aoVoltar}>
          Fechar
        </button>
      </div>
      <Cabecalho estado={e} />
      <div className="controles-reproducao">
        <button className="botao" onClick={() => ir(0)} aria-label="Início">
          ⏮
        </button>
        <button className="botao" onClick={() => ir(i - 1)} aria-label="Ação anterior">
          ◀
        </button>
        <span className="contador">
          Ação {i} de {ultimo}
        </span>
        <button className="botao" onClick={() => ir(i + 1)} aria-label="Próxima ação">
          ▶
        </button>
        <button className="botao" onClick={() => ir(ultimo)} aria-label="Fim">
          ⏭
        </button>
        <input type="range" min={0} max={ultimo} value={i} onChange={(ev) => ir(Number(ev.target.value))} aria-label="Ir para a ação" />
      </div>
      <ul className="novidades" aria-live="polite">
        {novidades.length === 0 && acaoAtual && (
          <li>
            <Marca jogador={acaoAtual.jogador} /> {e.jogadores[acaoAtual.jogador]?.nome}{' '}
            {acaoAtual.acao.tipo === 'alocar' ? `alocou ${acaoAtual.acao.casas.length} trabalhadores` : `fez: ${acaoAtual.acao.tipo}`}
          </li>
        )}
        {i === 0 && <li>Partida criada. Avance para ver as ações.</li>}
        {novidades.map((l, k) => (
          <li key={k}>
            {l.jogador !== null && <Marca jogador={l.jogador} />} {l.texto}
          </li>
        ))}
      </ul>
      <div className="corpo">
        <div className="col-principal">
          <Tabuleiro estado={e} destacadas={nenhuma} />
        </div>
        <aside className="col-lateral">
          <OutrosJogadores estado={e} exceto={-1} titulo="Jogadores" />
          <Historico estado={e} />
        </aside>
      </div>
      {e.fase === 'fim' && <FimDeJogo estado={e} tempos={tempos} titulo="Resultado" comJson={false} />}
    </div>
  )
}
