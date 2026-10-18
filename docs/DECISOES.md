# Registro de decisões

Toda dúvida de regra que surgir durante a implementação entra aqui antes de ser resolvida. Formato:

| Data | Tema | Opções | Decisão | Quem decidiu | Provisória? |
| --- | --- | --- | --- | --- | --- |
| 18/10/2026 | Preço entre jogadores | Negociado / preço da trilha | Preço da trilha, sem mover o marcador | Kit inicial | Sim |
| 18/10/2026 | Pedra na Capital | Compra fixa / compra e venda | Compra a 2; a Capital não compra pedra | Kit inicial | Sim |
| 18/10/2026 | Desempate | Vários | Alimentados no ano 14, depois cereal guardado | Kit inicial | Sim |
| 18/10/2026 | Distância mínima na montagem | Exigir 3 casas / livre | Livre para humanos; bots usam a heurística | Kit inicial | Sim |
| 18/10/2026 | Comércio de pedra com bots | Política detalhada / recusar | Ver docs/BOTS.md seção 7 | Kit inicial | Sim |
| 18/10/2026 | Margens por sorteio | Divisão equilibrada / qualquer divisão até 2 por margem | Equilibrada (2/2 com 4; 2/1 com 3; 1/1 com 2) | Fase 1 (aguarda Rodrigo) | Sim |
| 18/10/2026 | Ordem dentro de cada volta da montagem | Livre / fixa | Fixa, definida em `regras.json` → `montagem`: Prefeitura → Residência → Mercado; depois Campo → Pedreira (como o simulador) | Fase 1 (aguarda Rodrigo) | Sim |
| 18/10/2026 | Montagem na outra margem via várzea | Proibir / permitir | Permitido: a regra só exige conexão ao território (ex.: Pedreira ao lado de um Campo da várzea, na margem oposta), como no simulador | Fase 1 (aguarda Rodrigo) | Sim |
| 18/10/2026 | Jogador cercado na montagem (sem casa conectada válida) | Qualquer casa livre da própria margem / pular a colocação | Qualquer casa livre da própria margem (acontece, por exemplo, ao abrir no canto A1) | Fase 1 (aguarda Rodrigo) | Sim |
| 18/10/2026 | Limite de demarcações (`demarcacaoMaxima`) | Por jogador / no tabuleiro inteiro | Por jogador (como a reserva) | Fase 2 (aguarda Rodrigo) | Sim |
| 18/10/2026 | Aceite do parceiro no comércio entre jogadores | Motor pergunta / quem chama pergunta | O motor só aplica a troca e confere se o parceiro tem o recurso ou o ouro; a interface pergunta ao humano e o bot decide (Fase 3) | Fase 2 | Sim |
| 18/10/2026 | Fase de resolução do ano | Pausa com ação "avançar" / automática | Automática: o último a alocar resolve o ano e já abre o próximo; o resumo fica em `resumos` para a interface mostrar | Fase 2 | Sim |
| 18/10/2026 | Alimentação com consumo ≠ 1 | Fórmula do documento / por trabalhador | Alimentados = min(W, ⌊cereal ÷ consumo⌋). Com consumo 1 (valor atual) é igual à fórmula de REGRAS.md | Fase 2 | Sim |
| 18/10/2026 | `tilesVisiveisPorTipo` (2) em regras.json | — | Não aparece em REGRAS.md; sem uso no motor até o Rodrigo explicar | Fase 2 (aguarda Rodrigo) | Sim |
| 18/10/2026 | Limites de jogadores e sequência da montagem no JSON | — | Adicionados `jogadores` (2 a 4) e `montagem` ao `regras.json`, com validação | Fase 1 | Não |
