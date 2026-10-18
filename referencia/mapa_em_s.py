"""
REFERÊNCIA, NÃO EXECUTAR NO APP.
Script de análise usado para testar o mapa em S. Depende de módulos de pesquisa que não estão no kit.
Partes relevantes para o porte:
  - definição do mapa (LOW, RIVER, ROCK, margens por flood fill, coordenadas x = coluna, y = linha - 1);
  - regra da várzea (best_cell: só Campo pode ocupar casa de rio);
  - montagem do bot (make_setup: Prefeitura na própria margem, distância >= 3, nota por várzea/rocha/Capital).
"""
import sys, json, statistics as st; sys.path.insert(0, '/home/claude')
from collections import defaultdict, Counter
import simulador_jose_no_egito_v8 as S, ga_jose8 as G, avalia_ga8 as Av
man = S.man
# x = coluna (A=0), y = linha - 1
LOW = [(2,0),(2,1),(3,1),(4,1),(5,1),(5,2),(5,3)]
RIVER = set(LOW) | {(7 - x, 7 - y) for x, y in LOW}
CAP = {(3,3),(3,4),(4,3),(4,4)}
ROCK = {(0,0),(1,0),(0,1),(7,0),(6,0),(7,1),(0,7),(0,6),(1,7),(7,7),(6,7),(7,6)} - RIVER
def region(seed):
    seen, stack = set(), [seed]
    while stack:
        c = stack.pop()
        if c in seen or c in RIVER or c in CAP or not (0 <= c[0] < 8 and 0 <= c[1] < 8): continue
        seen.add(c); x, y = c; stack += [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]
    return seen
W, E = region((0,7)), region((7,0))
assert len(W) == len(E) == 23 and len(RIVER) == 14, (len(W), len(E), len(RIVER))
POCKET_W = {c for c in W if c[1] <= 3}
POCKET = POCKET_W | {(7 - x, 7 - y) for x, y in POCKET_W}
# Várzea: só Campo pode ocupar casa de rio
orig_best = S.Game.best_cell
def best_cell(g, p, t, cells=None):
    cells = cells if cells is not None else g.expansion(p)
    if t != 'campo':
        cells = {c for c in cells if c not in RIVER}
    return orig_best(g, p, t, cells) if cells else None
S.Game.best_cell = best_cell
def make_setup(w_seats):
    def setup(g):
        P = g.P; allc = [(x, y) for x in range(8) for y in range(8)]
        for p in g.players:
            bank = W if p.id in w_seats else E
            cand = [c for c in bank if g.is_free(c) and all(man(c, o) >= 3 for o in g.owner)] or [c for c in bank if g.is_free(c)]
            def sc(c):
                v = sum((2 if k in RIVER else 1.5 if k in ROCK else 0) for k in allc if man(c, k) <= 2)
                v += p.cfg['capital_w'] * 0.5 * (4 - g.dcap(c))
                if c in ROCK: v -= 1
                return v + g.rng.random() * 0.01
            c0 = max(cand, key=sc); p.st['inicio'] = 'metade perto da Capital' if c0 in POCKET else 'metade longe da Capital'
            g.place(p, 'prefeitura', c0); g.place(p, 'cidade', g.best_cell(p, 'cidade')); g.place(p, 'mercado', g.best_cell(p, 'mercado'))
        for p in reversed(g.players):
            for t in ('campo', 'pedreira'):
                c = g.best_cell(p, t)
                if c: g.place(p, t, c)
    return setup
P = Av.rules('combo'); P['RIVER'] = RIVER; P['ROCK'] = ROCK
ch = {k: json.load(open(f"/home/claude/ga8_combo_{sd}.json"))['top'][0]['cfg'] for k, sd in (('Populoso', 11), ('Entregador', 33))}
PATTERNS = [{0, 1}, {2, 3}, {0, 2}, {1, 3}, {0, 3}, {1, 2}]
print("Mapa: margens oeste e leste com 23 casas cada; rio com 14 casas (só Campos); 6 rochas por margem.\n")
for title, lineup in (("4 Populosos", ['Populoso'] * 4), ("4 Entregadores", ['Entregador'] * 4), ("2 Populosos + 2 Entregadores", ['Populoso', 'Entregador', 'Populoso', 'Entregador'])):
    agg = defaultdict(lambda: defaultdict(list)); wins = Counter(); cnt = Counter(); occ = defaultdict(list)
    for i in range(1200):
        w_seats = PATTERNS[i % 6]; S.Game.setup = make_setup(w_seats)
        g, o = G.play([ch[k] for k in lineup], 800_000 + i, P)
        sc = [x[0] for x in o]; b = max(sc); win = [k for k, s in enumerate(sc) if s == b]
        for k, (s, p) in enumerate(o):
            side = 'oeste' if k in w_seats else 'leste'
            for key in ((side, lineup[k]), ('início: ' + p.st['inicio'], lineup[k])):
                cnt[key] += 1; wins[key] += (1 / len(win)) if k in win else 0
                a = agg[key]; a['pts'].append(s); a['ed'].append(len(p.b) - 1); a['res'].append(p.count('cidade'))
                a['rio'].append(sum(1 for c in p.b if c in RIVER)); a['sem'].append(p.st.get('sem_espaco', 0))
                a['outra'].append(sum(1 for c in p.b if c in (E if side == 'oeste' else W)))
                a['conn'].append(p.st.get('conn_round', 15)); a['ctr'].append(p.br['contratos']); a['alim'].append(p.br['alimentados'])
                a['passa'].append(p.st.get('acao_passa', 0)); a['fome'].append(p.br['fome'])
        occ['margens'].append(sum(1 for c in W | E if c in g.owner) / 46); occ['rio'].append(sum(1 for c in RIVER if c in g.owner) / 14)
    print(f"## {title}  (1200 partidas)\n")
    print("| Grupo | Estilo | Vitórias | Pontos | Edifícios | Resid. | Campos no rio | Na outra margem | Conecta à Capital (ano) | Contratos | Fome | Falta de espaço | Ações passadas |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for key in sorted(cnt, key=lambda k: (k[0].startswith('início'), k)):
        a = agg[key]; m = lambda x: st.mean(a[x])
        conn = [c for c in a['conn'] if c < 15]
        cs = f"{st.mean(conn):.1f} ({100*len(conn)/len(a['conn']):.0f}%)" if conn else "nunca"
        print(f"| {key[0]} | {key[1]} | {100*wins[key]/cnt[key]:.0f}% | {m('pts'):.0f} | {m('ed'):.1f} | {m('res'):.1f} | {m('rio'):.1f} | {m('outra'):.1f} | {cs} | {m('ctr'):.0f} | {m('fome'):.0f} | {m('sem'):.1f} | {m('passa'):.1f} |")
    print(f"\nOcupação final: margens {100*st.mean(occ['margens']):.0f}% das 46 casas · rio {100*st.mean(occ['rio']):.0f}% das 14 casas\n", flush=True)
