# Interface

Objetivo: um protótipo jogável e legível para playtest, não a arte final. Tudo em português. Funciona no computador e no celular.

## Telas

### 1. Nova partida
- Número de jogadores: 2 a 4 (aviso: "calibrado para 4").
- Para cada vaga: nome, humano ou bot, estratégia do bot (Populoso, Entregador, Entregador cauteloso).
- Margens: sorteio (padrão) ou escolha manual, no máximo 2 por margem.
- Semente opcional (para repetir uma partida).
- Botões: "Começar", "Continuar partida salva", "Regras rápidas".

### 2. Montagem
- Guia passo a passo: "Jogador 2, coloque sua Prefeitura na margem leste".
- Casas válidas destacadas; as demais desabilitadas.
- Bots colocam sozinhos, com uma pequena pausa para acompanhar.

### 3. Mesa (tela principal)
- **Cabeçalho:** ano X de 14, fase (gorda ou magra) com cor distinta, preço do cereal na trilha 1–10 com as âncoras marcadas, demanda da Capital (só na fome), cartas já reveladas e faixa de valores da fase.
- **Tabuleiro SVG:** várzea, rochas, planície, Capital; edifícios com a cor e um padrão do dono (não só cor); edifícios evoluídos com marca visível; trabalhadores alocados; demarcações; casas válidas destacadas quando o jogador escolhe uma ação.
- **Painel do jogador da vez:** ouro, pedra, cereal (com capacidade, ex.: 12/15), trabalhadores (alocados/total), reserva, ações restantes no ano, pontos e placar por fonte.
- **Resumo dos outros jogadores:** recursos, pontos, conexão com a Capital.
- **Barra de ações:** Construir, Comerciar, Reservar, Demarcar, Evoluir, Entregar, Passar. Botões indisponíveis mostram o motivo ao tocar (por exemplo, "Só nos anos magros").
- **Histórico:** lista das ações do ano, com filtro por jogador.

### 4. Alocação
- Cada humano clica nos seus Campos, Pedreiras e Mercados para pôr ou tirar trabalhador. Contador "4 de 6 trabalhadores".
- Começa com a alocação do ano anterior.
- Mostra a previsão: "Se a carta for média, você terá X cereais; precisa de Y para alimentar todos".

### 5. Resolução do ano
- Revela a carta com destaque.
- Tabela por jogador: produção, alimentados, sem comida, pontos do ano, cereal descartado.
- Na virada do ano 7 para o 8: aviso claro de que a fome começou.
- O motor já abre o ano seguinte; a interface mostra o resumo (`estado.resumos`) e só libera a próxima volta de ações depois de uma confirmação ("Continuar").

### 6. Fim de jogo
- Classificação com placar por fonte (alimentação, fome, contratos, PV impressos, sobras) e critério de desempate usado.
- Gráfico da pontuação acumulada ano a ano.
- Botões: "Nova partida", "Exportar partida (JSON)".

## Comportamento dos bots
- Velocidade ajustável: lenta (1 s por ação), normal (0,4 s), instantânea.
- Cada ação do bot aparece no histórico com uma frase curta: "Entregador construiu Armazém em G4".

## Modo designer (fase posterior)
- Painel que edita os números de `regras.json` em memória (com validação), inicia uma partida com eles e exporta o JSON alterado.
- Botão "Simular 200 partidas só com bots" que mostra vitórias e pontos médios por estratégia.

## Acessibilidade e legibilidade
- Cores de jogador sempre acompanhadas de padrão ou letra.
- Tamanho mínimo de toque de 44 px no celular.
- Contraste adequado; nada depende só de cor.
- Números sempre visíveis, sem precisar passar o mouse.
