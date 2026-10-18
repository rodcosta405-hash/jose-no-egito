import { useState } from 'react'
import { estrategias } from '../bots'
import { margensDoMapa, novaPartida, regras } from '../engine'
import type { ConfigJogador, GameState, Margem, TipoJogador } from '../engine'
import { RegrasRapidas } from './RegrasRapidas'

interface Vaga {
  nome: string
  tipo: TipoJogador
  estrategia: string
  margem: Margem
}

const nomePadrao = (i: number, tipo: TipoJogador) => (tipo === 'humano' ? `Jogador ${i + 1}` : `Bot ${i + 1}`)

export function NovaPartida({ aoComecar, salvaExiste, aoContinuar }: { aoComecar: (e: GameState) => void; salvaExiste: boolean; aoContinuar: () => void }) {
  const [n, setN] = useState(regras.jogadores.maximo)
  const [vagas, setVagas] = useState<Vaga[]>(
    Array.from({ length: regras.jogadores.maximo }, (_, i) => ({
      nome: nomePadrao(i, i === 0 ? 'humano' : 'bot'),
      tipo: i === 0 ? 'humano' : 'bot',
      estrategia: estrategias[i % estrategias.length]!.id,
      margem: margensDoMapa[i % margensDoMapa.length]!,
    })),
  )
  const [margens, setMargens] = useState<'sorteio' | 'escolha'>('sorteio')
  const [semente, setSemente] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [verRegras, setVerRegras] = useState(false)

  if (verRegras) return <RegrasRapidas aoVoltar={() => setVerRegras(false)} />

  const mudar = (i: number, parcial: Partial<Vaga>) =>
    setVagas((vs) =>
      vs.map((v, k) => {
        if (k !== i) return v
        const novo = { ...v, ...parcial }
        // Trocar humano/bot renomeia só se o nome ainda era o padrão.
        if (parcial.tipo && v.nome === nomePadrao(i, v.tipo)) novo.nome = nomePadrao(i, parcial.tipo)
        return novo
      }),
    )

  const comecar = () => {
    const usadas = vagas.slice(0, n)
    const jogadores: ConfigJogador[] = usadas.map((v, i) => ({
      nome: v.nome.trim() || nomePadrao(i, v.tipo),
      tipo: v.tipo,
      ...(v.tipo === 'bot' ? { estrategiaBot: v.estrategia } : {}),
    }))
    const s = semente.trim() === '' ? Math.floor(Math.random() * 1_000_000) : Number(semente)
    if (!Number.isInteger(s)) return setErro('A semente deve ser um número inteiro')
    const r = novaPartida({ jogadores, margens: margens === 'sorteio' ? 'sorteio' : usadas.map((v) => v.margem), semente: s })
    if (!r.estado) return setErro(r.erro)
    aoComecar(r.estado)
  }

  return (
    <main className="nova-partida">
      <h1>José no Egito</h1>
      <p className="subtitulo">Protótipo para playtest · passa e joga no mesmo aparelho</p>

      {salvaExiste && (
        <button className="botao primario largo" onClick={aoContinuar}>
          Continuar partida salva
        </button>
      )}

      <section>
        <h2>Nova partida</h2>
        <label className="campo">
          Número de jogadores{' '}
          <select value={n} onChange={(e) => setN(Number(e.target.value))}>
            {Array.from({ length: regras.jogadores.maximo - regras.jogadores.minimo + 1 }, (_, i) => regras.jogadores.minimo + i).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        {n !== regras.jogadores.maximo && <p className="dica">O jogo está calibrado para {regras.jogadores.maximo} jogadores.</p>}

        <fieldset className="campo">
          <legend>Margens</legend>
          <label>
            <input type="radio" checked={margens === 'sorteio'} onChange={() => setMargens('sorteio')} /> Sortear
          </label>
          <label>
            <input type="radio" checked={margens === 'escolha'} onChange={() => setMargens('escolha')} /> Escolher (no máximo{' '}
            {regras.mapa.jogadoresPorMargem} por margem)
          </label>
        </fieldset>

        <ol className="vagas">
          {vagas.slice(0, n).map((v, i) => (
            <li key={i}>
              <input aria-label={`Nome do jogador ${i + 1}`} value={v.nome} onChange={(e) => mudar(i, { nome: e.target.value })} />
              <select aria-label={`Tipo do jogador ${i + 1}`} value={v.tipo} onChange={(e) => mudar(i, { tipo: e.target.value as TipoJogador })}>
                <option value="humano">Humano</option>
                <option value="bot">Bot</option>
              </select>
              {v.tipo === 'bot' && (
                <select aria-label={`Estratégia do bot ${i + 1}`} value={v.estrategia} onChange={(e) => mudar(i, { estrategia: e.target.value })}>
                  {estrategias.map((est) => (
                    <option key={est.id} value={est.id} title={est.descricao}>
                      {est.nome}
                    </option>
                  ))}
                </select>
              )}
              {margens === 'escolha' && (
                <select aria-label={`Margem do jogador ${i + 1}`} value={v.margem} onChange={(e) => mudar(i, { margem: e.target.value as Margem })}>
                  {margensDoMapa.map((m) => (
                    <option key={m} value={m}>
                      Margem {m}
                    </option>
                  ))}
                </select>
              )}
            </li>
          ))}
        </ol>

        <label className="campo">
          Semente (opcional, para repetir uma partida){' '}
          <input inputMode="numeric" value={semente} onChange={(e) => setSemente(e.target.value)} placeholder="sorteada" />
        </label>

        {erro && <p className="erro">{erro}</p>}
        <div className="botoes">
          <button className="botao primario" onClick={comecar}>
            Começar
          </button>
          <button className="botao" onClick={() => setVerRegras(true)}>
            Regras rápidas
          </button>
        </div>
      </section>
    </main>
  )
}
