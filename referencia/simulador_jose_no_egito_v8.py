#!/usr/bin/env python3
"""
Motor de simulação — José no Egito
Parâmetros provisórios definidos em 18/10/2026.

Premissas que NÃO foram decididas pelo designer e estão marcadas como [PREMISSA]:
- Mapa: rio nas colunas 3 e 6 (x=2 e x=5), rochas nos 4 cantos (3 casas cada).
- Pedra com a Capital a preço fixo (compra a 2 ouro).
- Comércio entre jogadores ao preço atual da trilha (sem mover o marcador).
- Mercado com oferta ilimitada e tiles iguais por tipo (sem variantes).
- Conexão = adjacência ortogonal (lados, sem diagonais).
- Escolha de posição inicial em serpente: Prefeitura+Cidade (1→4), Campo+Pedreira (4→1).
"""
import random
import statistics as st
import sys
from collections import Counter, defaultdict
from copy import deepcopy

BASE = dict(
    N=8,
    CAPITAL={(3, 3), (3, 4), (4, 3), (4, 4)},
    RIVER={(x, y) for x in (2, 5) for y in range(8)},
    ROCK={(0, 0), (1, 0), (0, 1), (7, 0), (6, 0), (7, 1),
          (0, 7), (0, 6), (1, 7), (7, 7), (6, 7), (7, 6)},
    START={'gold': 3, 'stone': 2, 'grain': 2},
    PREF_CAP=5, ARM_CAP=5,
    COST={'cidade': {'gold': 2, 'stone': 2}, 'mercado': {'gold': 3, 'stone': 1}, 'campo': {'gold': 2},
          'pedreira': {'gold': 2}, 'armazem': {'gold': 2, 'stone': 2}},
    PV={'prefeitura': 0, 'cidade': 1, 'mercado': 2, 'campo': 1, 'pedreira': 1, 'armazem': 1},
    CITY_GOLD=2, CITY_WORKERS=2, QUARRY=2, ROCK_BONUS=1, RIVER_BONUS=1, RIVER_LEAN_BONUS=0,
    FAT_POOL=[3, 3, 3, 4, 4, 4, 4, 5, 5, 5],
    LEAN_POOL=[0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
    PRICE_START=4, PRICE_MIN=1, PRICE_MAX=10, FAT_SHIFT=-1, LEAN_SHIFT=1, FAT_ANCHOR=2, LEAN_ANCHOR=7,
    STONE_BUY=2,
    FED=1, UNFED=-2,
    END_GOLD=4, END_GRAIN=2, END_STONE=4,
    ACTIONS=2, MAX_DEMARC=2, DEMARC_COST=1,
    ROUNDS=14, FAT_ROUNDS=7,
    # Verso dos tiles (evolução). PV substitui o da frente.
    UPG_COST={'cidade': {'gold': 3, 'stone': 3}, 'mercado': {'gold': 2, 'stone': 2}, 'campo': {'gold': 1, 'stone': 2},
              'pedreira': {'gold': 2, 'stone': 1}, 'armazem': {'gold': 2, 'stone': 3}},
    PV_UP={'cidade': 4, 'mercado': 4, 'campo': 3, 'pedreira': 3, 'armazem': 3},
    UP_CITY_GOLD=1, UP_QUARRY=1, UP_ARM_CAP=3,
    UPGRADES=True,
    CITY_SUPPLY=6,          # Cidades no mercado para a partida (None = ilimitado)
    SEAT_BONUS=None,
    POP_CHECKPOINTS=None,      # ex.: (7, 14): alimentados só pontuam nesses anos
    POP_MULT=1,
    SPLIT=True,                # Cidade dividida: 'cidade' = Residência (trabalhadores), 'mercado' = ouro
    MARKET_GOLD=4, MARKET_WORKER=True, UP_MARKET_GOLD=1,
    RES_ESC=None,              # (ouro, pedra) a mais por Residência que o jogador já tem além da 1ª
    CONTRACT=None,             # {'pts': pontos por cereal entregue, 'cap': cereal aceito por ano magro (todos juntos)}                # pontos por trabalhador alimentado no checkpoint           # lista por assento: {'gold': +x, ...} somado ao início
)

# Perfis de jogador (IA)
# store: modo de projeção da fome (None, 'mean', 'pess'); factor: fração do déficit a estocar
# slack: folga de armazenagem aceita antes de construir nova Cidade
# prefer: o que crescer primeiro; lean_buy: preço máximo que paga por cereal na fome
# (com 1 ponto a cada 4 de ouro, 1 cereal na fome evita 3 pontos = 12 de ouro)
STRATS = {
    'Expansionista': dict(store=None, factor=0.0, slack=999, prefer='campo',
                          lean_buy=10, fat_fill=False, capital_w=0.3, demarc=True, upg='low', mk=1.0),
    'Estocador': dict(store='pess', factor=1.0, slack=0, prefer='campo',
                      lean_buy=10, fat_fill=True, capital_w=0.3, demarc=False, upg='low', mk=0.5),
    'Equilibrado': dict(store='mean', factor=1.0, slack=5, prefer='campo',
                        lean_buy=10, fat_fill=True, capital_w=0.8, demarc=True, upg='low', mk=1.0),
    'Comerciante': dict(store='mean', factor=0.5, slack=10, prefer='cidade',
                        lean_buy=11, fat_fill=False, capital_w=2.0, demarc=False, upg='low', mk=1.5),
    # Construtor: 2 Cidades, estoca tudo, mais Pedreiras, evolui cedo
    'Construtor': dict(store='mean', factor=1.0, slack=5, prefer='campo',
                       lean_buy=10, fat_fill=False, capital_w=0.8, demarc=False, upg='high', mk=1.0),
}


def nb(c, N):
    x, y = c
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < N and 0 <= ny < N:
            yield (nx, ny)


def man(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


class Player:
    def __init__(s, pid, name, P):
        s.id, s.name, s.cfg = pid, name, STRATS[name]
        s.gold, s.stone, s.grain = P['START']['gold'], P['START']['stone'], P['START']['grain']
        if P.get('SEAT_BONUS'):
            b = P['SEAT_BONUS'][pid]
            s.gold += b.get('gold', 0); s.stone += b.get('stone', 0); s.grain += b.get('grain', 0)
        s.b = {}
        s.demarc = set()
        s.up = set()
        s.mw = P.get('SPLIT') and P.get('MARKET_WORKER')
        s.alloc = set()
        s.br = Counter()
        s.st = Counter()
        s.score = 0

    def count(s, t):
        return sum(1 for v in s.b.values() if v == t)

    def workers(s, P):
        return s.count('cidade') * P['CITY_WORKERS']

    def cap(s, P):
        return P['PREF_CAP'] + P['ARM_CAP'] * s.count('armazem') + \
            P['UP_ARM_CAP'] * sum(1 for c in s.up if s.b[c] == 'armazem')

    def slots(s):
        ts = ('campo', 'pedreira', 'mercado') if s.mw else ('campo', 'pedreira')
        return [c for c, t in s.b.items() if t in ts]


class Game:
    def __init__(g, names, seed, P=BASE):
        g.P = P
        g.rng = random.Random(seed)
        g.players = [Player(i, n, P) for i, n in enumerate(names)]
        g.city_left = P.get('CITY_SUPPLY')
        g.owner = {}
        g.dem = {}
        g.price = P['PRICE_START']
        g.cards = g.rng.sample(P['FAT_POOL'], P['FAT_ROUNDS']) + \
            g.rng.sample(P['LEAN_POOL'], P['ROUNDS'] - P['FAT_ROUNDS'])
        g.r = 0
        g.price_hist = []
        g.score_r7 = None

    # ---------- mapa ----------
    def is_free(g, c, p=None):
        if c in g.P['CAPITAL'] or c in g.owner:
            return False
        d = g.dem.get(c)
        return d is None or (p is not None and d == p.id)

    def expansion(g, p):
        out = set()
        for c in p.b:
            for n in nb(c, g.P['N']):
                if g.is_free(n, p):
                    out.add(n)
        return out

    def dcap(g, c):
        return min(man(c, k) for k in g.P['CAPITAL'])

    def conn_capital(g, p):
        return any(n in g.P['CAPITAL'] for c in p.b for n in nb(c, g.P['N']))

    def connected(g, p, q):
        return any(g.owner.get(n) == q.id for c in p.b for n in nb(c, g.P['N']))

    def place(g, p, t, c):
        g.owner[c] = p.id
        p.b[c] = t
        if c in g.dem:
            del g.dem[c]
            p.demarc.discard(c)
        if t != 'prefeitura':
            p.st['constr_' + t] += 1
        if g.conn_capital(p) and 'conn_round' not in p.st:
            p.st['conn_round'] = max(g.r, 1)

    def cell_score(g, p, t, c):
        P = g.P
        s = g.rng.random() * 0.01
        if t == 'campo' and c in P['RIVER']:
            s += 3
        if t == 'pedreira' and c in P['ROCK']:
            s += 3
        if t in ('cidade', 'mercado', 'armazem', 'prefeitura') and (c in P['RIVER'] or c in P['ROCK']):
            s -= 1
        if not g.conn_capital(p):
            s += p.cfg['capital_w'] * (4 - g.dcap(c))
        s += 0.2 * sum(1 for n in nb(c, P['N']) if g.is_free(n, p))
        return s

    def best_cell(g, p, t, cells=None):
        cells = cells if cells is not None else g.expansion(p)
        if not cells:
            return None
        return max(cells, key=lambda c: g.cell_score(p, t, c))

    # ---------- preparação ----------
    def setup(g):
        P = g.P
        allc = [(x, y) for x in range(P['N']) for y in range(P['N'])]
        for p in g.players:
            others = [c for c in g.owner]
            cand = []
            for mind in (3, 2, 0):
                cand = [c for c in allc if g.is_free(c) and all(man(c, o) >= mind for o in others)]
                if cand:
                    break

            def sc(c):
                v = 0
                for k in allc:
                    if man(c, k) <= 2:
                        v += 2 if k in P['RIVER'] else 1.5 if k in P['ROCK'] else 0
                v += p.cfg['capital_w'] * 0.5 * (4 - g.dcap(c))
                if c in P['RIVER'] or c in P['ROCK']:
                    v -= 1
                return v + g.rng.random() * 0.01
            c0 = max(cand, key=sc)
            g.place(p, 'prefeitura', c0)
            g.place(p, 'cidade', g.best_cell(p, 'cidade'))
            if P.get('SPLIT'):
                g.place(p, 'mercado', g.best_cell(p, 'mercado'))
        for p in reversed(g.players):
            for t in ('campo', 'pedreira'):
                c = g.best_cell(p, t)
                if c:
                    g.place(p, t, c)

    # ---------- projeções ----------
    def lean_rate(g, mode):
        pool = g.P['LEAN_POOL']
        return st.mean(pool) if mode == 'mean' else min(pool)

    def lean_years_left(g):
        F, R = g.P['FAT_ROUNDS'], g.P['ROUNDS']
        return (R - F) if g.r <= F else (R - g.r + 1)

    def lean_prod(g, p, W, mode):
        P = g.P
        rate = g.lean_rate(mode)
        campos = sorted([c for c, t in p.b.items() if t == 'campo'], key=lambda c: c not in P['RIVER'])
        k = min(W, len(campos))
        return sum(rate + (P['RIVER_LEAN_BONUS'] if c in P['RIVER'] else 0) for c in campos[:k])

    def lean_need(g, p, extra_w=0, mode='mean'):
        W = p.workers(g.P) + extra_w
        return max(0.0, g.lean_years_left() * (W - g.lean_prod(p, W, mode)))

    def target(g, p, extra_w=0):
        cfg = p.cfg
        if cfg.get('param'):
            return cfg['store'] * g.lean_need(p, extra_w, 'mean')
        if not cfg['store']:
            return 0
        return cfg['factor'] * g.lean_need(p, extra_w, cfg['store'])

    def spare_grain(g, q):
        if g.r <= g.P['FAT_ROUNDS']:
            return max(0, int(q.grain - g.target(q)))
        return max(0, int(q.grain - g.lean_need(q, 0, 'pess')))

    # ---------- comércio ----------
    def cost(g, p, t):
        c = dict(g.P['COST'][t])
        esc = g.P.get('RES_ESC')
        if t == 'cidade' and esc:
            k = max(0, p.count('cidade') - 1)
            c['gold'] = c.get('gold', 0) + esc[0] * k
            c['stone'] = c.get('stone', 0) + esc[1] * k
        return c

    def can_pay(g, p, t):
        c = g.cost(p, t)
        return p.gold >= c.get('gold', 0) and p.stone >= c.get('stone', 0)

    def pay(g, p, t):
        c = g.cost(p, t)
        p.gold -= c.get('gold', 0)
        p.stone -= c.get('stone', 0)

    def deliver(g, p, qty):
        if not g.P.get('CONTRACT') or g.r <= g.P['FAT_ROUNDS'] or not g.conn_capital(p):
            return False
        q = min(qty, g.contract_left, p.grain)
        if q <= 0:
            return False
        pts = g.P['CONTRACT']['pts'] * q
        p.grain -= q; g.contract_left -= q
        p.score += pts; p.br['contratos'] += pts; p.st['entregue'] += q
        return True

    def buy_grain(g, p, qty, thr):
        P = g.P
        best, avail = None, 0
        for q in g.players:
            if q is not p and g.connected(p, q):
                a = g.spare_grain(q)
                if a > avail:
                    best, avail = q, a
        bought = 0
        if best and g.price <= thr:
            while bought < qty and avail > 0 and p.gold >= g.price:
                p.gold -= g.price
                best.gold += g.price
                p.grain += 1
                best.grain -= 1
                avail -= 1
                bought += 1
            if bought:
                p.st['compra_vizinho'] += bought
                best.st['venda_vizinho'] += bought
                return True
        if not g.conn_capital(p):
            return False
        while bought < qty:
            np_ = min(g.price + 1, P['PRICE_MAX'])
            if np_ > thr or p.gold < np_:
                break
            g.price = np_
            p.gold -= np_
            p.grain += 1
            bought += 1
            p.st['ouro_gasto_cereal_capital'] += np_
        if bought:
            p.st['compra_capital'] += bought
            return True
        return False

    def sell_grain(g, p, qty, min_price):
        if not g.conn_capital(p) or qty <= 0:
            return False
        sold = 0
        while sold < qty and p.grain > 0:
            np_ = max(g.price - 1, g.P['PRICE_MIN'])
            if np_ < min_price:
                break
            g.price = np_
            p.gold += np_
            p.grain -= 1
            sold += 1
        if sold:
            p.st['venda_capital'] += sold
            p.st['ouro_venda_cereal'] += 0
            return True
        return False

    def buy_stone(g, p, qty):
        if not g.conn_capital(p):
            return False
        n = min(qty, p.gold // g.P['STONE_BUY'])
        if n <= 0:
            return False
        p.gold -= n * g.P['STONE_BUY']
        p.stone += n
        p.st['compra_pedra'] += n
        return True

    # ---------- construção ----------
    def build(g, p, t, cells=None):
        if t == 'cidade' and g.city_left is not None and g.city_left <= 0:
            return False
        if not g.can_pay(p, t):
            return False
        c = g.best_cell(p, t, cells)
        if c is None:
            p.st['sem_espaco'] += 1
            return False
        g.pay(p, t)
        g.place(p, t, c)
        if t == 'cidade' and g.city_left is not None:
            g.city_left -= 1
        return True

    def stone_for(g, p, t):
        need = g.cost(p, t).get('stone', 0) - p.stone
        gold_left = p.gold - g.cost(p, t).get('gold', 0)
        if need > 0 and gold_left >= need * g.P['STONE_BUY'] and g.conn_capital(p):
            return g.buy_stone(p, need)
        return False

    def upgrade(g, p, reserve_gold=0):
        P = g.P
        if not P['UPGRADES']:
            return False
        order = {'mercado': 0, 'pedreira': 1, 'cidade': 2, 'armazem': 3, 'campo': 4}
        cand = sorted([c for c, t in p.b.items() if t in P['UPG_COST'] and c not in p.up],
                      key=lambda c: (order[p.b[c]], c not in p.alloc))
        for c in cand:
            t = p.b[c]
            cost = P['UPG_COST'][t]
            if t == 'campo' and c not in p.alloc and g.r > P['FAT_ROUNDS']:
                continue
            if p.gold - reserve_gold >= cost['gold'] and p.stone >= cost['stone']:
                p.gold -= cost['gold']
                p.stone -= cost['stone']
                p.up.add(c)
                p.st['evolui'] += 1
                p.st['evolui_' + t] += 1
                return True
        return False

    def want_market(g, p, spare):
        P = g.P
        if not P.get('SPLIT'):
            return False
        if P['MARKET_WORKER'] and spare <= 0:
            return False
        return p.count('mercado') < p.cfg['mk'] * p.count('cidade')

    # ---------- perfil parametrizado (aprende por busca evolutiva) ----------
    def _try(g, p, t):
        if g.build(p, t):
            return t
        if g.cost(p, t).get('stone', 0) and g.stone_for(p, t):
            return 'compra_pedra'
        return None

    def act_param(g, p):
        P, c = g.P, p.cfg
        r, fat = g.r, g.r <= P['FAT_ROUNDS']
        W = p.workers(P)
        spare = W - len(p.slots())
        cap = p.cap(P)
        if not fat:
            exp = g.lean_prod(p, W, 'mean')
            short = int(round(W - (p.grain + exp)))
            if short > 0 and g.buy_grain(p, short, c['lean_buy']):
                return 'compra_cereal'
            if P.get('CONTRACT') and c.get('use_c'):
                extra = int(p.grain - c['keep_c'] * g.lean_need(p, 0, 'mean'))
                if extra > 0 and g.deliver(p, extra):
                    return 'entrega'
            surplus = int(p.grain - c['keep'] * g.lean_need(p, 0, 'mean'))
            if surplus > 0 and g.price >= c['sell_min'] and g.sell_grain(p, surplus, c['sell_min']):
                return 'venda_cereal'
        else:
            minp = min(P['FAT_POOL'])
            prod_min = sum(minp + (P['RIVER_BONUS'] if cc in P['RIVER'] else 0)
                           for cc, t in p.b.items() if t == 'campo' and cc in p.alloc)
            overflow = int(p.grain + prod_min - W - cap)
            if overflow > 0 and g.sell_grain(p, overflow, 1):
                return 'venda_cereal'
            if r >= c['store_from'] and cap < c['store'] * g.lean_need(p, 0, 'mean'):
                a = g._try(p, 'armazem')
                if a:
                    return a
        for k in c['order']:
            a = None
            if k == 'res' and p.count('cidade') < c['res_t'] and r <= c['stop_res']:
                a = g._try(p, 'cidade')
            elif k == 'mk' and P.get('SPLIT') and p.count('mercado') < c['mk_t'] and (not p.mw or spare > 0):
                a = g._try(p, 'mercado')
            elif k == 'cp' and p.count('campo') < c['cp_t'] and spare > 0:
                river = {x for x in g.expansion(p) if x in P['RIVER']}
                a = 'campo' if (river and g.build(p, 'campo', river)) else g._try(p, 'campo')
            elif k == 'pd' and p.count('pedreira') < c['pd_t'] and spare > 0:
                a = g._try(p, 'pedreira')
            elif k == 'upg' and r >= c['upg_from']:
                reserve = 0
                if not fat:
                    reserve = max(0, int(W - g.lean_prod(p, W, 'mean') - p.grain)) * g.price
                a = 'evolui' if g.upgrade(p, reserve) else None
            if a:
                return a
        if fat and c['fat_fill'] and r >= 4:
            want = int(min(c['store'] * g.lean_need(p, 0, 'mean'), cap) - p.grain)
            if want > 0 and g.buy_grain(p, want, 3):
                return 'compra_cereal'
        return 'passa'

    # ---------- decisão de ação ----------
    def act(g, p):
        if p.cfg.get('param'):
            return g.act_param(p)
        P, cfg = g.P, p.cfg
        fat = g.r <= P['FAT_ROUNDS']
        W = p.workers(P)
        spare = W - len(p.slots())
        cap = p.cap(P)

        if not fat:
            exp = g.lean_prod(p, W, 'mean')
            short = int(round(W - (p.grain + exp)))
            if short > 0 and g.buy_grain(p, short, cfg['lean_buy']):
                return 'compra_cereal'
            surplus = int(p.grain - g.lean_need(p, 0, 'pess'))
            if surplus > 0 and g.price >= 5 and g.sell_grain(p, surplus, 4):
                return 'venda_cereal'
            need_new = g.lean_need(p, P['CITY_WORKERS'], 'pess')
            if p.grain >= need_new and g.build(p, 'cidade'):
                return 'cidade'
            if g.want_market(p, spare) and g.build(p, 'mercado'):
                return 'mercado'
            if spare > 0:
                river = {c for c in g.expansion(p) if c in P['RIVER']}
                if river and g.build(p, 'campo', river):
                    return 'campo'
                if g.build(p, 'pedreira'):
                    return 'pedreira'
            reserve = max(0, int(W - g.lean_prod(p, W, 'mean') - p.grain)) * g.price
            if g.upgrade(p, reserve):
                return 'evolui'
            return 'passa'

        # anos gordos
        minp = min(P['FAT_POOL'])
        prod_min = sum(minp + (P['RIVER_BONUS'] if c in P['RIVER'] else 0)
                       for c, t in p.b.items() if t == 'campo')
        overflow = int(p.grain + prod_min - W - cap)
        if g.r == P['FAT_ROUNDS']:
            overflow = min(overflow, int(p.grain - g.target(p)))
        if overflow > 0 and g.sell_grain(p, overflow, 1):
            return 'venda_cereal'

        tgt = g.target(p)
        if g.want_market(p, spare) and g.build(p, 'mercado'):
            return 'mercado'
        if cfg['store'] and cap < tgt:
            if g.build(p, 'armazem'):
                return 'armazem'
            if g.stone_for(p, 'armazem'):
                return 'compra_pedra'

        city_ok = (not cfg['store']) or (cap + cfg['slack'] >= g.target(p, P['CITY_WORKERS']))
        if cfg['upg'] == 'high' and p.count('cidade') >= 2:
            city_ok = False
            if spare > 0 and g.build(p, 'pedreira'):
                return 'pedreira'
            if cap >= tgt and g.upgrade(p):
                return 'evolui'
        if cfg['store'] and not city_ok:
            if g.build(p, 'armazem'):
                return 'armazem'
            if g.stone_for(p, 'armazem'):
                return 'compra_pedra'
            if spare > 0:
                for t in ('campo', 'pedreira'):
                    if g.build(p, t):
                        return t
        order = ['cidade', 'campo', 'pedreira'] if (cfg['prefer'] == 'cidade' and spare <= 0) else ['campo', 'pedreira', 'cidade'] if spare > 0 else ['campo', 'cidade', 'pedreira']
        for t in order:
            if t == 'cidade' and city_ok:
                if g.build(p, 'cidade'):
                    return 'cidade'
                if g.stone_for(p, 'cidade'):
                    return 'compra_pedra'
            elif t in ('campo', 'pedreira') and spare > 0:
                if g.build(p, t):
                    return t

        if cfg['fat_fill'] and g.r >= 5:
            want = int(min(tgt, cap) - p.grain)
            if want > 0 and g.buy_grain(p, want, 3):
                return 'compra_cereal'

        if (not cfg['store'] or cap >= tgt) and g.r >= 4 and g.upgrade(p):
            return 'evolui'

        if cfg['demarc'] and len(p.demarc) < P['MAX_DEMARC'] and p.gold >= P['DEMARC_COST']:
            river = [c for c in g.expansion(p) if c in P['RIVER'] and c not in g.dem]
            if river:
                c = max(river, key=lambda c: g.cell_score(p, 'campo', c))
                p.gold -= P['DEMARC_COST']
                g.dem[c] = p.id
                p.demarc.add(c)
                p.st['demarca'] += 1
                return 'demarca'
        return 'passa'

    # ---------- alocação e resolução ----------
    def allocate(g, p):
        P = g.P
        W = p.workers(P)
        fat = g.r <= P['FAT_ROUNDS']
        campos = sorted([c for c, t in p.b.items() if t == 'campo'], key=lambda c: c not in P['RIVER'])
        quarries = sorted([c for c, t in p.b.items() if t == 'pedreira'], key=lambda c: c not in P['ROCK'])
        exp_card = st.mean(P['FAT_POOL'] if fat else P['LEAN_POOL'])
        alloc, w = [], W
        stock, cap = p.grain - W, p.cap(P)
        rb = P['RIVER_BONUS'] if fat else P['RIVER_LEAN_BONUS']
        if p.mw and p.cfg.get('mk_first'):
            for c in [c for c, t in p.b.items() if t == 'mercado']:
                if w == 0:
                    break
                alloc.append(c)
                w -= 1
        for c in campos:
            if w == 0 or (fat and stock >= cap):
                break
            alloc.append(c)
            w -= 1
            stock += exp_card + (rb if c in P['RIVER'] else 0)
        if p.mw:
            for c in [c for c, t in p.b.items() if t == 'mercado' and c not in alloc]:
                if w == 0:
                    break
                alloc.append(c)
                w -= 1
        for c in quarries:
            if w == 0:
                break
            alloc.append(c)
            w -= 1
        for c in campos:
            if w == 0:
                break
            if c not in alloc:
                alloc.append(c)
                w -= 1
        p.alloc = set(alloc)
        p.st['trab_ociosos'] += w

    def resolve(g, card):
        P = g.P
        rb = P['RIVER_BONUS'] if g.r <= P['FAT_ROUNDS'] else P['RIVER_LEAN_BONUS']
        for p in g.players:
            for c in p.alloc:
                t = p.b[c]
                if t == 'campo':
                    p.grain += card + (rb if c in P['RIVER'] else 0)
                elif t == 'pedreira':
                    p.stone += P['QUARRY'] + (P['ROCK_BONUS'] if c in P['ROCK'] else 0) + (P['UP_QUARRY'] if c in p.up else 0)
            if P.get('SPLIT'):
                for c, t in p.b.items():
                    if t == 'mercado' and (not p.mw or c in p.alloc):
                        p.gold += P['MARKET_GOLD'] + (P['UP_MARKET_GOLD'] if c in p.up else 0)
            else:
                p.gold += P['CITY_GOLD'] * p.count('cidade') + P['UP_CITY_GOLD'] * sum(1 for c in p.up if p.b[c] == 'cidade')
            W = p.workers(P)
            fed = min(p.grain, W)
            unfed = W - fed
            p.grain -= fed
            cp = P.get('POP_CHECKPOINTS')
            fed_pts = (P['POP_MULT'] * fed if g.r in cp else 0) if cp else P['FED'] * fed
            pts = fed_pts + P['UNFED'] * unfed
            p.score += pts
            p.br['alimentados'] += fed_pts
            p.br['fome'] += P['UNFED'] * unfed
            p.st['trab_sem_comida'] += unfed
            cap = p.cap(P)
            if p.grain > cap:
                p.st['cereal_perdido'] += p.grain - cap
                p.grain = cap

    def play(g):
        P = g.P
        g.setup()
        n = len(g.players)
        for r in range(1, P['ROUNDS'] + 1):
            g.r = r
            start = (r - 1) % n
            order = [g.players[(start + i) % n] for i in range(n)]
            g.contract_left = P['CONTRACT']['cap'] if (P.get('CONTRACT') and r > P['FAT_ROUNDS']) else 0
            for _ in range(P['ACTIONS']):
                for p in order:
                    a = g.act(p)
                    p.st['acao_' + a] += 1
                    if a == 'passa' and r > P['FAT_ROUNDS']:
                        p.st['passa_magro'] += 1
            for p in g.players:
                g.allocate(p)
            card = g.cards[r - 1]
            if 'FAT_ANCHOR' in P:
                a = P['FAT_ANCHOR'] if r <= P['FAT_ROUNDS'] else P['LEAN_ANCHOR']
                g.price += (a > g.price) - (a < g.price)
            else:
                g.price += P['FAT_SHIFT'] if r <= P['FAT_ROUNDS'] else P['LEAN_SHIFT']
            g.price = max(P['PRICE_MIN'], min(P['PRICE_MAX'], g.price))
            g.resolve(card)
            g.price_hist.append(g.price)
            if r == P['FAT_ROUNDS']:
                g.score_r7 = [p.score for p in g.players]
                for p in g.players:
                    p.st['cereal_ano7'] = p.grain
                    p.st['necessidade_ano7'] = g.lean_need(p, 0, 'mean')
                    p.st['cap_ano7'] = p.cap(P)
                    p.st['trab_ano7'] = p.workers(P)
        for p in g.players:
            pv = sum((P['PV_UP'][t] if c in p.up else P['PV'][t]) for c, t in p.b.items()
                     if t in ('cidade', 'armazem', 'prefeitura') or (t == 'mercado' and not p.mw) or c in p.alloc)
            endr = p.gold // P['END_GOLD'] + p.grain // P['END_GRAIN'] + p.stone // P['END_STONE']
            p.br['impressos'] = pv
            p.br['recursos_fim'] = endr
            p.score += pv + endr
        return g


def run(names_list, n_games, P=BASE, seed0=0, shuffle=True):
    res = defaultdict(lambda: defaultdict(list))
    wins = Counter()
    seat_wins = Counter()
    leader7_wins = 0
    prices = defaultdict(list)
    occupancy = []
    for i in range(n_games):
        rng = random.Random(seed0 + i)
        names = list(names_list)
        if shuffle:
            rng.shuffle(names)
        g = Game(names, seed0 + i, P).play()
        best = max(p.score for p in g.players)
        winners = [p for p in g.players if p.score == best]
        for w in winners:
            wins[w.name] += 1 / len(winners)
            seat_wins[w.id] += 1 / len(winners)
        lead7 = max(range(len(g.players)), key=lambda k: g.score_r7[k])
        if g.players[lead7].score == best:
            leader7_wins += 1
        for r, pr in enumerate(g.price_hist, 1):
            prices[r].append(pr)
        occupancy.append(len(g.owner))
        for p in g.players:
            d = res[p.name]
            d['pontos'].append(p.score)
            for k, v in p.br.items():
                d[k].append(v)
            for k in ('cereal_ano7', 'necessidade_ano7', 'cap_ano7', 'trab_ano7', 'cereal_perdido',
                      'trab_sem_comida', 'acao_passa', 'compra_capital', 'compra_vizinho',
                      'venda_capital', 'venda_vizinho', 'demarca', 'sem_espaco', 'trab_ociosos', 'evolui'):
                d[k].append(p.st.get(k, 0))
            d['edificios'].append(len(p.b) - 1)
            d['passa_magro'].append(p.st.get('passa_magro', 0))
            for t in ('cidade', 'mercado', 'campo', 'pedreira', 'armazem'):
                d[t].append(p.count(t))
            d['conectou_ano'].append(p.st.get('conn_round', 99))
    return dict(res=res, wins=wins, seat=seat_wins, lead7=leader7_wins, n=n_games,
                prices={r: st.mean(v) for r, v in prices.items()}, occ=st.mean(occupancy),
                pmin=min(min(v) for v in prices.values()), pmax=max(max(v) for v in prices.values()))


def report(title, R, show_detail=True):
    n = R['n']
    out = [f"\n## {title}  ({n} partidas)\n"]
    names = sorted(R['res'], key=lambda k: -R['wins'][k])
    out.append("| Perfil | Vitórias | Pontos (média) | Alim. | Fome | Impressos | Recursos fim |")
    out.append("|---|---|---|---|---|---|---|")
    for k in names:
        d = R['res'][k]
        m = lambda x: st.mean(d[x])
        share = 100 * R['wins'][k] / n / (len(d['pontos']) / n)
        out.append(f"| {k} | {share:.0f}% | "
                   f"{m('pontos'):.1f} | {m('alimentados'):.1f} | {m('fome'):.1f} | "
                   f"{m('impressos'):.1f} | {m('recursos_fim'):.1f} |")
    if show_detail:
        out.append("\n| Perfil | Trab. ano 7 | Cereal ano 7 | Necessid. magra | Capac. ano 7 | Cereal perdido | Sem comida (trab-ano) |")
        out.append("|---|---|---|---|---|---|---|")
        for k in names:
            d = R['res'][k]
            m = lambda x: st.mean(d[x])
            out.append(f"| {k} | {m('trab_ano7'):.1f} | {m('cereal_ano7'):.1f} | {m('necessidade_ano7'):.1f} | "
                       f"{m('cap_ano7'):.1f} | {m('cereal_perdido'):.1f} | {m('trab_sem_comida'):.1f} |")
        out.append("\n| Perfil | Edifícios | Cid | Cam | Ped | Arm | Ações passadas | Compra Capital | Compra vizinho | Venda Capital | Demarca | Trab. ociosos (soma) | Conectou (ano) |")
        out.append("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
        for k in names:
            d = R['res'][k]
            m = lambda x: st.mean(d[x])
            conn = [x for x in d['conectou_ano'] if x < 99]
            conn_s = f"{st.mean(conn):.1f} ({100*len(conn)/len(d['conectou_ano']):.0f}%)" if conn else "nunca"
            out.append(f"| {k} | {m('edificios'):.1f} | {m('cidade'):.1f} | {m('campo'):.1f} | {m('pedreira'):.1f} | "
                       f"{m('armazem'):.1f} | {m('acao_passa'):.1f} | {m('compra_capital'):.1f} | {m('compra_vizinho'):.1f} | "
                       f"{m('venda_capital'):.1f} | {m('demarca'):.1f} | {m('trab_ociosos'):.1f} | {conn_s} |")
    out.append(f"\nLíder no fim do ano 7 vence: {100*R['lead7']/n:.0f}%  ·  "
               f"Casas ocupadas no fim: {R['occ']:.0f} de 60  ·  Preço mín/máx observado: {R['pmin']}/{R['pmax']}  ·  "
               f"Preço do cereal (média) ano 1/7/8/14: "
               f"{R['prices'][1]:.1f} / {R['prices'][7]:.1f} / {R['prices'][8]:.1f} / {R['prices'][14]:.1f}")
    return "\n".join(out)


def compact(title, R):
    n = R['n']
    out = [f"\n## {title}  ({n} partidas)\n",
           "| Perfil | Vitórias | Pontos | Alim. | Fome | Impressos | Sobras | Evoluções | Passou na fome (de 14) |",
           "|---|---|---|---|---|---|---|---|---|"]
    for k in sorted(R['res'], key=lambda k: -R['wins'][k] / len(R['res'][k]['pontos'])):
        d = R['res'][k]; m = lambda x: st.mean(d[x])
        share = 100 * R['wins'][k] / len(d['pontos'])
        out.append(f"| {k} | {share:.0f}% | {m('pontos'):.0f} | {m('alimentados'):.0f} | {m('fome'):.0f} | "
                   f"{m('impressos'):.0f} | {m('recursos_fim'):.0f} | {m('evolui'):.1f} | {m('passa_magro'):.1f} |")
    out.append(f"\nLíder no ano 7 vence: {100*R['lead7']/n:.0f}%")
    return "\n".join(out)


def rotate(names, n_games, P=BASE, seed0=0):
    import itertools
    combos = list(itertools.combinations(names, 4))
    agg = None
    for k, c in enumerate(combos):
        R = run(list(c), n_games // len(combos), P=P, seed0=seed0 + 1000 * k)
        if agg is None:
            agg = R
            continue
        for name, d in R['res'].items():
            for key, v in d.items():
                agg['res'][name][key].extend(v)
        agg['wins'].update(R['wins'])
        agg['lead7'] += R['lead7']
        agg['n'] += R['n']
    return agg


def mirror(profile, N, P, seed0=70_000):
    seat = Counter(); scores = [[] for _ in range(4)]; cities = [0] * 4
    margins = []; spreads = []; ties = 0
    for i in range(N):
        g = Game([profile] * 4, seed0 + i, P).play()
        sc = [p.score for p in g.players]; best = max(sc)
        w = [k for k, v in enumerate(sc) if v == best]
        ties += len(w) > 1
        for k in w: seat[k] += 1 / len(w)
        o = sorted(sc, reverse=True); margins.append(o[0] - o[1]); spreads.append(o[0] - o[3])
        for k, p in enumerate(g.players):
            scores[k].append(p.score); cities[k] += p.count('cidade') + p.count('mercado') / 100
    return dict(seat=[100 * seat[k] / N for k in range(4)], pts=[st.mean(v) for v in scores],
                cid=[c / N for c in cities], ties=100 * ties / N, margin=st.mean(margins), spread=st.mean(spreads))


def line(label, M):
    seats = " / ".join(f"{v:.0f}%" for v in M['seat'])
    pts = " / ".join(f"{v:.0f}" for v in M['pts'])
    cid = " / ".join(f"{v:.1f}" for v in M['cid'])
    return f"| {label} | {seats} | {pts} | {cid} | {M['ties']:.0f}% | {M['margin']:.1f} | {M['spread']:.0f} |"


def compact2(title, R):
    n = R['n']
    out = [f"\n## {title}  ({n} partidas)\n",
           "| Perfil | Vitórias | Pontos | Alim. | Fome | Impressos | Sobras | Resid. | Merc. | Evol. |",
           "|---|---|---|---|---|---|---|---|---|---|"]
    for k in sorted(R['res'], key=lambda k: -R['wins'][k] / len(R['res'][k]['pontos'])):
        d = R['res'][k]; m = lambda x: st.mean(d[x])
        out.append(f"| {k} | {100*R['wins'][k]/len(d['pontos']):.0f}% | {m('pontos'):.0f} | {m('alimentados'):.0f} | {m('fome'):.0f} | "
                   f"{m('impressos'):.0f} | {m('recursos_fim'):.0f} | {m('cidade'):.1f} | {m('mercado'):.1f} | {m('evolui'):.1f} |")
    return "\n".join(out)


def mline(label, M):
    seats = " / ".join(f"{v:.0f}%" for v in M['seat'])
    pts = " / ".join(f"{v:.0f}" for v in M['pts'])
    res = " / ".join(f"{int(v)}" for v in M['cid'])
    mk = " / ".join(f"{round((v - int(v)) * 100)}" for v in M['cid'])
    return f"| {label} | {seats} | {pts} | {M['ties']:.0f}% | {M['spread']:.0f} |"


