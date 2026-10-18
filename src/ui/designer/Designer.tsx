// Modo designer: edita os números de regras.json em memória, simula com bots e exporta.
import { useEffect, useMemo, useRef, useState } from 'react'
import { estrategiaPorId, estrategias } from '../../bots'
import { media, taxaVitoria, type Agregado, type ResultadoSimulacao } from '../../bots/simulacao'
import { regras as regrasPadrao } from '../../engine'
import type { Placar, Regras } from '../../engine'
import { baixarArquivo } from '../Exportar'
import { alterados, comValor, ler, lerLista, listarCampos, nomeDoGrupo, verificar, type Campo } from './campos'
import type { PedidoSimulacao, RespostaSimulacao } from './simWorker'

const CHAVE = 'jose-no-egito:designer:v1'

function carregarRascunho(): unknown {
  try {
    const bruto = window.localStorage.getItem(CHAVE)
    return bruto ? JSON.parse(bruto) : structuredClone(regrasPadrao)
  } catch {
    return structuredClone(regrasPadrao)
  }
}

export function Designer({ aoVoltar, aoJogar }: { aoVoltar: () => void; aoJogar: (r: Regras) => void }) {
  const [rascunho, setRascunho] = useState<unknown>(carregarRascunho)
  const [invalidos, setInvalidos] = useState<Record<string, string>>({})
  const [jsonBruto, setJsonBruto] = useState<string | null>(null)
  const [erroJson, setErroJson] = useState<string | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(rascunho))
    } catch {
      // sem armazenamento: o rascunho vive só nesta aba
    }
  }, [rascunho])

  const verificacao = useMemo(() => verificar(rascunho), [rascunho])
  const mudados = useMemo(() => new Set(alterados(rascunho, regrasPadrao)), [rascunho])
  const grupos = useMemo(() => {
    const m = new Map<string, Campo[]>()
    for (const c of listarCampos(regrasPadrao)) m.set(c.grupo, [...(m.get(c.grupo) ?? []), c])
    return [...m.entries()]
  }, [])
  const valido = verificacao.regras !== null && Object.keys(invalidos).length === 0

  const definir = (caminho: string, valor: unknown) => {
    setRascunho((r: unknown) => comValor(r, caminho, valor))
    setInvalidos(({ [caminho]: _, ...resto }) => resto)
  }
  const marcarInvalido = (caminho: string, texto: string) => setInvalidos((x) => ({ ...x, [caminho]: texto }))

  const exportar = () => {
    if (!verificacao.regras) return
    baixarArquivo('regras.json', JSON.stringify(verificacao.regras, null, 2) + '\n', 'application/json')
  }

  return (
    <main className="designer">
      <div className="barra-vez">
        <strong>Modo designer</strong>
        <button className="botao secundario" onClick={aoVoltar}>
          Voltar
        </button>
      </div>
      <p className="dica">
        Mude os números, simule com os bots e compare com as regras padrão. Nada é gravado em <code>config/regras.json</code>: exporte o arquivo
        e substitua-o no projeto quando quiser adotar a mudança.
      </p>

      <section className={`verificacao ${valido ? 'ok' : 'falha'}`} aria-live="polite">
        {valido ? (
          <p>
            <strong>Regras válidas.</strong> {mudados.size === 0 ? 'Iguais às padrão.' : `${mudados.size} número(s) diferente(s) do padrão.`}
          </p>
        ) : (
          <>
            <p>
              <strong>Regras inválidas</strong> — corrija antes de simular, jogar ou exportar:
            </p>
            <ul>
              {Object.entries(invalidos).map(([c, t]) => (
                <li key={c}>
                  "{c}": "{t}" não é um valor válido
                </li>
              ))}
              {verificacao.erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </>
        )}
        <label className="campo">
          Nome desta versão das regras{' '}
          <input
            value={String(ler(rascunho, 'versao') ?? '')}
            onChange={(e) => setRascunho((r: unknown) => comValor(r, 'versao', e.target.value))}
            style={{ minWidth: 240 }}
          />
        </label>
        {mudados.size > 0 && ler(rascunho, 'versao') === regrasPadrao.versao && (
          <p className="dica">Aviso: dê um nome novo à versão para distinguir estas regras das padrão nos arquivos exportados e nas partidas.</p>
        )}
        {verificacao.avisos.map((a) => (
          <p key={a} className="dica">
            Aviso: {a}
          </p>
        ))}
        <div className="botoes">
          <button className="botao primario" aria-disabled={!valido} onClick={() => valido && verificacao.regras && aoJogar(verificacao.regras)}>
            Começar partida com estas regras
          </button>
          <button className="botao" aria-disabled={!valido} onClick={() => valido && exportar()}>
            Exportar regras.json
          </button>
          <button
            className="botao secundario"
            onClick={() => {
              if (window.confirm('Descartar todas as mudanças e voltar às regras padrão?')) {
                setRascunho(structuredClone(regrasPadrao))
                setInvalidos({})
              }
            }}
          >
            Voltar ao padrão
          </button>
        </div>
      </section>

      <Simulacao regras={valido ? verificacao.regras : null} />

      <section>
        <h2>Números</h2>
        <div className="grupos">
          {grupos.map(([grupo, campos]) => (
            <fieldset key={grupo} className={campos.some((c) => mudados.has(c.caminho)) ? 'grupo mudado' : 'grupo'}>
              <legend>{nomeDoGrupo(grupo)}</legend>
              {campos.map((c) => (
                <CampoEditavel
                  key={c.caminho}
                  campo={c}
                  valor={ler(rascunho, c.caminho)}
                  padrao={ler(regrasPadrao, c.caminho)}
                  mudado={mudados.has(c.caminho)}
                  invalido={c.caminho in invalidos}
                  definir={definir}
                  marcarInvalido={marcarInvalido}
                />
              ))}
            </fieldset>
          ))}
        </div>
      </section>

      <section>
        <h2>JSON completo</h2>
        <p className="dica">Para o que não é número: mapa, nomes, ordem do desempate.</p>
        {jsonBruto === null ? (
          <button className="botao" onClick={() => setJsonBruto(JSON.stringify(rascunho, null, 2))}>
            Editar JSON
          </button>
        ) : (
          <>
            <textarea className="json" value={jsonBruto} onChange={(e) => setJsonBruto(e.target.value)} spellCheck={false} aria-label="JSON das regras" />
            {erroJson && <p className="erro">{erroJson}</p>}
            <div className="botoes">
              <button
                className="botao primario"
                onClick={() => {
                  try {
                    setRascunho(JSON.parse(jsonBruto))
                    setInvalidos({})
                    setErroJson(null)
                    setJsonBruto(null)
                  } catch (e) {
                    setErroJson(`JSON mal formado: ${(e as Error).message}`)
                  }
                }}
              >
                Aplicar JSON
              </button>
              <button className="botao secundario" onClick={() => setJsonBruto(null)}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

function rotulo(c: Campo): string {
  const partes = c.caminho.split('.')
  const resto = partes.slice(c.grupo.split('.').length)
  return resto.length > 0 ? resto.join(' › ') : partes[partes.length - 1]!
}

function CampoEditavel({
  campo,
  valor,
  padrao,
  mudado,
  invalido,
  definir,
  marcarInvalido,
}: {
  campo: Campo
  valor: unknown
  padrao: unknown
  mudado: boolean
  invalido: boolean
  definir: (caminho: string, valor: unknown) => void
  marcarInvalido: (caminho: string, texto: string) => void
}) {
  const [texto, setTexto] = useState<string | null>(null)
  const mostrado = texto ?? (Array.isArray(valor) ? valor.join(', ') : String(valor ?? ''))
  const dicaPadrao = mudado ? <small className="padrao">padrão: {Array.isArray(padrao) ? padrao.join(', ') : String(padrao)}</small> : null

  if (campo.tipo === 'booleano') {
    return (
      <label className={`campo-designer ${mudado ? 'mudado' : ''}`}>
        <input type="checkbox" checked={valor === true} onChange={(e) => definir(campo.caminho, e.target.checked)} /> {rotulo(campo)}
        {dicaPadrao}
      </label>
    )
  }
  return (
    <label className={`campo-designer ${mudado ? 'mudado' : ''} ${invalido ? 'invalido' : ''}`}>
      <span>{rotulo(campo)}</span>
      <input
        inputMode={campo.tipo === 'numero' ? 'decimal' : 'text'}
        value={mostrado}
        onChange={(e) => {
          const t = e.target.value
          setTexto(t)
          if (campo.tipo === 'numero') {
            const n = Number(t.replace(',', '.'))
            if (t.trim() === '' || !Number.isFinite(n)) marcarInvalido(campo.caminho, t)
            else definir(campo.caminho, n)
          } else {
            const lista = lerLista(t)
            if (!lista) marcarInvalido(campo.caminho, t)
            else definir(campo.caminho, lista)
          }
        }}
        onBlur={() => !invalido && setTexto(null)}
        aria-invalid={invalido}
      />
      {dicaPadrao}
    </label>
  )
}

// ---------- simulação comparativa ----------

const VAZIO = ''
const metricas: [string, (a: Agregado) => number, 'pct' | 'num'][] = [
  ['Vitórias', taxaVitoria, 'pct'],
  ['Pontos', media, 'num'],
  ...(
    [
      ['Alimentação', 'alimentacao'],
      ['Fome', 'fome'],
      ['Contratos', 'contratos'],
      ['PV impressos', 'impressos'],
      ['Sobras', 'sobras'],
    ] as [string, keyof Placar][]
  ).map(([nome, k]) => [nome, (a: Agregado) => a.placar[k] / a.jogos, 'num'] as [string, (a: Agregado) => number, 'pct' | 'num']),
]

function Simulacao({ regras }: { regras: Regras | null }) {
  const [mesa, setMesa] = useState<string[]>(['populoso', 'entregador', 'populoso', 'entregador'])
  const [partidas, setPartidas] = useState(200)
  const [semente, setSemente] = useState(1)
  const [progresso, setProgresso] = useState<{ feitas: number; total: number } | null>(null)
  const [resultado, setResultado] = useState<{ padrao: ResultadoSimulacao; editado: ResultadoSimulacao } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const worker = useRef<Worker | null>(null)

  useEffect(() => () => worker.current?.terminate(), [])

  const ocupadas = mesa.filter((m) => m !== VAZIO)
  const r = regras ?? regrasPadrao
  const motivo = !regras
    ? 'Corrija as regras antes de simular'
    : ocupadas.length < r.jogadores.minimo || ocupadas.length > r.jogadores.maximo
      ? `Escolha de ${r.jogadores.minimo} a ${r.jogadores.maximo} bots`
      : null

  const rodar = () => {
    if (motivo || !regras) return setErro(motivo)
    worker.current?.terminate()
    const w = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    setErro(null)
    setResultado(null)
    setProgresso({ feitas: 0, total: partidas * 2 })
    w.onmessage = (ev: MessageEvent<RespostaSimulacao>) => {
      const m = ev.data
      if (m.tipo === 'progresso') setProgresso({ feitas: m.feitas, total: m.total })
      else {
        setProgresso(null)
        if (m.tipo === 'resultado') setResultado({ padrao: m.padrao, editado: m.editado })
        else setErro(m.mensagem)
        w.terminate()
      }
    }
    const pedido: PedidoSimulacao = { mesa: ocupadas, partidas, semente, regrasEditadas: regras }
    w.postMessage(pedido)
  }

  const fmt = (v: number, tipo: 'pct' | 'num') => (tipo === 'pct' ? `${(100 * v).toFixed(1)}%` : v.toFixed(1))
  const delta = (v: number, tipo: 'pct' | 'num') => {
    const t = tipo === 'pct' ? `${(100 * v).toFixed(1)} p.p.` : v.toFixed(1)
    return v > 0 ? `+${t}` : t
  }

  return (
    <section className="simulacao">
      <h2>Simular partidas só com bots</h2>
      <p className="dica">
        Roda as mesmas sementes com as regras padrão e com as suas. Os bots usam os parâmetros treinados nas regras originais: o resultado mostra
        como <em>esses</em> bots reagem à mudança, não como jogariam o ideal nas regras novas.
      </p>
      <div className="mesa-sim">
        {mesa.map((m, i) => (
          <select
            key={i}
            aria-label={`Bot ${i + 1}`}
            value={m}
            onChange={(e) => setMesa((x) => x.map((v, k) => (k === i ? e.target.value : v)))}
          >
            <option value={VAZIO}>(vazio)</option>
            {estrategias.map((est) => (
              <option key={est.id} value={est.id}>
                {est.nome}
              </option>
            ))}
          </select>
        ))}
        <label>
          Partidas{' '}
          <input
            inputMode="numeric"
            value={partidas}
            onChange={(e) => setPartidas(Math.max(1, Math.min(5000, Math.trunc(Number(e.target.value)) || 1)))}
            style={{ width: 90 }}
          />
        </label>
        <label>
          Semente{' '}
          <input inputMode="numeric" value={semente} onChange={(e) => setSemente(Math.trunc(Number(e.target.value)) || 0)} style={{ width: 90 }} />
        </label>
      </div>
      <button className="botao primario" aria-disabled={motivo !== null || progresso !== null} onClick={() => progresso === null && rodar()}>
        {progresso ? 'Simulando…' : `Simular ${partidas} partidas`}
      </button>
      {progresso && (
        <div className="progresso" role="progressbar" aria-valuemin={0} aria-valuemax={progresso.total} aria-valuenow={progresso.feitas}>
          <div style={{ width: `${(100 * progresso.feitas) / progresso.total}%` }} />
          <span>
            {progresso.feitas} de {progresso.total} partidas ({progresso.feitas <= progresso.total / 2 ? 'regras padrão' : 'suas regras'})
          </span>
        </div>
      )}
      {(erro ?? (motivo && regras ? motivo : null)) && <p className="erro">{erro ?? motivo}</p>}
      {resultado && (
        <div className="tabela-rolavel">
          <table className="comparacao">
            <thead>
              <tr>
                <th>Estratégia</th>
                {metricas.map(([nome]) => (
                  <th key={nome}>{nome}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(resultado.padrao.porEstrategia).map((id) => {
                const a = resultado.padrao.porEstrategia[id]!
                const b = resultado.editado.porEstrategia[id]!
                return (
                  <tr key={id}>
                    <td>{estrategiaPorId(id).nome}</td>
                    {metricas.map(([nome, f, tipo]) => (
                      <td key={nome}>
                        {fmt(f(a), tipo)} → <strong>{fmt(f(b), tipo)}</strong>
                        <br />
                        <small>({delta(f(b) - f(a), tipo)})</small>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="dica">
            Padrão → suas regras. Pontos médios de todos: {resultado.padrao.pontosMedios.toFixed(1)} → {resultado.editado.pontosMedios.toFixed(1)}.
          </p>
        </div>
      )}
    </section>
  )
}
