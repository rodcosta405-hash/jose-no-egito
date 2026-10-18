# José no Egito — versão digital para playtest

Jogo de tabuleiro em desenvolvimento por Rodrigo (designer). Esta aplicação web serve para jogar o protótipo no mesmo aparelho (passa e joga), com bots ocupando as vagas vazias. Não é o produto final: o objetivo é testar regras rapidamente.

## Documentos (leia antes de mexer na área correspondente)

- `docs/REGRAS.md`: regras completas para implementação. Fonte da verdade do procedimento.
- `config/regras.json`: todos os números do jogo. Fonte da verdade dos valores.
- `docs/ARQUITETURA.md`: stack, pastas, modelo de estado e ações.
- `docs/BOTS.md` e `config/bots.json`: política dos bots e parâmetros treinados.
- `docs/INTERFACE.md`: telas e comportamento esperado.
- `docs/PROMPTS.md`: plano de fases (o Rodrigo vai pedir uma fase por vez).
- `docs/DECISOES.md`: registro de decisões tomadas durante a implementação.
- `referencia/`: simulador Python original, só para consulta. Não executar no app, não portar o código de análise.

## Regras de trabalho

- **Nunca invente regra.** Se `docs/REGRAS.md` não cobrir um caso, pare, registre a dúvida em `docs/DECISOES.md` com as opções e pergunte ao Rodrigo. Até ele responder, use a opção mais simples e marque-a como provisória.
- **Nenhum número de regra no código.** Custos, produções, pontos, tamanhos do mapa, cartas e limites vêm sempre de `config/regras.json`. Se um número novo for necessário, adicione ao JSON e ao validador.
- **Motor puro.** `src/engine` não importa React nem APIs do navegador. Funções recebem estado e ação e devolvem novo estado, sem mutar a entrada. Toda aleatoriedade vem do gerador com semente guardado no estado.
- **Interface sem regras.** `src/ui` só mostra o estado e envia ações. Para saber o que é válido, consulta `src/engine/queries.ts`.
- **Bots via API pública.** `src/bots` só lê o estado e devolve ações; nunca altera o estado direto.
- **Testes junto com cada regra.** Toda regra nova ou corrigida vem com teste em `tests/`. Rode `npm test` antes de dizer que terminou.
- **Erros em português**, curtos e úteis para o jogador ("Só Campos podem ser construídos na várzea").
- Uma fase de `docs/PROMPTS.md` por vez. Não adiante funcionalidades de fases futuras.

## Termos do domínio

- Ouro, pedra, cereal: recursos. "Dinheiro" não é usado.
- Residência (dá 2 trabalhadores), Mercado (ouro, exige trabalhador), Campo (cereal, exige trabalhador), Pedreira (pedra, exige trabalhador), Armazém (capacidade de cereal), Prefeitura (inicial, capacidade 5).
- Verso evoluído: Vila Nobre, Grande Mercado, Campo Irrigado, Pedreira Profunda, Celeiro Real.
- Várzea: casas do Nilo; só aceitam Campos.
- Margens oeste e leste: as duas metades do mapa separadas pelo Nilo.
- Anos gordos (1–7) e magros (8–14). Contratos de José: entregar cereal à Capital nos anos magros.
- PV: pontos de vitória impressos nos tiles.

## Comandos

- `npm run dev`: servidor local.
- `npm test`: testes.
- `npm run build`: build de produção.
- `npm run sim -- --partidas 1000`: partidas só com bots, sem interface.

## Interface

- Todo texto visível em português do Brasil.
- Deve funcionar em celular (a partir de 380 px de largura) e computador.
- Clareza acima de estética: é um protótipo de playtest.
