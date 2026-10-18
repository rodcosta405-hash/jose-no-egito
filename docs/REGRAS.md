# José no Egito — Regras para implementação

Fonte: dossiê de desenvolvimento v2 (18/10/2026), com o mapa em S. Todos os números vêm de `config/regras.json`; este documento descreve **como** eles se aplicam. Se algo aqui contradizer o JSON, o JSON vale para números e este documento vale para procedimento. Ambiguidade não coberta: registre em `docs/DECISOES.md` e pergunte ao designer antes de inventar regra.

## 1. Visão geral

- 2 a 4 jogadores (calibrado para 4). Cada um é um governador de província; José governa da Capital.
- 14 anos: 7 gordos (1–7) e 7 magros (8–14).
- Recursos: ouro, pedra, cereal. Trabalhadores vêm das Residências (2 por Residência) e nunca são perdidos.
- Pontos: população alimentada a cada ano, contratos na fome, PV impressos dos edifícios e sobras no fim.

## 2. Mapa

- Grade 8 × 8, notação de xadrez (A1 = canto inferior esquerdo).
- **Capital:** D4, E4, D5, E5. Não recebe construção.
- **Várzea (Nilo em S):** C1, C2, D2, E2, F2, F3, F4, F8, F7, E7, D7, C7, C6, C5. **Só Campos** podem ser construídos na várzea.
- **Rochas:** A1, B1, A2, H1, G1, H2, A8, A7, B8, H8, G8, H7.
- **Planície:** todas as outras casas.
- **Margens:** calculadas por flood fill (vizinhança ortogonal) sobre casas que não são várzea nem Capital. Oeste a partir de A8, leste a partir de H1. Cada margem tem 23 casas; valide isso em teste.
- **Vizinhança:** só ortogonal (lados). Diagonais nunca contam.

## 3. Componentes de estado

- Tiles por tipo com estoque limitado (`estoqueDeTiles`). Quando o estoque de um tipo acaba, ninguém mais constrói esse tipo (exceto a partir de um tile já reservado).
- Baralho de cartas: no início, sorteie (com o RNG da partida) `sorteadasPorFase` cartas de cada baralho. A ordem é: 7 gordas embaralhadas, depois 7 magras embaralhadas. As cartas não usadas ficam fora do jogo e **não** são reveladas.
- Trilha de preço do cereal: inteiro entre `minimo` e `maximo`, começando em `inicio`.
- Demanda da Capital (contratos): inteiro, vale 0 nos anos gordos.

## 4. Preparação

1. Defina a margem de cada jogador (configuração da partida: sorteio ou escolha). No máximo `jogadoresPorMargem` por margem.
2. Sorteie a ordem de jogo. O jogador 1 recebe o marcador de primeiro jogador.
3. Cada jogador recebe os recursos de `inicial`.
4. **Primeira volta (ordem 1 → N):** cada jogador coloca Prefeitura, Residência e Mercado, nessa ordem. A Prefeitura vai numa casa livre da própria margem que não seja várzea. Residência e Mercado vão em casas livres, não várzea, conectadas ao que o jogador já colocou.
5. **Segunda volta (ordem N → 1):** cada jogador coloca Campo e Pedreira, conectados ao próprio território. O Campo pode ir para a várzea; a Pedreira não.
6. Os edifícios iniciais não consomem estoque de tiles do mercado e não custam recursos.
7. O preço começa em `inicio` e a demanda da Capital em 0.

## 5. Estrutura do ano

Para cada ano `a` de 1 a 14:

1. **Início do ano.** Se `a > 1`, o primeiro jogador passa para o próximo na ordem (gira 1 assento por ano). Se o ano é magro, a demanda da Capital passa a `demandaPorAnoMagro`.
2. **Ações.** Duas voltas. Em cada volta, a partir do primeiro jogador, cada jogador faz exatamente 1 ação (ou passa). Total: `acoesPorAno` ações por jogador.
3. **Alocação.** Cada jogador distribui seus trabalhadores (2 × número de Residências) entre seus edifícios que exigem trabalhador (Campo, Pedreira, Mercado), no máximo 1 por edifício. A alocação é livre a cada ano e não depende da anterior. Trabalhador sem edifício fica parado e continua comendo.
4. **Carta.** Revele a próxima carta do baralho: é a produção de cada Campo neste ano.
5. **Preço.** O marcador de preço anda 1 casa em direção à âncora da fase (`ancoraGordos` ou `ancoraMagros`); se já estiver nela, não se move.
6. **Produção (simultânea).** Para cada edifício com trabalhador:
   - Campo: valor da carta + `bonusVarzeaAnosGordos` se estiver na várzea e o ano for gordo (+ `bonusVarzeaAnosMagros`, que vale 0, nos magros).
   - Pedreira: `produzPedra` + `bonusRocha` se em rocha + `bonusPedra` se evoluída.
   - Mercado: `produzOuro` + `bonusOuro` se evoluído.
