# Referência (Python)

Arquivos do simulador usado para calibrar o jogo. Servem só para consulta durante o porte dos bots.

- `simulador_jose_no_egito_v8.py`: motor e bots. Nomes internos: `cidade` = Residência, `RIVER` = várzea, `ROCK` = rochas. A política dos bots treinados é `act_param`; a alocação é `allocate`. O mapa padrão deste arquivo é o antigo (dois rios); o mapa em S está em `mapa_em_s.py`.
- `mapa_em_s.py`: definição do mapa em S, regra da várzea e montagem dos bots usadas nos testes finais.

Diferenças conhecidas em relação a `docs/REGRAS.md` (o documento vale):
- O simulador não implementa Reservar nem a negociação com humanos.
- O simulador não limita o estoque de tiles.
- Na montagem, o simulador coloca Residência e Mercado na primeira volta e Campo e Pedreira na segunda, como nas regras.
