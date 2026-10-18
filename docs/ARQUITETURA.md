# Arquitetura

Aplicação web estática, sem servidor. Todo o jogo roda no navegador; o estado fica na memória e é salvo no `localStorage` para continuar depois.

## Stack

- Vite + React + TypeScript (modo `strict`).
- Vitest para testes.
- Tabuleiro desenhado em SVG (sem biblioteca de jogos ou canvas).
- Sem backend, sem login, sem banco de dados.
- Publicação estática (Vercel ou GitHub Pages).

## Princípio central: motor puro, interface burra

```
config/regras.json ──► src/engine (regras, puro, determinístico, testado)
                          ▲            │
              src/bots ───┘            ▼
                                   src/ui (React: só mostra o estado e envia ações)
```

- `src/engine` não importa React nem nada do navegador. Recebe estado + ação e devolve novo estado. Toda aleatoriedade vem de um gerador com semente guardado no estado (por exemplo mulberry32), para que uma partida possa ser reproduzida a partir da semente e da lista de ações.
- `src/bots` usa apenas a API pública do motor e devolve ações. Nunca altera o estado diretamente.
- `src/ui` nunca calcula regra. Para destacar casas válidas, custos ou botões habilitados, pergunta ao motor.
- Nenhum número de regra é escrito no código: tudo vem de `config/regras.json` (validado na carga).

## Pastas

```
config/            regras.json, bots.json (fonte da verdade dos números)
docs/              REGRAS, ARQUITETURA, BOTS, INTERFACE, PROMPTS, DECISOES
referencia/        simulador Python (só leitura, para consulta)
src/engine/
  config.ts        carrega e valida regras.json (tipos fortes)
  rng.ts           gerador com semente
  map.ts           coordenadas, vizinhança, margens (flood fill), terreno
  types.ts         GameState, PlayerState, Action, etc.
  setup.ts         nova partida, montagem guiada
  actions.ts       validar e aplicar cada ação
  year.ts          alocação, carta, preço, produção, alimentação, armazenagem
  scoring.ts       pontuação final, desempate, placar por fonte
  queries.ts       consultas para a UI e os bots (casas válidas, custos, conexões)
  index.ts         API pública
src/bots/
  helpers.ts       necessidadeMagra, excedente, melhorCasa…
  policy.ts        agirBot (porte de act_param)
  allocate.ts      alocação do bot
  setup.ts         montagem do bot
src/ui/            componentes React
scripts/sim.ts     simulação sem interface, para conferir os bots
tests/             testes do motor e dos bots
```

## Modelo de estado (sugestão)

```ts
type Coord = string // "C5"
type BuildingType = 'prefeitura' | 'residencia' | 'mercado' | 'campo' | 'pedreira' | 'armazem'

interface Tile { owner: number; type: BuildingType; evoluido: boolean }

interface PlayerState {
  id: number; nome: string; tipo: 'humano' | 'bot'; estrategiaBot?: string
  margem: 'oeste' | 'leste'
  ouro: number; pedra: number; cereal: number
  reserva: BuildingType[]
  alocacao: Coord[]             // edifícios com trabalhador neste ano
  placar: { alimentacao: number; fome: number; contratos: number; impressos: number; sobras: number }
  alimentadosUltimoAno: number
}

interface GameState {
  semente: number; rng: number
  ano: number                   // 1..14
  fase: 'montagem' | 'acoes' | 'alocacao' | 'resolucao' | 'fim'
  ordem: number[]; primeiro: number; volta: 1 | 2; vez: number
  jogadores: PlayerState[]
  tabuleiro: Record<Coord, Tile>
  demarcacoes: Record<Coord, number>
  estoque: Record<Exclude<BuildingType, 'prefeitura'>, number>
  preco: number; demandaCapital: number
  baralho: number[]; cartasReveladas: number[]
  log: LogEntry[]
}
```

## Ações (união discriminada)

```ts
type Action =
  | { tipo: 'construir'; edificio: BuildingType; casa: Coord; daReserva?: boolean }
  | { tipo: 'comerciar'; com: 'capital' | number; recurso: 'cereal' | 'pedra'; direcao: 'comprar' | 'vender'; quantidade: number }
  | { tipo: 'reservar'; edificio: BuildingType }
  | { tipo: 'demarcar'; casa: Coord }
  | { tipo: 'evoluir'; casa: Coord }
  | { tipo: 'entregar'; quantidade: number }
  | { tipo: 'passar' }
  | { tipo: 'alocar'; casas: Coord[] }          // fase de alocação
  | { tipo: 'montar'; edificio: BuildingType; casa: Coord } // fase de montagem
```

API: `aplicar(estado, jogador, acao) → { estado } | { erro: string }`. Erros em português, prontos para a interface.

## Persistência e reprodução

- Salvar a cada ação no `localStorage` (uma partida em andamento).
- Exportar a partida como JSON (semente + configuração + lista de ações) e importar para reproduzir.
- Desfazer: permitido para humanos dentro da própria vez (pilha de estados), nunca depois que outro jogador agiu.

## Desempenho

O motor precisa rodar 1000 partidas só com bots em poucos segundos no Node (`scripts/sim.ts`). Isso também serve de teste de estabilidade.
