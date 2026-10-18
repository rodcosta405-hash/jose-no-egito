import { useEffect, useMemo, useState } from 'react'
import {
  acoesDisponiveis,
  casasValidasConstrucao,
  casasValidasDemarcacao,
  casasValidasEvolucao,
  casasValidasMontagem,
  edificiosDe,
  precisaTrabalhador,
  previsaoAlocacao,
  proximaMontagem,
  regras,
  trabalhadores,
} from '../engine'
import type { Action, BuildingType, Coord, GameState, TipoAcaoDoAno } from '../engine'
import { identidade, nomeEdificio, umaCasa } from './apresentacao'
import { DialogoComerciar, DialogoConstruir, DialogoEntregar, DialogoReservar } from './Dialogos'
import { Cabecalho, Historico, Marca, OutrosJogadores, PainelJogador } from './Paineis'
import { DialogoResumoAno, FimDeJogo } from './Resultados'
import { nomesDaVelocidade, podeDesfazer, resumoPendente, type Velocidade } from './sessao'
import { Tabuleiro } from './Tabuleiro'
import type { Jogo } from './useJogo'

type Modo = { tipo: 'construir'; edificio: BuildingType; daReserva: boolean } | { tipo: 'demarcar' } | { tipo: 'evoluir' }
type DialogoAberto = 'construir' | 'comerciar' | 'reservar' | 'entregar' | null

const botoesDeAcao: [TipoAcaoDoAno, string][] = [
  ['construir', 'Construir'],
  ['comerciar', 'Comerciar'],
  ['reservar', 'Reservar'],
  ['demarcar', 'Demarcar'],
  ['evoluir', 'Evoluir'],
  ['entregar', 'Entregar'],
  ['passar', 'Passar'],
]

/** Alocação inicial: a do ano anterior, só com edifícios que ainda recebem trabalhador, até W. */
function alocacaoInicial(e: GameState, j: number): Coord[] {
  const p = e.jogadores[j]
  if (!p) return []
  const validas = p.alocacao.filter((c) => {
    const t = e.tabuleiro[c]
    return t && t.owner === j && precisaTrabalhador(t.type)
  })
  return validas.slice(0, trabalhadores(e, j))
}

