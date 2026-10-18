# Bots — porte da estratégia treinada

Os bots são a política parametrizada `act_param` do simulador Python (`referencia/simulador_jose_no_egito_v8.py`), com os parâmetros de `config/bots.json`. Porte fiel: mesma ordem de decisões, mesmas fórmulas. Diferenças de RNG entre Python e TypeScript são esperadas; o critério de aceite é estatístico (ver `bots.json` → `referenciaDeResultados`).

Mapeamento de nomes do Python: `cidade` = Residência, `mercado` = Mercado, `campo`, `pedreira`, `armazem`, `prefeitura`. `RIVER` = várzea, `ROCK` = rochas.

## 1. Funções auxiliares

- `W(p)` = 2 × Residências.
- `slots(p)` = edifícios que exigem trabalhador (Campos, Pedreiras, Mercados). `spare = W − |slots|`.
- `cap(p)` = capacidade de cereal.
- `anosMagrosRestantes` = 7 se o ano atual ≤ 7; senão 14 − ano + 1.
- `taxaMagra(modo)` = média das cartas magras (0,5) no modo `media`; mínimo (0) no modo `pess`.
- `prodMagra(p, W, modo)`: ordene os Campos com os da várzea primeiro; pegue os k = min(W, nº de Campos) primeiros; some `taxaMagra(modo) + bonusVarzeaAnosMagros` (0) para cada.
- `necessidadeMagra(p, extraW = 0, modo = 'media')` = max(0, anosMagrosRestantes × ((W + extraW) − prodMagra(p, W + extraW, modo))).
- `alvoEstoque(p)` = `store` × necessidadeMagra(p, 0, 'media').
- `excedente(q)` (quanto um vizinho bot aceita vender): nos anos gordos, max(0, ⌊cereal − alvoEstoque(q)⌋); nos magros, max(0, ⌊cereal − necessidadeMagra(q, 0, 'pess')⌋).

## 2. Escolha de casa (`melhorCasa`)

Candidatas: casas de expansão (livres, vizinhas de edifício seu ou demarcadas por você), excluindo várzea se o tipo não for Campo. Nota de cada casa c:

```
nota = rng() × 0.01
se tipo == campo e c na várzea: +3
se tipo == pedreira e c em rocha: +3
se tipo em {residencia, mercado, armazem, prefeitura} e c em várzea ou rocha: −1
se o jogador ainda não está conectado à Capital: + capital_w × (4 − distManhattanAteACapital(c))
+ 0.2 × (nº de vizinhos livres de c)
```

Escolha a maior nota. Sem candidatas: a construção falha (conte como "falta de espaço").

## 3. Tentativa de construir (`tentar(tipo)`)

1. Se pode pagar o custo (com escalada da Residência): construa na `melhorCasa`, retorne sucesso.
2. Senão, se o custo tem pedra e falta pedra, e após pagar o ouro do edifício sobra ouro para comprar a pedra que falta a 2 cada, e está conectado à Capital: compre a pedra que falta (isso consome a ação), retorne "comprou pedra".
3. Senão, falha.

## 4. Decisão de ação (`agirBot`)

Parâmetros: `res_t, mk_t, cp_t, pd_t, stop_res, upg_from, lean_buy, sell_min, store_from, store, keep, keep_c, order, fat_fill, mk_first, use_c, capital_w`.

