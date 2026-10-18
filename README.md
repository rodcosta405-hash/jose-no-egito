# José no Egito — versão digital para playtest

Protótipo do jogo de tabuleiro *José no Egito* para testar regras: 2 a 4 jogadores no mesmo aparelho (passa e joga), com bots nas vagas vazias. Funciona no computador e no celular, sem servidor nem login: o jogo roda inteiro no navegador.

## Como jogar

1. Abra o site e, em **Nova partida**, escolha quantos jogadores, quem é humano e quem é bot (Populoso, Entregador ou Entregador cauteloso), as margens e, se quiser repetir uma partida, a semente.
2. **Montagem:** cada jogador coloca Prefeitura, Residência e Mercado; na volta inversa, Campo e Pedreira. As casas válidas ficam destacadas no tabuleiro.
3. **Cada ano:** duas voltas de ações (Construir, Comerciar, Reservar, Demarcar, Evoluir, Entregar, Passar). Os botões indisponíveis mostram o motivo ao tocar. Depois, cada jogador toca nos seus Campos, Pedreiras e Mercados para alocar trabalhadores.
4. **Resumo do ano:** carta revelada e tabela de produção, alimentação e pontos. Toque em **Continuar** para seguir.
5. **Fim de jogo:** classificação com placar por fonte e gráfico dos pontos ano a ano.

As **Regras rápidas** estão na tela inicial. As regras completas ficam em [`docs/REGRAS.md`](docs/REGRAS.md).

### Recursos para o playtest

- **Desfazer:** o humano desfaz as próprias ações até outro jogador agir.
- **Partida salva:** recarregar a página continua a partida. O botão **Menu** volta à tela inicial sem perder a partida.
- **Velocidade dos bots:** lenta, normal ou instantânea.
- **Exportar partida (JSON):** semente, configuração, ações e regras usadas. **Reproduzir partida** (na tela inicial) refaz a partida ação por ação.
- **Registro de playtest (CSV):** por ano, tempo gasto, carta, preço e pontos de cada jogador. Abre em planilhas em português (separador `;`).
- **Modo designer** (na tela inicial): muda os números das regras, simula 200 partidas só com bots comparando com as regras padrão, começa uma partida com as regras novas e exporta o `regras.json` alterado.

## Desenvolvimento

Requer Node.js 20 ou mais novo.

```bash
npm install
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor local com recarga automática |
| `npm test` | testes do motor, dos bots e da interface |
| `npm run build` | confere os tipos e gera o site em `dist/` |
| `npm run preview` | serve o `dist/` gerado, como será publicado |
| `npm run sim -- --partidas 1200` | partidas só com bots e comparação com `config/bots.json` |
| `npm run sim -- --partidas 500 --mesa populoso,entregador` | simula uma mesa específica |

Estrutura e regras de trabalho do projeto: [`CLAUDE.md`](CLAUDE.md) e [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md). Decisões de regra tomadas durante a implementação: [`docs/DECISOES.md`](docs/DECISOES.md).

## Publicação no GitHub Pages

O site é estático. A publicação é automática: a cada push na branch `main`, o GitHub Actions ([`.github/workflows/publicar.yml`](.github/workflows/publicar.yml)) roda os testes, gera o build e publica. Se algum teste falhar, nada é publicado.

### Primeira vez

1. No GitHub, crie um repositório novo e vazio (sem README nem .gitignore), por exemplo `jose-no-egito`. Pode ser público ou privado. Repositórios privados só publicam no Pages em planos pagos do GitHub.
2. Na pasta do projeto, ligue o repositório local ao GitHub e envie:

   ```bash
   git remote add origin https://github.com/SEU-USUARIO/jose-no-egito.git
   ```

   ```bash
   git push -u origin main
   ```

3. No repositório, abra **Settings → Pages** e, em **Build and deployment → Source**, escolha **GitHub Actions**.
4. Abra a aba **Actions**. Se a primeira execução falhou porque o Pages ainda não estava ativo, clique em **Publicar no GitHub Pages → Run workflow**.
5. Quando terminar (1 a 2 minutos), o endereço aparece no resumo da execução e em Settings → Pages: `https://SEU-USUARIO.github.io/jose-no-egito/`.

### Depois

Faça commits normalmente e `git push`: cada push na `main` publica a nova versão em poucos minutos.

### Observações

- O build usa caminhos relativos (`base: './'` em `vite.config.ts`), por isso funciona com qualquer nome de repositório.
- As partidas ficam salvas só no navegador de cada pessoa (`localStorage`), nunca no servidor. Para levar uma partida a outro aparelho, use **Exportar partida (JSON)** e **Reproduzir partida**.