export function Mesa({ jogo }: { jogo: Jogo }) {
  const s = jogo.sessao!
  const e = s.estado
  const vez = e.vez
  const pVez = e.jogadores[vez]!
  const humano = pVez.tipo === 'humano'
  const resumo = resumoPendente(s)

  const [modo, setModo] = useState<Modo | null>(null)
  const [dialogo, setDialogo] = useState<DialogoAberto>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [selecao, setSelecao] = useState<Coord[] | null>(null)

  // Mudou a vez, a fase ou o ano: limpa o que estava em andamento.
  useEffect(() => {
    setModo(null)
    setDialogo(null)
    setSelecao(null)
    setMensagem(null)
  }, [vez, e.fase, e.ano, e.volta])

  const alocando = e.fase === 'alocacao' && humano && !resumo
  const sel = alocando ? (selecao ?? alocacaoInicial(e, vez)) : []
  const montando = e.fase === 'montagem' && humano
  const prox = e.fase === 'montagem' ? proximaMontagem(e) : null

  const destacadas = useMemo(() => {
    if (resumo || !humano) return new Set<Coord>()
    if (montando) return new Set(casasValidasMontagem(e))
    if (alocando)
      return new Set(
        edificiosDe(e, vez)
          .filter(([, t]) => precisaTrabalhador(t.type))
          .map(([c]) => c),
      )
    if (!modo) return new Set<Coord>()
    if (modo.tipo === 'construir') return new Set(casasValidasConstrucao(e, vez, modo.edificio, modo.daReserva))
    if (modo.tipo === 'demarcar') return new Set(casasValidasDemarcacao(e, vez))
    return new Set(casasValidasEvolucao(e, vez))
  }, [e, vez, humano, montando, alocando, modo, resumo])

  if (e.fase === 'fim' && !resumo) return <FimDeJogo estado={e} aoNovaPartida={jogo.encerrar} />

  const executar = (acao: Action): string | undefined => {
    const erro = jogo.agir(vez, acao)
    if (erro) setMensagem(erro)
    else {
      setMensagem(null)
      setModo(null)
      setDialogo(null)
    }
    return erro
  }

  const clicar = (casa: Coord) => {
    if (resumo || !humano) return
    if (montando && prox) return void executar({ tipo: 'montar', edificio: prox.edificio, casa })
    if (alocando) {
      const t = e.tabuleiro[casa]
      if (!t || t.owner !== vez || !precisaTrabalhador(t.type)) return setMensagem('Toque nos seus Campos, Pedreiras e Mercados')
      if (sel.includes(casa)) return setSelecao(sel.filter((c) => c !== casa))
      const w = trabalhadores(e, vez)
      if (sel.length >= w) return setMensagem(`Você tem só ${w} trabalhadores. Tire um de outro edifício primeiro.`)
      setMensagem(null)
      return setSelecao([...sel, casa])
    }
    if (!modo) return
    if (modo.tipo === 'construir') executar({ tipo: 'construir', edificio: modo.edificio, casa, daReserva: modo.daReserva })
    else if (modo.tipo === 'demarcar') executar({ tipo: 'demarcar', casa })
    else executar({ tipo: 'evoluir', casa })
  }

  const disponiveis = e.fase === 'acoes' && humano && !resumo ? acoesDisponiveis(e, vez) : null
  const tocarAcao = (tipo: TipoAcaoDoAno) => {
    if (!disponiveis) return
    const motivo = disponiveis[tipo]
    if (motivo) return setMensagem(motivo)
    setMensagem(null)
    setModo(null)
    if (tipo === 'passar') executar({ tipo: 'passar' })
    else if (tipo === 'demarcar') setModo({ tipo: 'demarcar' })
    else if (tipo === 'evoluir') setModo({ tipo: 'evoluir' })
    else setDialogo(tipo)
  }

  // ---------- texto-guia ----------
  let guia: string
  if (s.erroBot) guia = s.erroBot
  else if (resumo) guia = 'Confira o resumo do ano.'
  else if (!humano) guia = `${pVez.nome} (bot) está jogando…`
  else if (montando && prox) {
    const nome = nomeEdificio(prox.edificio)
    guia =
      prox.edificio === 'prefeitura'
        ? `${pVez.nome}, coloque sua ${nome} na margem ${pVez.margem}.`
        : `${pVez.nome}, coloque: ${nome} (ao lado dos seus edifícios${prox.edificio === 'campo' ? '; pode ser na várzea' : ''}).`
  } else if (alocando) guia = `${pVez.nome}, aloque seus trabalhadores: toque nos seus Campos, Pedreiras e Mercados.`
  else if (modo?.tipo === 'construir') guia = `Toque numa casa destacada para construir ${nomeEdificio(modo.edificio)}.`
  else if (modo?.tipo === 'demarcar') guia = `Toque numa casa destacada para demarcar (custa ${regras.acoesAuxiliares.custoDemarcacao} ouro).`
  else if (modo?.tipo === 'evoluir') guia = 'Toque num edifício seu destacado para evoluir.'
  else guia = `Vez de ${pVez.nome}: escolha uma ação.`

  const previsao = alocando ? previsaoAlocacao(e, vez, sel) : null
  const w = trabalhadores(e, vez)

  return (
    <div className="mesa">
      <Cabecalho estado={e} />

      <div className="barra-vez" style={{ borderColor: identidade(vez).cor }}>
        <span className="vez">
          <Marca jogador={vez} /> Vez de <strong>{pVez.nome}</strong> {!humano && '(bot)'}
        </span>
        <span className="controles">
          {podeDesfazer(s) && (
            <button className="botao" onClick={jogo.desfazer}>
              Desfazer ({e.jogadores[s.donoDesfazer ?? 0]?.nome})
            </button>
          )}
          <label>
            Bots{' '}
            <select value={s.velocidade} onChange={(ev) => jogo.mudarVelocidade(ev.target.value as Velocidade)}>
              {(Object.keys(nomesDaVelocidade) as Velocidade[]).map((v) => (
                <option key={v} value={v}>
                  {nomesDaVelocidade[v]}
                </option>
              ))}
            </select>
          </label>
          <button className="botao secundario" onClick={jogo.irParaMenu} title="A partida fica salva">
            Menu
          </button>
        </span>
      </div>

      <div className="corpo">
        <div className="col-principal">
          <p className={`guia ${s.erroBot ? 'erro' : ''}`} aria-live="polite">
            {guia}
          </p>
          <Tabuleiro estado={e} destacadas={destacadas} alocacaoEmEdicao={alocando ? { jogador: vez, casas: sel } : undefined} aoClicar={clicar} />
          {mensagem && (
            <p className="mensagem" role="alert">
              {mensagem}
            </p>
          )}

          {modo && (
            <button className="botao secundario largo" onClick={() => setModo(null)}>
              Cancelar
            </button>
          )}

          {alocando && previsao && (
            <section className="alocacao">
              <p className="contador">
                <strong>{sel.length}</strong> de {w} trabalhadores alocados
              </p>
              <p>
                Se a carta for média ({umaCasa(previsao.cartaMedia)}), você terá <strong>{umaCasa(previsao.cerealPrevisto)}</strong> cereais;
                precisa de <strong>{previsao.necessidade}</strong> para alimentar todos.
              </p>
              {previsao.cerealPrevisto - previsao.necessidade > previsao.capacidade && (
                <p className="dica">
                  Depois de comer, o que passar de {previsao.capacidade} (sua capacidade) será descartado.
                </p>
              )}
              <p className="dica">
                Ouro previsto: {previsao.ouroPrevisto} · Pedra prevista: {previsao.pedraPrevista}
              </p>
              <button className="botao primario largo" onClick={() => executar({ tipo: 'alocar', casas: sel })}>
                Confirmar alocação
              </button>
            </section>
          )}

          {disponiveis && (
            <nav className="barra-acoes" aria-label="Ações">
              {botoesDeAcao.map(([tipo, nome]) => (
                <button
                  key={tipo}
                  className={`botao acao ${disponiveis[tipo] ? 'indisponivel' : ''}`}
                  aria-disabled={disponiveis[tipo] !== null}
                  title={disponiveis[tipo] ?? undefined}
                  onClick={() => tocarAcao(tipo)}
                >
                  {nome}
                </button>
              ))}
            </nav>
          )}
        </div>

        <aside className="col-lateral">
          <PainelJogador estado={e} jogador={vez} />
          <OutrosJogadores estado={e} exceto={vez} />
          <Historico estado={e} />
        </aside>
      </div>

      {dialogo === 'construir' && (
        <DialogoConstruir
          estado={e}
          jogador={vez}
          aoFechar={() => setDialogo(null)}
          aoEscolher={(edificio, daReserva) => {
            setDialogo(null)
            setModo({ tipo: 'construir', edificio, daReserva })
          }}
        />
      )}
      {dialogo === 'comerciar' && <DialogoComerciar estado={e} jogador={vez} executar={executar} aoFechar={() => setDialogo(null)} />}
      {dialogo === 'reservar' && <DialogoReservar estado={e} jogador={vez} executar={executar} aoFechar={() => setDialogo(null)} />}
      {dialogo === 'entregar' && <DialogoEntregar estado={e} jogador={vez} executar={executar} aoFechar={() => setDialogo(null)} />}
      {resumo && <DialogoResumoAno estado={e} resumo={resumo} aoContinuar={jogo.confirmarResumo} />}
    </div>
  )
}
