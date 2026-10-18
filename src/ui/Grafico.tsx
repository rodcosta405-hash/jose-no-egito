// Pontos acumulados ano a ano, uma linha por jogador (fim de jogo).
import { useState } from 'react'
import type { GameState } from '../engine'
import { identidade } from './apresentacao'
import { linhasRegistro, type Tempos } from './registro'

const LARG = 640
const ALT = 300
const ESQ = 40
const DIR = 110 // espaço para os rótulos diretos no fim das linhas
const TOPO = 12
const BASE = 28

const formas = ['circulo', 'quadrado', 'triangulo', 'losango'] as const

function Marcador({ x, y, jogador }: { x: number; y: number; jogador: number }) {
  const cor = identidade(jogador).cor
  const forma = formas[jogador % formas.length]
  const props = { fill: cor, stroke: '#fcfcfb', strokeWidth: 2 }
  if (forma === 'quadrado') return <rect x={x - 4.5} y={y - 4.5} width={9} height={9} {...props} />
  if (forma === 'triangulo') return <path d={`M${x} ${y - 6} L${x + 5.5} ${y + 4} L${x - 5.5} ${y + 4} Z`} {...props} />
  if (forma === 'losango') return <path d={`M${x} ${y - 6} L${x + 6} ${y} L${x} ${y + 6} L${x - 6} ${y} Z`} {...props} />
  return <circle cx={x} cy={y} r={4.5} {...props} />
}

export function GraficoPontos({ estado, tempos }: { estado: GameState; tempos: Tempos }) {
  const linhas = linhasRegistro(estado, tempos)
  const [foco, setFoco] = useState<number | null>(null)
  if (linhas.length === 0) return null

  const valores = linhas.flatMap((l) => l.pontos.map((p) => p.acumulado))
  const min = Math.min(0, ...valores)
  const max = Math.max(10, ...valores)
  const passo = max - min > 100 ? 50 : max - min > 40 ? 20 : 10
  const yMin = Math.floor(min / passo) * passo
  const yMax = Math.ceil(max / passo) * passo
  const larguraUtil = LARG - ESQ - DIR
  const x = (i: number) => ESQ + (linhas.length === 1 ? larguraUtil / 2 : (i * larguraUtil) / (linhas.length - 1))
  const y = (v: number) => TOPO + ((yMax - v) * (ALT - TOPO - BASE)) / (yMax - yMin)
  const marcas = Array.from({ length: Math.round((yMax - yMin) / passo) + 1 }, (_, i) => yMin + i * passo)

  // Rótulos diretos no fim, afastados para não se sobreporem.
  const ultima = linhas[linhas.length - 1]!
  const rotulos = estado.jogadores
    .map((p, i) => ({ jogador: p.id, nome: p.nome, valor: ultima.pontos[i]!.acumulado, y: y(ultima.pontos[i]!.acumulado) }))
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < rotulos.length; i++) {
    const anterior = rotulos[i - 1]!
    if (rotulos[i]!.y - anterior.y < 15) rotulos[i]!.y = anterior.y + 15
  }

  const linhaFoco = foco === null ? null : linhas[foco]

  return (
    <figure className="grafico">
      <figcaption>Pontos acumulados ano a ano</figcaption>
      <ul className="legenda">
        {estado.jogadores.map((p) => (
          <li key={p.id}>
            <svg width="16" height="16" aria-hidden="true">
              <Marcador x={8} y={8} jogador={p.id} />
            </svg>
            {p.nome}
          </li>
        ))}
      </ul>
      <div className="grafico-area">
        <svg viewBox={`0 0 ${LARG} ${ALT}`} role="img" aria-label="Gráfico de pontos acumulados por ano" onMouseLeave={() => setFoco(null)}>
          {marcas.map((v) => (
            <g key={v}>
              <line x1={ESQ} x2={LARG - DIR} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#9a9890' : '#e6e4dc'} strokeWidth="1" />
              <text x={ESQ - 6} y={y(v) + 4} textAnchor="end" className="g-eixo">
                {v}
              </text>
            </g>
          ))}
          {linhas.map((l, i) => (
            <text key={i} x={x(i)} y={ALT - 8} textAnchor="middle" className="g-eixo">
              {l.ano}
            </text>
          ))}
          {foco !== null && <line x1={x(foco)} x2={x(foco)} y1={TOPO} y2={ALT - BASE} stroke="#52514e" strokeWidth="1" strokeDasharray="3 3" />}
          {estado.jogadores.map((p, j) => (
            <polyline
              key={p.id}
              fill="none"
              stroke={identidade(p.id).cor}
              strokeWidth="2"
              strokeLinejoin="round"
              points={linhas.map((l, i) => `${x(i)},${y(l.pontos[j]!.acumulado)}`).join(' ')}
            />
          ))}
          {estado.jogadores.map((p, j) =>
            linhas.map((l, i) =>
              foco === i || i === linhas.length - 1 ? <Marcador key={`${p.id}-${i}`} x={x(i)} y={y(l.pontos[j]!.acumulado)} jogador={p.id} /> : null,
            ),
          )}
          {rotulos.map((r) => (
            <text key={r.jogador} x={LARG - DIR + 10} y={r.y + 4} className="g-rotulo">
              {r.nome}: {r.valor}
            </text>
          ))}
          {/* Faixas de toque por ano, maiores que as marcas. */}
          {linhas.map((_, i) => {
            const meio = (linhas.length === 1 ? larguraUtil : larguraUtil / (linhas.length - 1)) / 2
            return (
              <rect
                key={`h${i}`}
                x={x(i) - meio}
                y={TOPO}
                width={meio * 2}
                height={ALT - TOPO - BASE}
                fill="transparent"
                onMouseEnter={() => setFoco(i)}
                onClick={() => setFoco(i)}
              />
            )
          })}
        </svg>
        {linhaFoco && foco !== null && (
          <div className="g-dica" style={{ left: `${(x(foco) / LARG) * 100}%` }} role="status">
            <strong>{linhaFoco.ano === 'Fim' ? 'Fim (PV e sobras)' : `Ano ${linhaFoco.ano}`}</strong>
            {estado.jogadores
              .map((p, j) => ({ p, v: linhaFoco.pontos[j]! }))
              .sort((a, b) => b.v.acumulado - a.v.acumulado)
              .map(({ p, v }) => (
                <span key={p.id}>
                  <svg width="12" height="12" aria-hidden="true">
                    <Marcador x={6} y={6} jogador={p.id} />
                  </svg>{' '}
                  {p.nome}: {v.acumulado} ({v.noAno >= 0 ? '+' : ''}
                  {v.noAno})
                </span>
              ))}
          </div>
        )}
      </div>
      <details>
        <summary>Ver em tabela</summary>
        <div className="tabela-rolavel">
          <table>
            <thead>
              <tr>
                <th>Ano</th>
                {estado.jogadores.map((p) => (
                  <th key={p.id}>{p.nome}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={String(l.ano)}>
                  <td>{l.ano}</td>
                  {l.pontos.map((v, j) => (
                    <td key={j}>
                      {v.acumulado} ({v.noAno >= 0 ? '+' : ''}
                      {v.noAno})
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
