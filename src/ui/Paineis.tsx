import { useState } from 'react'
import {
  acoesRestantes,
  anoMagro,
  capacidadeCereal,
  conectadoACapital,
  pontuacao,
  trabalhadores,
} from '../engine'
import type { GameState, Placar } from '../engine'
import { identidade, nomeEdificio } from './apresentacao'

export function Marca({ jogador }: { jogador: number }) {
  const id = identidade(jogador)
  return (
    <span className={`marca marca-${id.padrao}`} style={{ background: id.cor }} aria-label={`jogador ${id.numero}, ${id.nomePadrao}`}>
      {id.numero}
    </span>
  )
}

export function Cabecalho({ estado }: { estado: GameState }) {
  const regras = estado.regras
  const magro = estado.ano > 0 && anoMagro(estado)
  const { minimo, maximo, ancoraGordos, ancoraMagros } = regras.precoCereal
  const cartasFase = magro ? regras.cartas.magras : regras.cartas.gordas
  const passos = Array.from({ length: maximo - minimo + 1 }, (_, i) => minimo + i)
  return (
    <header className={`cabecalho ${estado.fase === 'montagem' ? '' : magro ? 'fase-magra' : 'fase-gorda'}`}>
      <div className="cab-linha">
        <strong className="cab-ano">
          {estado.fase === 'montagem' ? 'Montagem' : `Ano ${estado.ano} de ${regras.anos.total}`}
        </strong>
        {estado.fase !== 'montagem' && <span className="cab-fase">{magro ? 'Anos magros (fome)' : 'Anos gordos'}</span>}
        {magro && (
          <span className="cab-demanda">
            José pede: <strong>{estado.demandaCapital}</strong> cereal
          </span>
        )}
      </div>
      <div className="cab-linha">
        <span className="cab-rotulo">Preço do cereal</span>
        <ol className="trilha" aria-label={`Preço do cereal: ${estado.preco}`}>
          {passos.map((v) => (
            <li key={v} className={v === estado.preco ? 'atual' : ''}>
              {v}
              {v === ancoraGordos && <small title="Âncora dos anos gordos">G</small>}
              {v === ancoraMagros && <small title="Âncora dos anos magros">M</small>}
            </li>
          ))}
        </ol>
      </div>
      {estado.fase !== 'montagem' && (
        <div className="cab-linha cab-cartas">
          <span>
            Cartas reveladas: {estado.cartasReveladas.length > 0 ? estado.cartasReveladas.join(' · ') : 'nenhuma'}
          </span>
          <span>
            Cartas desta fase: {Math.min(...cartasFase)} a {Math.max(...cartasFase)}
          </span>
        </div>
      )}
    </header>
  )
}

const fontes: [keyof Placar, string][] = [
  ['alimentacao', 'Alimentação'],
  ['fome', 'Fome'],
  ['contratos', 'Contratos'],
  ['impressos', 'PV impressos'],
  ['sobras', 'Sobras'],
]

export function PlacarPorFonte({ placar }: { placar: Placar }) {
  return (
    <dl className="placar">
      {fontes.map(([k, nome]) => (
        <div key={k}>
          <dt>{nome}</dt>
          <dd>{placar[k]}</dd>
        </div>
      ))}
    </dl>
  )
}

export function PainelJogador({ estado, jogador }: { estado: GameState; jogador: number }) {
  const p = estado.jogadores[jogador]
  if (!p) return null
  const w = trabalhadores(estado, jogador)
  return (
    <section className="painel" aria-label={`Painel de ${p.nome}`}>
      <h2>
        <Marca jogador={jogador} /> {p.nome} {p.tipo === 'bot' && <small>(bot)</small>}
        <span className="pontos">{pontuacao(p)} pts</span>
      </h2>
      <div className="recursos">
        <span>Ouro <strong>{p.ouro}</strong></span>
        <span>Pedra <strong>{p.pedra}</strong></span>
        <span>
          Cereal <strong>{p.cereal}</strong>/{capacidadeCereal(estado, jogador)}
        </span>
        <span>
          Trabalhadores <strong>{p.alocacao.length}</strong>/{w}
        </span>
      </div>
      <div className="linha-info">
        <span>Margem {p.margem}</span>
        <span>{conectadoACapital(estado, jogador) ? 'Conectado à Capital' : 'Sem conexão com a Capital'}</span>
        {estado.fase === 'acoes' && <span>Ações restantes no ano: {acoesRestantes(estado, jogador)}</span>}
        <span>Reserva: {p.reserva.length > 0 ? p.reserva.map(nomeEdificio).join(', ') : 'vazia'}</span>
      </div>
      <PlacarPorFonte placar={p.placar} />
    </section>
  )
}

export function OutrosJogadores({ estado, exceto, titulo = 'Outros jogadores' }: { estado: GameState; exceto: number; titulo?: string }) {
  return (
    <section className="outros" aria-label={titulo}>
      <h2>{titulo}</h2>
      <ul>
        {estado.jogadores
          .filter((p) => p.id !== exceto)
          .map((p) => (
            <li key={p.id}>
              <Marca jogador={p.id} /> <strong>{p.nome}</strong> {p.tipo === 'bot' && <small>(bot)</small>} — {pontuacao(p)} pts
              <div className="linha-info">
                <span>Ouro {p.ouro}</span>
                <span>Pedra {p.pedra}</span>
                <span>Cereal {p.cereal}/{capacidadeCereal(estado, p.id)}</span>
                <span>Trab. {trabalhadores(estado, p.id)}</span>
                <span>{conectadoACapital(estado, p.id) ? 'Capital ✓' : 'Capital ✗'}</span>
              </div>
            </li>
          ))}
      </ul>
    </section>
  )
}

export function Historico({ estado }: { estado: GameState }) {
  const [jogador, setJogador] = useState<string>('todos')
  const [ano, setAno] = useState<string>('atual')
  const anoFiltro = ano === 'atual' ? estado.ano : ano === 'todos' ? null : Number(ano)
  const linhas = estado.log
    .filter((l) => anoFiltro === null || l.ano === anoFiltro)
    .filter((l) => jogador === 'todos' || l.jogador === Number(jogador))
    .slice()
    .reverse()
  return (
    <section className="historico" aria-label="Histórico">
      <h2>Histórico</h2>
      <div className="filtros">
        <label>
          Ano{' '}
          <select value={ano} onChange={(e) => setAno(e.target.value)}>
            <option value="atual">Atual</option>
            <option value="todos">Todos</option>
            {Array.from({ length: estado.ano + 1 }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? 'Montagem' : `Ano ${i}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          Jogador{' '}
          <select value={jogador} onChange={(e) => setJogador(e.target.value)}>
            <option value="todos">Todos</option>
            {estado.jogadores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ol className="log">
        {linhas.length === 0 && <li className="vazio">Nada por aqui ainda.</li>}
        {linhas.map((l, i) => (
          <li key={i}>
            {l.jogador !== null && <Marca jogador={l.jogador} />} {l.texto}
          </li>
        ))}
      </ol>
    </section>
  )
}
