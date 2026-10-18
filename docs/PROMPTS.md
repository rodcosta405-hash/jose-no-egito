# Prompts para o Claude Code, fase por fase

Use um prompt por vez, na ordem. No fim de cada fase: confira os critérios de aceite, rode os testes, jogue um pouco e faça um commit. Só então passe para a próxima. Se o Claude Code propuser inventar uma regra, peça para registrar a dúvida em `docs/DECISOES.md` e responder você.

Dica: em cada fase, peça primeiro um plano curto ("antes de escrever código, me mostre o plano desta fase") e aprove-o antes da implementação.

---

## Fase 0 — Projeto base

```
Leia CLAUDE.md e os arquivos em docs/. Crie o projeto com Vite + React + TypeScript (strict) e Vitest, seguindo a estrutura de pastas de docs/ARQUITETURA.md. Crie scripts npm: dev, build, test, sim. Carregue config/regras.json com um validador de tipos em src/engine/config.ts que falhe com mensagem clara se faltar algum campo. Ainda não implemente regras de jogo. Ao terminar, rode build e test.
```

**Aceite:** `npm run dev` abre uma página vazia com o título do jogo; `npm test` passa; `regras.json` com um campo removido gera erro legível.

---

## Fase 1 — Mapa e preparação

```
Implemente src/engine/rng.ts (gerador com semente), src/engine/map.ts e src/engine/setup.ts conforme docs/REGRAS.md seções 2 a 4. Inclua: conversão entre notação de xadrez e índices, vizinhança ortogonal, terreno de cada casa, cálculo das margens por flood fill, criação de uma nova partida (ordem, recursos iniciais, baralho sorteado com a semente, margens) e a fase de montagem (ações "montar" com validação). Escreva testes.
```

**Aceite (testes obrigatórios):**
- As duas margens têm 23 casas cada e são simétricas por rotação de 180°.
- A várzea tem 14 casas; nenhuma casa é várzea e rocha ao mesmo tempo.
- O mesmo número de semente gera o mesmo baralho; sementes diferentes geram baralhos diferentes.
- Na montagem, Prefeitura fora da própria margem ou na várzea é recusada; Pedreira na várzea é recusada; Campo na várzea é aceito.
- A segunda volta da montagem acontece na ordem inversa.

---

## Fase 2 — Ações e ano completo

```
Implemente src/engine/actions.ts, src/engine/year.ts, src/engine/scoring.ts e src/engine/queries.ts conforme docs/REGRAS.md seções 5 a 9. Cada ação inválida devolve uma mensagem de erro em português. Escreva testes para cada regra listada nos critérios de aceite desta fase.
```

**Aceite (testes obrigatórios):**
- Custo da Residência: com 1, a próxima custa 2 ouro + 2 pedra; com 2, custa 4 + 3; com 3, custa 6 + 4.
- Construir longe do território é recusado; construir sobre a própria demarcação é aceito e devolve o marcador.
- Comprar 3 cereais da Capital com o preço em 4 custa 5 + 6 + 7 = 18 ouros e deixa o preço em 7. Vender 2 com o preço em 7 rende 6 + 5 = 11 e deixa em 5. O preço nunca sai de 1 a 10.
- Entregar só funciona nos anos magros, com conexão à Capital, e respeita a demanda de 4 por ano somando todos os jogadores.
- Evoluir troca os PV e aplica os bônus (Grande Mercado produz 5 ouros; Celeiro Real soma 8 de capacidade).
- Alimentação: com 6 trabalhadores e 4 cereais, o jogador faz 4 × 1 + 2 × (−2) = 0 pontos e fica com 0 cereal.
- Cereal acima da capacidade é descartado depois da alimentação.
- Campo na várzea produz carta + 1 nos anos gordos e só a carta nos magros.
- Mercado, Campo e Pedreira sem trabalhador no ano 14 não contam PV no fim.
- Sobras: 9 ouros, 5 cereais e 7 pedras valem 2 + 2 + 1 = 5 pontos.
- O primeiro jogador gira 1 assento por ano; a demanda da Capital é 0 nos anos gordos.
- Uma partida completa termina na fase "fim" com o placar por fonte somando a pontuação.

---

## Fase 3 — Bots e simulação sem interface

```
Implemente os bots em src/bots/ seguindo docs/BOTS.md à risca, com os parâmetros de config/bots.json. Se precisar, leia referencia/simulador_jose_no_egito_v8.py (funções act_param, allocate, buy_grain, sell_grain, upgrade, cell_score) e referencia/mapa_em_s.py (montagem no mapa em S e regra da várzea). Crie scripts/sim.ts: roda N partidas só com bots, com mesas configuráveis, e imprime vitórias e pontos médios por estratégia e por margem, além do placar por fonte. Compare com config/bots.json > referenciaDeResultados e me mostre a tabela comparativa.
```

**Aceite:**
- 1200 partidas rodam em menos de 1 minuto no Node.
- Os números ficam dentro da tolerância de `referenciaDeResultados`. Se não ficarem, o Claude Code deve investigar a diferença, não ajustar parâmetros para "bater".
- Nenhuma ação de bot é recusada pelo motor (se for, é bug no bot ou no motor).

---

## Fase 4 — Interface jogável

```
Construa a interface conforme docs/INTERFACE.md, telas 1 a 6, usando apenas a API do motor. Tabuleiro em SVG. Bots jogam sozinhos com velocidade ajustável. Salve a partida no localStorage a cada ação e permita desfazer dentro da própria vez. Priorize clareza: casas válidas destacadas, motivo visível para cada botão desabilitado, placar por fonte sempre acessível.
```

**Aceite:**
- Uma partida completa de 1 humano + 3 bots, do início ao fim, sem travar.
- Uma partida de 2 humanos + 2 bots no mesmo aparelho, com a vez claramente indicada.
- Recarregar a página continua a partida.
- Funciona numa tela de celular (380 px de largura) sem rolagem horizontal.

---

## Fase 5 — Exportar, reproduzir e registrar playtest

```
Adicione: exportar a partida como JSON (semente, configuração e lista de ações) e importar para reproduzir passo a passo; uma tela de fim de jogo com gráfico de pontos acumulados por ano; e um registro de playtest que salva, por ano, o tempo gasto, a carta, o preço e os pontos de cada jogador (o mesmo formato da tabela "Registro por ano" do dossiê), exportável em CSV.
```

**Aceite:** importar o JSON exportado reproduz exatamente a mesma partida; o CSV abre corretamente numa planilha.

---

## Fase 6 — Modo designer

```
Crie o modo designer de docs/INTERFACE.md: um painel que edita os números de regras.json em memória, com validação, permite começar uma partida com esses números, rodar 200 partidas só com bots e mostrar o resultado, e exportar o regras.json alterado.
```

**Aceite:** mudar `contratos.pontosPorCereal` de 3 para 2 e simular mostra o entregador vencendo menos.

---

## Fase 7 — Publicação

```
Prepare o projeto para publicação estática. Configure o build para o serviço que eu escolher (Vercel ou GitHub Pages), escreva no README o passo a passo de publicação e as instruções para jogar. Rode o build de produção e verifique que não há erros nem avisos de tipos.
```

**Aceite:** o site publicado abre num celular e num computador, e uma partida pode ser jogada do início ao fim.
