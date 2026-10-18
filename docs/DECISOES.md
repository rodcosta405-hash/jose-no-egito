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
| 18/10/2026 | Limite de demarcações (`demarcacaoMaxima`) | Por jogador / no tabuleiro inteiro | Por jogador: no máximo 2 marcadores de cada jogador no tabuleiro ao mesmo tempo | Rodrigo | Não |
| 18/10/2026 | Aceite do parceiro no comércio entre jogadores | Motor pergunta / quem chama pergunta | O motor só aplica a troca; a interface pergunta ao humano e o bot decide (Fase 3). O motor valida os dois lados (vendedor tem o recurso, comprador tem o ouro) e devolve erro em português se faltar | Rodrigo | Não |
| 18/10/2026 | Fase de resolução do ano | Pausa com ação "avançar" / automática | Automática no motor: o último a alocar resolve o ano e abre o próximo. O resumo completo do ano fica em `resumos` (carta e, por jogador: produção, alimentados, sem comida, pontos do ano e cereal descartado). A interface mostra esse resumo e espera uma confirmação antes da próxima volta de ações | Rodrigo | Não |
| 18/10/2026 | Alimentação com consumo ≠ 1 | Fórmula do documento / por trabalhador | Alimentados = min(W, ⌊cereal ÷ consumo⌋); o cereal gasto é alimentados × consumo. Com consumo 1 (valor atual) é igual à fórmula de REGRAS.md | Rodrigo | Não |
| 18/10/2026 | `tilesVisiveisPorTipo` (2) em regras.json | — | Reservado para quando existirem variantes de tile dentro de cada tipo. Hoje os tiles de um tipo são idênticos, então não tem efeito: fica no JSON, sem uso no motor | Rodrigo | Não |
| 18/10/2026 | Limites de jogadores e sequência da montagem no JSON | — | Adicionados `jogadores` (2 a 4) e `montagem` ao `regras.json`, com validação | Fase 1 | Não |
