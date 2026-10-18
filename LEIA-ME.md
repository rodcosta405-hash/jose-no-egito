# Kit: José no Egito digital

Este kit prepara um repositório para o Claude Code construir a versão digital do jogo: passa e joga no mesmo aparelho, com bots nas vagas vazias, publicada como site estático.

## O que tem aqui

| Arquivo | Para quê |
| --- | --- |
| `CLAUDE.md` | Instruções permanentes do projeto. O Claude Code lê este arquivo no início de cada sessão. |
| `docs/REGRAS.md` | Regras completas, escritas para implementação. |
| `config/regras.json` | Todos os números do jogo, num lugar só. |
| `docs/ARQUITETURA.md` | Stack, pastas, modelo de estado. |
| `docs/BOTS.md` + `config/bots.json` | Os bots treinados nas simulações. |
| `docs/INTERFACE.md` | Telas e comportamento esperado. |
| `docs/PROMPTS.md` | Os prompts, uma fase por vez, com critérios de aceite. |
| `docs/DECISOES.md` | Onde ficam as dúvidas de regra que aparecerem no caminho. |
| `referencia/` | O simulador Python original, só para consulta. |

## Como usar

1. Crie uma pasta nova e copie todo o conteúdo do kit para ela. Se quiser versionar (recomendado), transforme-a num repositório no GitHub.
2. Abra o Claude Code nessa pasta. Se ainda não tem o Claude Code instalado, a documentação oficial está em https://docs.claude.com/en/docs/claude-code/overview.
3. Abra `docs/PROMPTS.md` e cole o prompt da **Fase 0**.
4. Ao fim de cada fase, confira os critérios de aceite, jogue um pouco, faça um commit e só então cole o prompt da próxima fase.
5. Na **Fase 7**, escolha onde publicar. Vercel e GitHub Pages servem bem, porque o jogo é um site estático, sem servidor.

## Três conselhos

- **Não pule a Fase 3** (bots e simulação sem interface). Ela confere que o motor em TypeScript se comporta como o simulador que calibrou o jogo. Se os números não baterem, há erro de regra, e é muito mais fácil achar antes da interface existir.
- **Quando o Claude Code perguntar sobre uma regra, decida você.** O kit proíbe que ele invente regras; as dúvidas vão para `docs/DECISOES.md`.
- **Mudou uma regra no design?** Atualize primeiro `docs/REGRAS.md` e `config/regras.json` e depois peça ao Claude Code para alinhar o código e os testes. A ordem importa: os documentos são a fonte da verdade.

## O que o kit já decidiu por você (provisório)

Estes pontos estavam em aberto no dossiê. O kit escolheu a opção mais simples para o app funcionar; todos estão em `docs/DECISOES.md` e podem ser trocados:

- Comércio entre jogadores ao preço atual da trilha.
- A Capital vende pedra a 2 ouros e não compra pedra.
- Desempate: mais trabalhadores alimentados no ano 14, depois mais cereal guardado.
- Sem distância mínima obrigatória na montagem para humanos.
