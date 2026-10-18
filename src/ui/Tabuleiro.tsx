import { obterMapa, paraPosicao } from '../engine'
import type { Coord, GameState } from '../engine'
import { identidade, nomeDoTile, sigla } from './apresentacao'

const L = 52 // lado da casa
const M = 18 // margem para as letras e números

interface Props {
  estado: GameState
  destacadas: ReadonlySet<Coord>
  /** Alocação em edição (jogador da vez na fase de alocação). */
  alocacaoEmEdicao?: { jogador: number; casas: readonly Coord[] }
  aoClicar?: (casa: Coord) => void
}

export function Tabuleiro({ estado, destacadas, alocacaoEmEdicao, aoClicar }: Props) {
  const mapa = obterMapa(estado.regras)
  const largura = mapa.colunas * L + M
  const altura = mapa.linhas * L + M
  const xy = (casa: Coord) => {
    const p = paraPosicao(casa)!
    return { x: M + p.x * L, y: (mapa.linhas - 1 - p.y) * L }
  }
  const trabalhando = (casa: Coord, dono: number) =>
    alocacaoEmEdicao && alocacaoEmEdicao.jogador === dono
      ? alocacaoEmEdicao.casas.includes(casa)
      : (estado.jogadores[dono]?.alocacao.includes(casa) ?? false)

  const capital = mapa.capital.map(xy)
  const cx = Math.min(...capital.map((c) => c.x))
  const cy = Math.min(...capital.map((c) => c.y))

  return (
    <svg
      className="tabuleiro"
      viewBox={`0 0 ${largura} ${altura}`}
      role="grid"
      aria-label="Tabuleiro"
    >
      <defs>
        <pattern id="t-varzea" width="12" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 4 Q3 1 6 4 T12 4" fill="none" stroke="#5b8fb9" strokeWidth="1" />
        </pattern>
        <pattern id="t-rocha" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#7a7a7a" strokeWidth="1.5" />
        </pattern>
        {estado.jogadores.map((p) => {
          const id = identidade(p.id)
          return (
            <pattern key={p.id} id={`j-${p.id}`} width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill={id.cor} />
              {id.padrao === 'listras' && <line x1="0" y1="8" x2="8" y2="0" stroke="#fff" strokeOpacity="0.45" strokeWidth="2" />}
              {id.padrao === 'pontos' && <circle cx="4" cy="4" r="1.6" fill="#fff" fillOpacity="0.5" />}
              {id.padrao === 'xadrez' && <rect width="4" height="4" fill="#fff" fillOpacity="0.3" />}
            </pattern>
          )
        })}
      </defs>

      {mapa.casas.map((casa) => {
        const { x, y } = xy(casa)
        const terreno = mapa.terreno[casa]
        if (terreno === 'capital') return null
        const fundo = terreno === 'varzea' ? '#d6e8f5' : terreno === 'rocha' ? '#d9d6cf' : '#f3ecd8'
        const textura = terreno === 'varzea' ? 'url(#t-varzea)' : terreno === 'rocha' ? 'url(#t-rocha)' : null
        return (
          <g key={casa}>
            <rect x={x} y={y} width={L} height={L} fill={fundo} stroke="#b9ae93" strokeWidth="1" />
            {textura && <rect x={x} y={y} width={L} height={L} fill={textura} opacity="0.6" />}
          </g>
        )
      })}

      <rect x={cx} y={cy} width={2 * L} height={2 * L} fill="#e8c860" stroke="#8a6d1d" strokeWidth="2" />
      <text x={cx + L} y={cy + L - 4} textAnchor="middle" className="t-capital">Capital</text>
      <text x={cx + L} y={cy + L + 12} textAnchor="middle" className="t-capital-sub">de José</text>

      {Object.entries(estado.demarcacoes).map(([casa, dono]) => {
        const { x, y } = xy(casa)
        const id = identidade(dono)
        return (
          <g key={`d-${casa}`} aria-label={`Demarcação do jogador ${id.numero} em ${casa}`}>
            <line x1={x + 10} y1={y + 8} x2={x + 10} y2={y + L - 8} stroke="#333" strokeWidth="2" />
            <path d={`M${x + 10} ${y + 8} L${x + 34} ${y + 15} L${x + 10} ${y + 22} Z`} fill={`url(#j-${dono})`} stroke="#222" />
            <text x={x + 38} y={y + L - 10} className="t-num">{id.numero}</text>
          </g>
        )
      })}

      {Object.entries(estado.tabuleiro).map(([casa, t]) => {
        const { x, y } = xy(casa)
        const id = identidade(t.owner)
        const comTrabalhador = trabalhando(casa, t.owner)
        return (
          <g key={`e-${casa}`}>
            <title>{`${nomeDoTile(t)} de ${estado.jogadores[t.owner]?.nome} (${casa})`}</title>
            <rect
              x={x + 5}
              y={y + 5}
              width={L - 10}
              height={L - 10}
              rx="5"
              fill={`url(#j-${t.owner})`}
              stroke={t.evoluido ? '#f5c518' : '#222'}
              strokeWidth={t.evoluido ? 4 : 1.5}
            />
            <rect x={x + 9} y={y + 13} width={L - 18} height="18" rx="3" fill="#fff" fillOpacity="0.85" />
            <text x={x + L / 2} y={y + 27} textAnchor="middle" className="t-sigla">{sigla[t.type]}</text>
            <text x={x + 9} y={y + L - 9} className="t-num-claro">{id.numero}</text>
            {t.evoluido && <text x={x + L - 10} y={y + 15} textAnchor="middle" className="t-estrela">★</text>}
            {comTrabalhador && <circle cx={x + L - 13} cy={y + L - 13} r="6" fill="#fff" stroke="#222" strokeWidth="2" />}
          </g>
        )
      })}

      {mapa.casas.map((casa) => {
        if (mapa.terreno[casa] === 'capital') return null
        const { x, y } = xy(casa)
        const ativa = destacadas.has(casa)
        return (
          <rect
            key={`c-${casa}`}
            x={x + 1.5}
            y={y + 1.5}
            width={L - 3}
            height={L - 3}
            fill={ativa ? '#2e9e5b' : 'transparent'}
            fillOpacity={ativa ? 0.22 : 0}
            stroke={ativa ? '#1a7a40' : 'none'}
            strokeWidth={ativa ? 3 : 0}
            strokeDasharray={ativa ? '6 3' : undefined}
            className={ativa ? 'casa-ativa' : undefined}
            role="gridcell"
            aria-label={casa}
            onClick={aoClicar ? () => aoClicar(casa) : undefined}
            style={{ cursor: aoClicar ? 'pointer' : 'default' }}
          />
        )
      })}

      {Array.from({ length: mapa.colunas }, (_, i) => (
        <text key={`l${i}`} x={M + i * L + L / 2} y={altura - 4} textAnchor="middle" className="t-coord">
          {String.fromCharCode(65 + i)}
        </text>
      ))}
      {Array.from({ length: mapa.linhas }, (_, i) => (
        <text key={`n${i}`} x={M / 2} y={(mapa.linhas - 1 - i) * L + L / 2 + 4} textAnchor="middle" className="t-coord">
          {i + 1}
        </text>
      ))}
    </svg>
  )
}