```
se ano magro:
    esperado = prodMagra(p, W, 'media')
    falta = round(W − (cereal + esperado))
    se falta > 0 e comprarCereal(p, falta, lean_buy): retorne
    se use_c:
        extra = ⌊cereal − keep_c × necessidadeMagra(p)⌋
        se extra > 0 e entregar(p, extra): retorne
    sobra = ⌊cereal − keep × necessidadeMagra(p)⌋
    se sobra > 0 e preço ≥ sell_min e venderCereal(p, sobra, sell_min): retorne
senão (ano gordo):
    prodMin = Σ (min(cartas gordas) + bônus várzea) dos Campos atualmente alocados
    transborda = ⌊cereal + prodMin − W − cap⌋
    se transborda > 0 e venderCereal(p, transborda, 1): retorne
    se ano ≥ store_from e cap < store × necessidadeMagra(p): se tentar(armazem): retorne

para k em order:
    res: se Residências < res_t e ano ≤ stop_res: tentar(residencia)
    mk:  se Mercados < mk_t e spare > 0: tentar(mercado)
    cp:  se Campos < cp_t e spare > 0: primeiro tente construir na várzea (só casas de várzea), senão tentar(campo)
    pd:  se Pedreiras < pd_t e spare > 0: tentar(pedreira)
    upg: se ano ≥ upg_from: evoluir(p, reserva) onde reserva = 0 nos gordos e
         max(0, ⌊W − prodMagra(p, W) − cereal⌋) × preço nos magros
    se alguma ação aconteceu: retorne

se ano gordo e fat_fill e ano ≥ 4:
    quer = ⌊min(store × necessidadeMagra(p), cap) − cereal⌋
    se quer > 0 e comprarCereal(p, quer, 3): retorne
passar
```

### comprarCereal(p, qtd, teto)
1. Procure o vizinho conectado com maior `excedente`. Se existir, preço ≤ teto: compre dele até qtd, ao preço da trilha (sem mover), enquanto houver ouro e excedente. Se comprou algo, termine (vale a ação).
2. Senão, se conectado à Capital: para cada unidade, novo = min(preço + 1, máx); pare se novo > teto ou ouro < novo; pague e mova o marcador.
3. Retorne se comprou algo.

### venderCereal(p, qtd, precoMinimo)
Só com a Capital. Para cada unidade: novo = max(preço − 1, mín); pare se novo < precoMinimo; receba e mova o marcador.

### entregar(p, qtd)
Ano magro, conectado à Capital: q = min(qtd, demanda restante, cereal); se q > 0, aplique a ação Entregar.

### evoluir(p, reservaOuro)
Candidatos: edifícios evoluíveis não evoluídos, ordenados por tipo (Mercado, Pedreira, Residência, Armazém, Campo) e, dentro do tipo, alocados primeiro. Nos anos magros, pule Campos sem trabalhador. Evolua o primeiro em que ouro − reservaOuro ≥ custo em ouro e pedra ≥ custo em pedra.

## 5. Alocação do bot

```
W trabalhadores livres
campos ordenados (várzea primeiro); pedreiras ordenadas (rocha primeiro)
estoqueProjetado = cereal − W; capacidade = cap
1. se mk_first: aloque em todos os Mercados possíveis
2. para cada Campo: pare se acabaram trabalhadores ou (ano gordo e estoqueProjetado ≥ capacidade);
   aloque e some (média das cartas da fase + bônus de várzea da fase) ao estoqueProjetado
3. Mercados ainda sem trabalhador
4. Pedreiras
5. Campos ainda sem trabalhador
```

## 6. Montagem do bot

- Prefeitura: entre as casas livres da margem do bot, que não sejam várzea, prefira as que estão a distância Manhattan ≥ 3 de qualquer edifício já colocado (se nenhuma, aceite qualquer). Nota:
  `Σ (2 por casa de várzea, 1,5 por rocha) num raio Manhattan ≤ 2` + `capital_w × 0,5 × (4 − distânciaÀCapital)` − 1 se a casa for rocha + `rng() × 0,01`.
- Residência e Mercado: `melhorCasa`.
- Segunda volta: Campo e Pedreira por `melhorCasa`.

## 7. Bot como parceiro de comércio de um humano

- Humano quer **comprar** cereal de um bot: o bot vende até `excedente(bot)` ao preço da trilha.
- Humano quer **vender** cereal a um bot: o bot compra se, nos anos magros, o preço atual ≤ `lean_buy` e o cereal dele for menor que a necessidade do ano; nos anos gordos, recusa.
- Pedra: o bot vende pedra acima de 4 unidades guardadas; compra se tiver ouro sobrando acima do custo do próximo edifício planejado. Se for complicado, comece recusando todo comércio de pedra e registre em DECISOES.md.

## 8. Conferência

Script headless `npm run sim -- --partidas 1200 --mesa populoso,entregador,populoso,entregador` deve imprimir vitórias e pontos médios por estratégia e por margem, e o placar por fonte. Compare com `config/bots.json` → `referenciaDeResultados`.
