import { useState, type ReactNode } from 'react'
import { botAceitaComercio } from '../bots'
import {
  casasValidasConstrucao,
  comprarDaCapital,
  conectadoAJogador,
  construivel,
  custoConstrucao,
  obterMapa,
  precoEntreJogadores,
  tiposDeEdificio,
  validarAcao,
  venderACapital,
} from '../engine'
import type { Action, BuildingType, GameState } from '../engine'
import { nomeEdificio, textoCusto } from './apresentacao'
import { Marca } from './Paineis'

type Executar = (acao: Action) => string | undefined

export function Dialogo({ titulo, children, aoFechar }: { titulo: string; children: ReactNode; aoFechar?: () => void }) {
  return (
    <div className="fundo-dialogo">
      <div className="dialogo" role="dialog" aria-modal="true" aria-label={titulo}>
        <h2>{titulo}</h2>
        {children}
        {aoFechar && (
          <button className="botao secundario" onClick={aoFechar}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}

// ---------- construir ----------

export function DialogoConstruir({
  estado,
  jogador,
  aoEscolher,
  aoFechar,
}: {
  estado: GameState
  jogador: number
  aoEscolher: (edificio: BuildingType, daReserva: boolean) => void
  aoFechar: () => void
}) {
  const p = estado.jogadores[jogador]!
  const opcoes: { edificio: BuildingType; daReserva: boolean }[] = []
  for (const t of tiposDeEdificio.filter((x) => construivel(x, estado.regras))) {
    opcoes.push({ edificio: t, daReserva: false })
    if (p.reserva.includes(t)) opcoes.push({ edificio: t, daReserva: true })
  }
  return (
    <Dialogo titulo="Construir" aoFechar={aoFechar}>
      <p className="dica">Escolha o edifício; depois toque numa casa destacada no tabuleiro.</p>
      <ul className="lista-opcoes">
        {opcoes.map(({ edificio, daReserva }) => {
          const custo = custoConstrucao(estado, jogador, edificio)
          const casas = casasValidasConstrucao(estado, jogador, edificio, daReserva)
          const motivo = casas.length > 0 ? null : motivoSemConstrucao(estado, jogador, edificio, daReserva)
          const estoque = estado.estoque[edificio as keyof GameState['estoque']]
          return (
            <li key={`${edificio}-${daReserva}`}>
              <button className="botao opcao" aria-disabled={motivo !== null} onClick={() => motivo === null && aoEscolher(edificio, daReserva)}>
                <strong>{nomeEdificio(edificio)}</strong>
                {daReserva && ' (da reserva)'}
                <span>{textoCusto(custo)}</span>
                <small>{daReserva ? 'tile reservado' : `estoque: ${estoque}`}</small>
                {motivo && <em className="motivo">{motivo}</em>}
              </button>
            </li>
          )
        })}
      </ul>
    </Dialogo>
  )
}

/** Entre as recusas do motor em todas as casas, a que explica o problema (recurso ou tile) vale mais que a de lugar. */
function motivoSemConstrucao(estado: GameState, jogador: number, edificio: BuildingType, daReserva: boolean): string {
  const motivos = obterMapa(estado.regras).casas.map((casa) => validarAcao(estado, jogador, { tipo: 'construir', edificio, casa, daReserva }))
  const geral = motivos.find((m) => m && /^(Recursos insuficientes|Acabaram|Você não tem)/.test(m))
  return geral ?? 'Sem casa válida ao lado dos seus edifícios'
}

// ---------- reservar ----------

export function DialogoReservar({ estado, jogador, executar, aoFechar }: { estado: GameState; jogador: number; executar: Executar; aoFechar: () => void }) {
  const [erro, setErro] = useState<string | null>(null)
  return (
    <Dialogo titulo="Reservar um tile" aoFechar={aoFechar}>
      <p className="dica">Sem custo. O tile sai do estoque e fica na sua reserva (máximo {estado.regras.acoesAuxiliares.reservaMaxima}).</p>
      <ul className="lista-opcoes">
        {tiposDeEdificio
          .filter((t) => construivel(t, estado.regras))
          .map((t) => {
            const motivo = validarAcao(estado, jogador, { tipo: 'reservar', edificio: t })
            return (
              <li key={t}>
                <button
                  className="botao opcao"
                  aria-disabled={motivo !== null}
                  onClick={() => (motivo ? setErro(motivo) : setErro(executar({ tipo: 'reservar', edificio: t }) ?? null))}
                >
                  <strong>{nomeEdificio(t)}</strong>
                  <small>estoque: {estado.estoque[t as keyof GameState['estoque']]}</small>
                  {motivo && <em className="motivo">{motivo}</em>}
                </button>
              </li>
            )
          })}
      </ul>
      {erro && <p className="erro">{erro}</p>}
    </Dialogo>
  )
}

// ---------- entregar ----------

export function DialogoEntregar({ estado, jogador, executar, aoFechar }: { estado: GameState; jogador: number; executar: Executar; aoFechar: () => void }) {
  const p = estado.jogadores[jogador]!
  const maximo = Math.max(1, Math.min(p.cereal, estado.demandaCapital))
  const [q, setQ] = useState(maximo)
  const motivo = validarAcao(estado, jogador, { tipo: 'entregar', quantidade: q })
  return (
    <Dialogo titulo="Entregar cereal a José" aoFechar={aoFechar}>
      <p>
        José ainda aceita <strong>{estado.demandaCapital}</strong> cereal neste ano. Cada cereal vale{' '}
        <strong>{estado.regras.contratos.pontosPorCereal}</strong> pontos.
      </p>
      <Quantidade valor={q} minimo={1} maximo={maximo} mudar={setQ} />
      <p>
        Você ganha <strong>{q * estado.regras.contratos.pontosPorCereal}</strong> pontos e fica com {p.cereal - q} cereal.
      </p>
      {motivo && <p className="erro">{motivo}</p>}
      <button className="botao primario" aria-disabled={motivo !== null} onClick={() => motivo === null && executar({ tipo: 'entregar', quantidade: q })}>
        Entregar {q}
      </button>
    </Dialogo>
  )
}

function Quantidade({ valor, minimo, maximo, mudar }: { valor: number; minimo: number; maximo: number; mudar: (v: number) => void }) {
  return (
    <div className="quantidade">
      <button className="botao" onClick={() => mudar(Math.max(minimo, valor - 1))} aria-label="Menos">
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={minimo}
        max={maximo}
        value={valor}
        onChange={(e) => mudar(Math.max(minimo, Math.min(maximo, Math.trunc(Number(e.target.value)) || minimo)))}
        aria-label="Quantidade"
      />
      <button className="botao" onClick={() => mudar(Math.min(maximo, valor + 1))} aria-label="Mais">
        +
      </button>
    </div>
  )
}

// ---------- comerciar ----------

type Parceiro = 'capital' | number

export function DialogoComerciar({ estado, jogador, executar, aoFechar }: { estado: GameState; jogador: number; executar: Executar; aoFechar: () => void }) {
  const p = estado.jogadores[jogador]!
  const [com, setCom] = useState<Parceiro>('capital')
  const [recurso, setRecurso] = useState<'cereal' | 'pedra'>('cereal')
  const [direcao, setDirecao] = useState<'comprar' | 'vender'>('comprar')
  const [q, setQ] = useState(1)
  const [pedindo, setPedindo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const acao: Extract<Action, { tipo: 'comerciar' }> = { tipo: 'comerciar', com, recurso, direcao, quantidade: q }
  const motivo = validarAcao(estado, jogador, acao)
  const parceiro = typeof com === 'number' ? estado.jogadores[com] : null

  let resumo: string
  if (com === 'capital') {
    if (recurso === 'pedra') {
      resumo = direcao === 'comprar' ? `Custa ${q * estado.regras.pedraNaCapital.precoCompra} ouros (preço fixo).` : 'A Capital não compra pedra.'
    } else if (direcao === 'comprar') {
      const { total, precoFinal } = comprarDaCapital(estado.preco, q, estado.regras)
      resumo = `Custa ${total} ouros. O preço vai de ${estado.preco} para ${precoFinal}.`
    } else {
      const { total, precoFinal } = venderACapital(estado.preco, q, estado.regras)
      resumo = `Rende ${total} ouros. O preço vai de ${estado.preco} para ${precoFinal}.`
    }
  } else {
    const total = q * precoEntreJogadores(estado, recurso)
    resumo = `${direcao === 'comprar' ? 'Custa' : 'Rende'} ${total} ouros (${precoEntreJogadores(estado, recurso)} por unidade; o preço da trilha não muda).`
  }

  const confirmar = () => {
    if (motivo) return
    if (parceiro?.tipo === 'humano') return setPedindo(true)
    if (parceiro?.tipo === 'bot') {
      const resp = botAceitaComercio(estado, parceiro.id, acao)
      if (!resp.aceita) return setAviso(`${resp.motivo}. A ação não foi gasta.`)
    }
    setAviso(executar(acao) ?? null)
  }

  if (pedindo && parceiro) {
    const verbo = direcao === 'comprar' ? `vender ${q} ${recurso} a ${p.nome}` : `comprar ${q} ${recurso} de ${p.nome}`
    const total = q * precoEntreJogadores(estado, recurso)
    return (
      <Dialogo titulo={`Passe o aparelho para ${parceiro.nome}`}>
        <p>
          <Marca jogador={parceiro.id} /> <strong>{parceiro.nome}</strong>, você aceita {verbo} por <strong>{total} ouros</strong>?
        </p>
        <div className="botoes">
          <button className="botao primario" onClick={() => setAviso(executar(acao) ?? null)}>
            Aceitar
          </button>
          <button
            className="botao"
            onClick={() => {
              setPedindo(false)
              setAviso(`${parceiro.nome} recusou. A ação não foi gasta.`)
            }}
          >
            Recusar
          </button>
        </div>
        {aviso && <p className="erro">{aviso}</p>}
      </Dialogo>
    )
  }

  const outros = estado.jogadores.filter((x) => x.id !== jogador)
  return (
    <Dialogo titulo="Comerciar" aoFechar={aoFechar}>
      <fieldset>
        <legend>Com quem</legend>
        <div className="botoes">
          <button className={`botao ${com === 'capital' ? 'marcado' : ''}`} onClick={() => setCom('capital')}>
            Capital
          </button>
          {outros.map((o) => (
            <button key={o.id} className={`botao ${com === o.id ? 'marcado' : ''}`} onClick={() => setCom(o.id)}>
              <Marca jogador={o.id} /> {o.nome}
              {!conectadoAJogador(estado, jogador, o.id) && <small> (sem conexão)</small>}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>O quê</legend>
        <div className="botoes">
          {(['comprar', 'vender'] as const).map((d) => (
            <button key={d} className={`botao ${direcao === d ? 'marcado' : ''}`} onClick={() => setDirecao(d)}>
              {d === 'comprar' ? 'Comprar' : 'Vender'}
            </button>
          ))}
          {(['cereal', 'pedra'] as const).map((r) => (
            <button key={r} className={`botao ${recurso === r ? 'marcado' : ''}`} onClick={() => setRecurso(r)}>
              {r === 'cereal' ? 'Cereal' : 'Pedra'}
            </button>
          ))}
        </div>
      </fieldset>
      <Quantidade valor={q} minimo={1} maximo={99} mudar={setQ} />
      <p>{resumo}</p>
      <p className="dica">
        Você tem {p.ouro} ouro, {p.pedra} pedra e {p.cereal} cereal.
        {parceiro && ` ${parceiro.nome} tem ${parceiro.ouro} ouro, ${parceiro.pedra} pedra e ${parceiro.cereal} cereal.`}
      </p>
      {motivo && <p className="erro">{motivo}</p>}
      {aviso && <p className="erro">{aviso}</p>}
      <button className="botao primario" aria-disabled={motivo !== null} onClick={confirmar}>
        {parceiro ? `Propor a ${parceiro.nome}` : 'Confirmar'}
      </button>
    </Dialogo>
  )
}
