import { pontuacao } from '../engine'
import type { CriterioDesempate, GameState, ResumoAno } from '../engine'
import { Dialogo } from './Dialogos'
import { BotoesExportar } from './Exportar'
import { GraficoPontos } from './Grafico'
import { Marca } from './Paineis'
import type { Tempos } from './registro'

export function DialogoResumoAno({ estado, resumo, aoContinuar }: { estado: GameState; resumo: ResumoAno; aoContinuar: () => void }) {
  const regras = estado.regras
  const comecaFome = resumo.ano === regras.anos.gordos
  const ultimo = resumo.ano === regras.anos.total
  return (
    <Dialogo titulo={`Fim do ano ${resumo.ano}`}>
      <div className="carta-revelada" aria-label={`Carta do ano: ${resumo.carta}`}>
        <span>Carta</span>
        <strong>{resumo.carta}</strong>
        <small>cereal por Campo</small>
      </div>
      <p>Preço do cereal agora: {resumo.preco}</p>
      <div className="tabela-rolavel">
        <table>
          <thead>
            <tr>
              <th>Jogador</th>
              <th>Produção</th>
              <th>Alimentados</th>
              <th>Sem comida</th>
              <th>Pontos do ano</th>
              <th>Descartado</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {resumo.jogadores.map((r) => (
              <tr key={r.jogador}>
                <td>
                  <Marca jogador={r.jogador} /> {estado.jogadores[r.jogador]?.nome}
                </td>
                <td>
                  {r.producao.cereal} cereal, {r.producao.ouro} ouro, {r.producao.pedra} pedra
                </td>
                <td>
                  {r.alimentados} de {r.trabalhadores}
                </td>
                <td className={r.semComida > 0 ? 'ruim' : ''}>{r.semComida}</td>
                <td>{r.pontosAno}</td>
                <td className={r.descartado > 0 ? 'ruim' : ''}>{r.descartado}</td>
                <td>{r.totalAcumulado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {comecaFome && (
        <p className="aviso-fome" role="alert">
          A fome começou! Do ano {regras.anos.gordos + 1} em diante as cartas são magras ({Math.min(...regras.cartas.magras)} a{' '}
          {Math.max(...regras.cartas.magras)}). José passa a pedir {regras.contratos.demandaPorAnoMagro} cereal por ano, a{' '}
          {regras.contratos.pontosPorCereal} pontos cada.
        </p>
      )}
      <button className="botao primario" onClick={aoContinuar} autoFocus>
        {ultimo ? 'Ver resultado final' : 'Continuar'}
      </button>
    </Dialogo>
  )
}

const textoCriterio: Record<CriterioDesempate, string> = {
  pontos: '',
  trabalhadoresAlimentadosNoAno14: 'desempate: mais trabalhadores alimentados no último ano',
  cerealGuardado: 'desempate: mais cereal guardado',
  empate: 'empate em todos os critérios',
}

export function FimDeJogo({
  estado,
  tempos,
  aoNovaPartida,
  titulo = 'Fim de jogo',
  comJson = true,
}: {
  estado: GameState
  tempos: Tempos
  aoNovaPartida?: () => void
  titulo?: string
  comJson?: boolean
}) {
  const lista = estado.classificacao ?? []
  return (
    <section className="fim">
      <h1>{titulo}</h1>
      <div className="tabela-rolavel">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Jogador</th>
              <th>Total</th>
              <th>Alimentação</th>
              <th>Fome</th>
              <th>Contratos</th>
              <th>PV impressos</th>
              <th>Sobras</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c, i) => {
              const p = estado.jogadores[c.jogador]!
              const seguinte = lista[i + 1]
              const nota = seguinte && seguinte.total === c.total ? textoCriterio[c.criterio] : ''
              return (
                <tr key={c.jogador} className={c.posicao === 1 ? 'vencedor' : ''}>
                  <td>{c.posicao}º</td>
                  <td>
                    <Marca jogador={c.jogador} /> {p.nome}
                    {nota && <small className="nota"> ({nota})</small>}
                  </td>
                  <td>
                    <strong>{pontuacao(p)}</strong>
                  </td>
                  <td>{p.placar.alimentacao}</td>
                  <td>{p.placar.fome}</td>
                  <td>{p.placar.contratos}</td>
                  <td>{p.placar.impressos}</td>
                  <td>{p.placar.sobras}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <GraficoPontos estado={estado} tempos={tempos} />
      <div className="botoes">
        {aoNovaPartida && (
          <button className="botao primario" onClick={aoNovaPartida}>
            Nova partida
          </button>
        )}
        <BotoesExportar estado={estado} tempos={tempos} comJson={comJson} />
      </div>
    </section>
  )
}
