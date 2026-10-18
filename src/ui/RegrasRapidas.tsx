import { regras as r } from '../engine'
import { textoCusto } from './apresentacao'

export function RegrasRapidas({ aoVoltar }: { aoVoltar: () => void }) {
  const e = r.edificios
  return (
    <main className="regras">
      <h1>Regras rápidas</h1>
      <p>
        Você governa uma província do Egito. São {r.anos.total} anos: {r.anos.gordos} gordos e {r.anos.total - r.anos.gordos} magros, de fome.
        Ganha quem tiver mais pontos no fim.
      </p>
      <h2>Cada ano</h2>
      <ol>
        <li>
          <strong>Ações:</strong> {r.acoesPorAno} voltas; em cada uma, cada jogador faz 1 ação ou passa.
        </li>
        <li>
          <strong>Alocação:</strong> cada Residência dá {e.residencia.trabalhadores} trabalhadores. Ponha no máximo 1 em cada Campo, Pedreira
          ou Mercado.
        </li>
        <li>
          <strong>Carta:</strong> diz quanto cereal cada Campo produz. Anos gordos: {Math.min(...r.cartas.gordas)} a{' '}
          {Math.max(...r.cartas.gordas)}; magros: {Math.min(...r.cartas.magras)} a {Math.max(...r.cartas.magras)}. Campo na várzea ganha +
          {e.campo.bonusVarzeaAnosGordos} nos anos gordos.
        </li>
        <li>
          <strong>Alimentação:</strong> cada trabalhador come {r.populacao.consumoPorTrabalhador} cereal. Alimentado vale{' '}
          {r.populacao.pontosAlimentado} ponto; sem comida, {r.populacao.pontosSemComida}.
        </li>
        <li>
          <strong>Armazenagem:</strong> cereal acima da sua capacidade (Prefeitura {e.prefeitura.capacidadeCereal} + Armazéns{' '}
          {e.armazem.capacidadeCereal} cada) é descartado.
        </li>
      </ol>
      <h2>Ações</h2>
      <ul>
        <li>
          <strong>Construir</strong> ao lado de um edifício seu (ou numa casa que você demarcou). Na várzea, só Campos. Custos: Residência{' '}
          {textoCusto(e.residencia.custo)} (fica mais cara a cada uma), Mercado {textoCusto(e.mercado.custo)}, Campo {textoCusto(e.campo.custo)},
          Pedreira {textoCusto(e.pedreira.custo)}, Armazém {textoCusto(e.armazem.custo)}.
        </li>
        <li>
          <strong>Comerciar</strong> cereal ou pedra por ouro. Com a Capital (precisa estar ao lado dela): cada cereal comprado sobe o preço 1
          casa; cada vendido desce 1. Pedra a {r.pedraNaCapital.precoCompra} ouro. Com um vizinho: cereal ao preço da trilha, pedra a{' '}
          {r.comercioEntreJogadores.precoPedra}.
        </li>
        <li>
          <strong>Reservar</strong> um tile sem custo (máximo {r.acoesAuxiliares.reservaMaxima}).
        </li>
        <li>
          <strong>Demarcar</strong> uma casa vizinha por {r.acoesAuxiliares.custoDemarcacao} ouro (máximo {r.acoesAuxiliares.demarcacaoMaxima}).
        </li>
        <li>
          <strong>Evoluir</strong> um edifício para o verso: mais pontos e bônus.
        </li>
        <li>
          <strong>Entregar</strong> cereal a José nos anos magros: {r.contratos.pontosPorCereal} pontos por cereal, até{' '}
          {r.contratos.demandaPorAnoMagro} por ano somando todos.
        </li>
      </ul>
      <h2>Fim de jogo</h2>
      <p>
        Somam-se os PV impressos nos edifícios (Mercado, Campo e Pedreira só se tiveram trabalhador no último ano) e as sobras: 1 ponto a cada{' '}
        {r.fimDeJogo.ouroPorPonto} ouros, {r.fimDeJogo.cerealPorPonto} cereais e {r.fimDeJogo.pedraPorPonto} pedras.
      </p>
      <button className="botao primario" onClick={aoVoltar}>
        Voltar
      </button>
    </main>
  )
}