7. **Alimentação.** Seja W o número de trabalhadores do jogador. Alimentados = min(cereal, W × consumo). O jogador perde esse cereal. Pontos do ano = alimentados × `pontosAlimentado` + (W − alimentados) × `pontosSemComida`. Não há escolha: todo cereal disponível é usado.
8. **Armazenagem.** Capacidade = Prefeitura + Σ Armazéns (+ bônus de Celeiro Real). Cereal acima da capacidade volta ao estoque. Ouro e pedra não têm limite.

Edifícios construídos durante as ações do ano já podem receber trabalhador, produzem e (no caso das Residências) seus trabalhadores comem no mesmo ano.

## 6. Ações

Uma ação por vez. Toda ação é validada pelo motor; uma ação inválida não altera o estado e devolve uma mensagem em português explicando o motivo.

### 6.1 Construir
- Escolha um tipo construível com estoque > 0, ou um tile da sua reserva.
- Pague o custo. **Residência:** custo base + `escaladaPorResidenciaExtra` × (Residências que você já tem − 1). A inicial conta: com 1 Residência, a próxima custa o base; com 2, base + 1 escalada; e assim por diante.
- Casa válida: livre, não é Capital, não é demarcada por outro jogador, e é vizinha (ortogonal) de um edifício seu **ou** está demarcada por você.
- Na várzea, só Campo.
- Construir sobre a própria demarcação devolve o marcador ao jogador.

### 6.2 Comerciar
- Um único tipo de recurso por ação, qualquer quantidade, sempre trocado por ouro. Sem escambo.
- **Com a Capital** (exige conexão com a Capital):
  - Comprar cereal: para cada unidade, preço = min(preço + 1, máximo); pague o novo preço.
  - Vender cereal: para cada unidade, preço = max(preço − 1, mínimo); receba o novo preço.
  - Comprar pedra: `precoCompra` por unidade, preço fixo. A Capital não compra pedra.
- **Com outro jogador** (exige conexão com ele): cereal ao preço atual da trilha, sem mover o marcador; pedra a `precoPedra`. Só quem joga gasta a ação. O parceiro pode recusar (humano confirma num diálogo; bot aceita conforme `docs/BOTS.md`).
- Um jogador nunca pode ficar com ouro negativo.

### 6.3 Reservar
- Pegue 1 tile de um tipo com estoque > 0 sem pagar nada; ele sai do estoque e vai para a sua reserva.
- Máximo de `reservaMaxima` tiles na reserva ao mesmo tempo.
- Construir a partir da reserva usa a ação Construir e paga o custo normal.

### 6.4 Demarcar
- Pague `custoDemarcacao` ouro e marque uma casa livre conectada ao seu território (não Capital; várzea permitida, mas lá só caberá um Campo).
- Máximo de `demarcacaoMaxima` marcadores no tabuleiro ao mesmo tempo.
- Casa demarcada não é território: não conecta à Capital nem a vizinhos e não serve de base para expandir.

### 6.5 Evoluir
- Pague o custo do verso de um edifício seu não evoluído e vire-o. Prefeitura não evolui.
- O verso substitui os PV e adiciona os bônus listados. Uma Vila Nobre continua dando 2 trabalhadores.

### 6.6 Entregar (contratos de José)
- Só em anos magros e com conexão à Capital.
- Entregue q cereais, 1 ≤ q ≤ min(cereal do jogador, demanda restante). Ganhe q × `pontosPorCereal` imediatamente. Diminua a demanda.

### 6.7 Passar
- Sempre permitido.

## 7. Conexões

- Território do jogador: casas com edifícios seus (inclusive Campos na várzea).
- Conectado à Capital: algum edifício seu é vizinho ortogonal de uma casa da Capital.
- Conectado a outro jogador: algum edifício seu é vizinho ortogonal de um edifício dele.

## 8. Fim de jogo

Depois da resolução do ano 14, some a cada jogador:
1. PV impressos (lado visível). Residência, Armazém e Prefeitura contam sempre. Mercado, Campo e Pedreira só contam se tiveram trabalhador alocado no ano 14.
2. Sobras: ⌊ouro / ouroPorPonto⌋ + ⌊cereal / cerealPorPonto⌋ + ⌊pedra / pedraPorPonto⌋.

Vence quem tiver mais pontos. Desempate, nesta ordem: mais trabalhadores alimentados no ano 14; mais cereal guardado; persistindo, empate compartilhado.

## 9. Placar detalhado (obrigatório na interface e na simulação)

Para cada jogador, acumule separadamente: alimentação, fome, contratos, PV impressos, sobras. A soma é a pontuação.

## 10. Decisões tomadas para o app (o dossiê deixava em aberto)

| Tema | Decisão no app | Onde mudar |
| --- | --- | --- |
| Preço entre jogadores | Preço da trilha, sem mover o marcador | `comercioEntreJogadores` |
| Pedra na Capital | Compra a 2; a Capital não compra pedra | `pedraNaCapital` |
| Distância mínima entre posições | Não exigida para humanos | — |
| Desempate | Alimentados no ano 14, depois cereal guardado | `desempate` |
| Informação oculta | Só o baralho; todo o resto é público | — |

Qualquer nova decisão vai para `docs/DECISOES.md`.
