// Simulação sem interface: npm run sim -- --partidas 1200 --mesa populoso,entregador,populoso,entregador [--semente 1]
// Sem --mesa, roda as três mesas de config/bots.json > referenciaDeResultados e compara.
import { estrategiaPorId, referenciaDeResultados } from '../src/bots'
import { media, simular, taxaVitoria, type Agregado, type ResultadoSimulacao } from '../src/bots/simulacao'
import type { Placar } from '../src/engine'

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const partidas = Number(argumento('partidas') ?? 1200)
const semente = Number(argumento('semente') ?? 1)
const mesaArg = argumento('mesa')

const pct = (x: number) => `${(100 * x).toFixed(1)}%`
const num = (x: number) => x.toFixed(1)
const fontes: [keyof Placar, string][] = [
  ['alimentacao', 'Alimentação'],
  ['fome', 'Fome'],
  ['contratos', 'Contratos'],
  ['impressos', 'PV impressos'],
  ['sobras', 'Sobras'],
]

function imprimir(res: ResultadoSimulacao, segundos: number) {
  console.log(`\nMesa: ${res.mesa.join(', ')} — ${res.partidas} partidas em ${segundos.toFixed(1)} s`)
  console.log(`Pontos médios (todos): ${num(res.pontosMedios)}\n`)
  const linhas: Record<string, string>[] = []
  for (const [id, a] of Object.entries(res.porEstrategia)) {
    linhas.push(linha(estrategiaPorId(id).nome, 'todas', a))
    for (const m of ['oeste', 'leste'] as const) linhas.push(linha(estrategiaPorId(id).nome, m, res.porEstrategiaEMargem[id]![m]))
  }
  console.table(linhas)
}

function linha(estrategia: string, margem: string, a: Agregado): Record<string, string> {
  const l: Record<string, string> = { Estratégia: estrategia, Margem: margem, Jogos: String(a.jogos), Vitórias: pct(taxaVitoria(a)), Pontos: num(media(a)) }
  for (const [k, nome] of fontes) l[nome] = num(a.placar[k] / a.jogos)
  return l
}

function rodar(mesa: string[]) {
  const t0 = performance.now()
  const res = simular(mesa, partidas, semente)
  const s = (performance.now() - t0) / 1000
  imprimir(res, s)
  return { res, s }
}

if (mesaArg) {
  rodar(mesaArg.split(',').map((x) => x.trim()))
} else {
  const TOL_PONTOS = 5
  const TOL_VIT = 0.06
  const comparacao: Record<string, string>[] = []
  const comparar = (mesa: string, medida: string, ref: number, obtido: number, tipo: 'pontos' | 'vitoria') => {
    const dentro = Math.abs(obtido - ref) <= (tipo === 'pontos' ? TOL_PONTOS : TOL_VIT)
    const f = tipo === 'pontos' ? num : pct
    comparacao.push({ Mesa: mesa, Medida: medida, Python: f(ref), TypeScript: f(obtido), Diferença: f(obtido - ref), Tolerância: dentro ? 'ok' : 'FORA' })
  }
  let tempo = 0

  const ref = referenciaDeResultados
  const a = rodar(['populoso', 'populoso', 'populoso', 'populoso'])
  tempo += a.s
  comparar('4 populosos', 'pontos médios', ref.mesa_4_populosos.pontosMedios, a.res.pontosMedios, 'pontos')
  comparar('4 populosos', 'vitórias oeste', ref.mesa_4_populosos.vitoriasPorMargem.oeste, taxaVitoria(a.res.porMargem.oeste), 'vitoria')
  comparar('4 populosos', 'vitórias leste', ref.mesa_4_populosos.vitoriasPorMargem.leste, taxaVitoria(a.res.porMargem.leste), 'vitoria')

  const b = rodar(['entregador', 'entregador', 'entregador', 'entregador'])
  tempo += b.s
  comparar('4 entregadores', 'pontos médios', ref.mesa_4_entregadores.pontosMedios, b.res.pontosMedios, 'pontos')
  comparar('4 entregadores', 'vitórias oeste', ref.mesa_4_entregadores.vitoriasPorMargem.oeste, taxaVitoria(b.res.porMargem.oeste), 'vitoria')
  comparar('4 entregadores', 'vitórias leste', ref.mesa_4_entregadores.vitoriasPorMargem.leste, taxaVitoria(b.res.porMargem.leste), 'vitoria')

  const c = rodar(['populoso', 'entregador', 'populoso', 'entregador'])
  tempo += c.s
  const r2 = ref.mesa_2_populosos_2_entregadores
  comparar('2 pop + 2 ent', 'pontos populoso', r2.pontosMedios.populoso, media(c.res.porEstrategia.populoso!), 'pontos')
  comparar('2 pop + 2 ent', 'pontos entregador', r2.pontosMedios.entregador, media(c.res.porEstrategia.entregador!), 'pontos')
  comparar('2 pop + 2 ent', 'vitórias populoso', r2.vitorias.populoso, taxaVitoria(c.res.porEstrategia.populoso!), 'vitoria')
  comparar('2 pop + 2 ent', 'vitórias entregador', r2.vitorias.entregador, taxaVitoria(c.res.porEstrategia.entregador!), 'vitoria')

  console.log(`\nComparação com referenciaDeResultados (tolerância ±${TOL_PONTOS} pontos, ±${TOL_VIT * 100} p.p.) — ${tempo.toFixed(1)} s no total`)
  console.table(comparacao)
}
