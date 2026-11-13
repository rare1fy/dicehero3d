// Batch simulation for SPEC_v2.1 §7 metrics. `simulate()` runs N bot runs of the slice and returns a table row;
// `npx vite-node src/core/v2/sim.ts 200` (or tests/v2/sim.test.ts) prints the table for every class × tablet, in the two
// build stages of §7: 初始构筑 (start rows, level I, no talents / relics) and 成型构筑 (full rows, level II, 2 talents, 3 relics).
import { autoBattle2 } from './bot2';
import { Run2, type Choice, type Run2Options, type RunNode } from './run2';
import { CLASSES, ENEMY_TRAITS, PROTO_RELICS, TABLETS, TALENTS, V4_PARAMS, isV4Loadout, loadoutB, maxLevelOf, slotRow } from './data';
import { Battle2, type FightKind } from './battle2';
import type { ClassId, Level } from './types';

export interface FightStat {
  kind: string; turns: number; ultimates: number; big4: number; big4Rows: Record<string, number>; diceAtStart: number[]; basics: number; plays: number; rows: Record<string, number>; won: boolean;
  bloodRerolls: number; chantTurns: number; combos: number;
  mixPlays: number; fullRingPlays: number; fullRingDice: number; backlashDeath: boolean;
  preciseSpawns: number; markSpawns: number; sleeveSpawns: number; spawnTurns: number;
  gold: { kill: number; overflow: number; relic: number; summon: number }; capHits: { overflow: boolean; relic: boolean; summon: boolean };
  /** v4 metrics (Battle2 stats) */
  strikeHist: number[]; rounds: number; beheadRounds: number; guardRounds: number; eitherRounds: number; bothRounds: number; attackRounds: number; eitherAttackRounds: number;
  bloodPaid: number; bloodRefunded: number; killActs: number; minorCasts: number; releases: number; releaseDice: number; holds: number; refills: number;
  hpLost: number; firstBasic: number; capBlocked: number;
}
export interface RunResult {
  win: boolean; diedAt: number | null; hp: number; gold: number; level: number;
  fights: FightStat[];
  spent: number; relics: string[];
  /** gold when entering the first shop (null = never reached) */
  shopGold: number | null;
  /** v4.1 level-up picks: was 刀鞘 +1 offered, was it taken */
  cards: Array<{ sheathOffered: boolean; pickedSheath: boolean; picked: string }>;
  /** v4.1 刀鞘 level at the end of the run (rogue v4) */
  sheathLevel: number;
}

/** Greedy run policy: level-up prefers add row → evolve → upgrade; first talent offered; shop buys engrave / relic / potion. */
export function autoRun(o: Run2Options & { battleSeed?: number }): RunResult {
  const run = new Run2(o);
  const res: RunResult = { win: false, diedAt: null, hp: 0, gold: 0, level: 1, fights: [], spent: 0, relics: [], shopGold: null, cards: [], sheathLevel: 0 };
  let guard = 0;
  while (guard++ < 50) {
    const s = run.s;
    if (s.phase === 'win') { res.win = true; break; }
    if (s.phase === 'dead') break;
    if (s.phase === 'battle') {
      if (s.hp < s.maxHp * 0.5 && s.potions) run.drink();
      const b = run.startBattle();
      const hp0 = b.s.player.hp;
      autoBattle2(b, { seed: (o.seed * 31 + s.node) >>> 0 });
      res.fights.push(fightStats(run.node().kind, b, hp0));
      if (b.s.result !== 'win') { res.diedAt = s.node; run.endBattle(b); break; }
      run.endBattle(b);
      continue;
    }
    if (s.phase === 'choice') {
      const c = run.pending()!;
      if (c.kind === 'levelUp') {
        const pref = ['addRow', 'evolve', 'upgrade'];
        let idx = 0; for (const k of pref) { const i = c.cards.findIndex(x => x.kind === k); if (i >= 0) { idx = i; break; } }
        // v4.1: the v4 rogue picks its card by trying each one on the next fight (刀鞘 +1 vs skill upgrades)
        if (run.s.classId === 'rogue' && isV4Loadout(run.s.loadout)) idx = pickCardMC(run, c, o.seed);
        const rowOf = (i: number) => { const k = c.cards[i]; return k.kind === 'upgrade' ? run.s.loadout.tablets[k.tablet].slots[k.slot].rowId : k.kind; };
        const sheathOffered = c.cards.some((_, i) => rowOf(i) === 'r4_sheath');
        res.cards.push({ sheathOffered, pickedSheath: rowOf(idx) === 'r4_sheath', picked: rowOf(idx) });
        run.choose(idx, 0);
      } else run.choose(0);
      continue;
    }
    if (s.phase === 'shop') {
      const g0 = s.gold; if (res.shopGold == null) res.shopGold = g0;
      const order = run.shop().map((it, i) => ({ it, i })).sort((a, b) => pri(a.it.kind) - pri(b.it.kind));
      for (const { it, i } of order) { if (!it.sold && s.gold >= it.price && (it.kind !== 'potion' || s.potions < 1)) run.buy(i); }
      res.spent += g0 - s.gold;
      run.next(); continue;
    }
    if (s.phase === 'camp') { run.camp(s.hp < s.maxHp * 0.6 ? 'rest' : 'train'); continue; }
  }
  res.hp = run.s.hp; res.gold = run.s.gold; res.level = run.s.level; res.relics = run.s.relics.slice();
  res.sheathLevel = run.s.loadout.tablets.flatMap(t => t.slots).find(x => x.rowId === 'r4_sheath')?.level ?? 0;
  return res;
}

/** v4.1 card pick by trial: each upgrade card is applied to a copy of the loadout and the next fight is played K times with the
 *  same seeds; score = win (100 + HP left) or loss (− enemy HP left). Returns the best card index. */
export const CARD_TRIALS = { k: 12 };
function pickCardMC(run: Run2, c: Extract<Choice, { kind: 'levelUp' }>, seed: number): number {
  const s = run.s;
  const ni = s.nodes.findIndex((n, i) => i > s.node && !!n.waves);
  if (ni < 0) return 0;
  const node = s.nodes[ni];
  const kind: FightKind = node.kind === 'normal' ? 'normal' : node.kind === 'elite' ? 'elite' : 'midBoss';
  let best = { i: 0, v: -Infinity };
  c.cards.forEach((card, i) => {
    if (card.kind !== 'upgrade') return;
    const lo = structuredClone(s.loadout); const sl = lo.tablets[card.tablet].slots[card.slot];
    sl.level = Math.min(maxLevelOf(sl.rowId), sl.level + 1) as Level;
    let v = 0;
    for (let k = 0; k < CARD_TRIALS.k; k++) {
      const b = new Battle2({ seed: (seed * 7919 + k * 104729 + ni) >>> 0, classId: s.classId, loadout: lo, talents: { ...s.talents }, relics: s.relics.slice(), hp: s.hp, maxHp: s.maxHp, waves: node.waves!, kind });
      autoBattle2(b, { seed: (seed * 31 + k) >>> 0 });
      v += b.s.result === 'win' ? 100 + b.s.player.hp : -b.alive().reduce((a, e) => a + e.hp, 0);
    }
    if (v > best.v) best = { i, v };
  });
  return best.i;
}
const pri = (k: string) => (k === 'engrave' ? 0 : k === 'relic' ? 1 : 2);

function fightStats(kind: string, b: Battle2, hp0: number): FightStat {
  const st = b.stats, inc = b.s.income;
  return {
    strikeHist: st.strikeHist.slice(), rounds: st.rounds, beheadRounds: st.beheadRounds, guardRounds: st.guardRounds, eitherRounds: st.eitherRounds, bothRounds: st.bothRounds, attackRounds: st.attackRounds, eitherAttackRounds: st.eitherAttackRounds,
    bloodPaid: st.bloodPaid, bloodRefunded: st.bloodRefunded, killActs: st.killActs, minorCasts: st.minorCasts, releases: st.releases, releaseDice: st.releaseDice, holds: st.holds, refills: st.refills,
    hpLost: Math.max(0, hp0 - Math.max(0, b.s.player.hp)), firstBasic: st.firstBasic, capBlocked: st.capBlocked,
    kind, turns: st.turns, ultimates: st.ultimates, big4: st.big4, big4Rows: { ...st.big4Rows }, diceAtStart: st.diceAtStart.slice(), basics: st.basics, plays: st.plays, rows: { ...st.rows }, won: b.s.result === 'win',
    bloodRerolls: st.bloodRerolls, chantTurns: st.chantTurns, combos: st.combos,
    mixPlays: st.mixPlays, fullRingPlays: st.fullRingPlays, fullRingDice: st.fullRingDice, backlashDeath: st.backlashDeath,
    preciseSpawns: st.preciseSpawns, markSpawns: st.markSpawns, sleeveSpawns: st.sleeveSpawns, spawnTurns: st.spawnTurns,
    gold: { kill: inc.kill, overflow: inc.overflow, relic: inc.relic, summon: inc.summonGold }, capHits: { ...st.capHits },
  };
}

export type Stage = 'initial' | 'built';
/** 成型构筑 start state (§7): full rows at level II, the first 2 talents valid for that loadout at level I, 3 prototype relics */
export function builtUp(classId: ClassId, tablet?: string): Pick<Run2Options, 'full' | 'rowLevel' | 'talents' | 'relics'> {
  const tid = tablet || CLASSES[classId].tablets[0];
  const l = loadoutB(tid, { full: true, level: 2 });
  const tal = TALENTS.filter(t => t.classId === classId && t.validFor(l)).slice(0, 2);
  return { full: true, rowLevel: 2, talents: Object.fromEntries(tal.map(t => [t.id, 1 as const])), relics: PROTO_RELICS.slice(0, 3).map(r => r.id) };
}

export interface SimReport {
  label: string; n: number; winRate: number; stage: Stage;
  pct4: number; pct6: number;
  ultPerFight: Record<string, number>; big4PerFight: Record<string, number>; turnsPerFight: Record<string, number>;
  basicShare: number; rows: Record<string, number>;
  /** 4+ dice plays per fight, by row */
  big4Rows: Record<string, number>;
  extra: Record<string, number>;
}

export function simulate(o: { n: number; classId: ClassId; tablet?: string; version?: 'A' | 'B'; full?: boolean; stage?: Stage; nodes?: RunNode[]; seed0?: number }): SimReport {
  const stage: Stage = o.stage || (o.full ? 'built' : 'initial');
  const extraOpts = stage === 'built' && o.version !== 'A' ? builtUp(o.classId, o.tablet) : {};
  const runs: RunResult[] = [];
  for (let i = 0; i < o.n; i++) runs.push(autoRun({ seed: (o.seed0 ?? 1) + i, classId: o.classId, tablet: o.tablet, version: o.version, nodes: o.nodes, ...extraOpts }));
  const fights = runs.flatMap(r => r.fights);
  const turns = fights.flatMap(f => f.diceAtStart);
  const by = (k: string) => fights.filter(f => f.kind === k);
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const sum = (f: (x: FightStat) => number) => fights.reduce((a, x) => a + f(x), 0);
  const kinds = ['normal', 'elite', 'midBoss'];
  const rows: Record<string, number> = {};
  for (const f of fights) for (const [k, v] of Object.entries(f.rows)) rows[k] = (rows[k] || 0) + v;
  const big4Rows: Record<string, number> = {};
  for (const f of fights) for (const [k, v] of Object.entries(f.big4Rows)) big4Rows[k] = (big4Rows[k] || 0) + v / Math.max(1, fights.length);
  const plays = sum(f => f.plays + f.basics);
  const allTurns = Math.max(1, sum(f => f.turns));
  const goldAll = Math.max(1, sum(f => f.gold.kill + f.gold.overflow + f.gold.relic + f.gold.summon));
  const shopG = runs.map(r => r.shopGold).filter((x): x is number => x != null);
  const tabName = o.version === 'A' ? 'A版' : TABLETS[o.tablet || CLASSES[o.classId].tablets[0]].name;
  return {
    label: `${CLASSES[o.classId].name} ${tabName}${stage === 'built' && o.version !== 'A' ? '(成型)' : ''}`,
    n: o.n, winRate: runs.filter(r => r.win).length / o.n, stage,
    pct4: turns.filter(x => x >= 4).length / Math.max(1, turns.length), pct6: turns.filter(x => x >= 6).length / Math.max(1, turns.length),
    ultPerFight: Object.fromEntries(kinds.map(k => [k, avg(by(k).map(f => f.ultimates))])),
    big4PerFight: Object.fromEntries(kinds.map(k => [k, avg(by(k).map(f => f.big4))])),
    turnsPerFight: Object.fromEntries(kinds.map(k => [k, avg(by(k).map(f => f.turns))])),
    basicShare: sum(f => f.basics) / Math.max(1, plays),
    rows, big4Rows,
    extra: {
      bloodPerTurn: sum(f => f.bloodRerolls) / allTurns,
      chantShare: sum(f => f.chantTurns) / allTurns,
      comboPerTurn: sum(f => f.combos) / allTurns,
      fullRingAvgDice: sum(f => f.fullRingDice) / Math.max(1, sum(f => f.fullRingPlays)),
      mixPerFight: sum(f => f.mixPlays) / Math.max(1, fights.length),
      backlashDeaths: fights.filter(f => f.backlashDeath).length,
      precisePerTurn: sum(f => f.preciseSpawns) / allTurns,
      markPerTurn: sum(f => f.markSpawns) / allTurns,
      sleevePerTurn: sum(f => f.sleeveSpawns) / allTurns,
      spawnTurnShare: sum(f => f.spawnTurns) / allTurns,
      killGoldShare: sum(f => f.gold.kill) / goldAll,
      overflowCapHit: fights.filter(f => f.capHits.overflow).length / Math.max(1, fights.length),
      summonCapHit: fights.filter(f => f.capHits.summon).length / Math.max(1, fights.length),
      shopGold: avg(shopG),
      endHp: avg(runs.map(r => r.hp)), endGold: avg(runs.map(r => r.gold)), spent: avg(runs.map(r => r.spent)), level: avg(runs.map(r => r.level)),
      diedNormal: runs.filter(r => r.diedAt === 0).length, diedElite: runs.filter(r => r.diedAt === 1).length, diedBoss: runs.filter(r => r.diedAt === 3).length,
      ...v4Extra(fights),
      ...cardExtra(runs), sheathStart: V4_PARAMS.rogueStartStrikes,
    },
  };
}
/** v4.1 刀鞘 picks */
function cardExtra(runs: RunResult[]): Record<string, number> {
  const cards = runs.flatMap(r => r.cards);
  const offered = cards.filter(c => c.sheathOffered);
  return {
    levelUps: cards.length / Math.max(1, runs.length),
    sheathOfferShare: offered.length / Math.max(1, cards.length),
    sheathPickShare: offered.filter(c => c.pickedSheath).length / Math.max(1, offered.length),
    sheathEndLevel: runs.reduce((a, r) => a + r.sheathLevel, 0) / Math.max(1, runs.length),
  };
}

/** v4 targets (CORE4 §4): rogue ≥3 strikes per turn, warrior behead-or-guard rounds, mage boss fight length */
function v4Extra(fights: FightStat[]): Record<string, number> {
  const sum = (f: (x: FightStat) => number) => fights.reduce((a, x) => a + f(x), 0);
  const hist = [0, 0, 0, 0, 0, 0, 0]; for (const f of fights) f.strikeHist.forEach((v, i) => { hist[i] += v; });
  const acted = Math.max(1, hist.reduce((a, b) => a + b, 0));
  const boss = fights.filter(f => f.kind === 'midBoss');
  const rounds = Math.max(1, sum(f => f.rounds));
  return {
    turnsLogged: acted,
    strikes1: hist[1] / acted, strikes2: hist[2] / acted, strikes3: hist[3] / acted, strikes4: hist[4] / acted, strikes5: (hist[5] + hist[6]) / acted, strikes0: hist[0] / acted,
    strikesGe3: (hist[3] + hist[4] + hist[5] + hist[6]) / acted, strikesGe4: (hist[4] + hist[5] + hist[6]) / acted,
    strikesAvg: hist.reduce((a, v, i) => a + v * i, 0) / acted,
    refillsPerTurn: sum(f => f.refills) / acted, firstBasicShare: sum(f => f.firstBasic) / Math.max(1, acted - hist[0]),
    capBlockedShare: sum(f => f.capBlocked) / acted, strikes6: hist[6] / acted,
    eitherAttackShare: sum(f => f.eitherAttackRounds) / Math.max(1, sum(f => f.attackRounds)), attackShare: sum(f => f.attackRounds) / rounds,
    ...Object.fromEntries((['normal', 'elite', 'midBoss'] as const).flatMap(k => { const fs = fights.filter(f => f.kind === k); const r = Math.max(1, fs.reduce((a, f) => a + f.rounds, 0)); return [['either_' + k, fs.reduce((a, f) => a + f.eitherRounds, 0) / r], ['rounds_' + k, fs.reduce((a, f) => a + f.rounds, 0)]]; })),
    beheadShare: sum(f => f.beheadRounds) / rounds, guardShare: sum(f => f.guardRounds) / rounds, eitherShare: sum(f => f.eitherRounds) / rounds, bothShare: sum(f => f.bothRounds) / rounds,
    bloodPerFight: sum(f => f.bloodPaid) / Math.max(1, fights.length), refundShare: sum(f => f.bloodRefunded) / Math.max(1, sum(f => f.bloodPaid)), killActsPerFight: sum(f => f.killActs) / Math.max(1, fights.length),
    minorPerFight: sum(f => f.minorCasts) / Math.max(1, fights.length), releasePerFight: sum(f => f.releases) / Math.max(1, fights.length), releaseDice: sum(f => f.releaseDice) / Math.max(1, sum(f => f.releases)),
    holdShare: sum(f => f.holds) / acted,
    bossTurns: boss.length ? boss.reduce((a, f) => a + f.turns, 0) / boss.length : 0,
    bossOver12: boss.length ? boss.filter(f => f.turns > 12).length / boss.length : 0,
    bossMaxTurns: boss.reduce((a, f) => Math.max(a, f.turns), 0),
    hpLostNormal: avgOf(fights.filter(f => f.kind === 'normal').map(f => f.hpLost)), hpLostElite: avgOf(fights.filter(f => f.kind === 'elite').map(f => f.hpLost)), hpLostBoss: avgOf(boss.map(f => f.hpLost)),
  };
}
const avgOf = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** v4 default: one pattern tablet per class */
export const COMBOS: Array<{ classId: ClassId; tablet?: string; version?: 'A' | 'B'; stage?: Stage }> = [
  { classId: 'warrior', tablet: 'w_v4' }, { classId: 'mage', tablet: 'm_v4' }, { classId: 'rogue', tablet: 'r_v4' },
];
/** v3 pattern tablets (kept for comparison) */
export const COMBOS_V3: typeof COMBOS = [
  { classId: 'warrior', tablet: 'w_v3' }, { classId: 'mage', tablet: 'm_v3' }, { classId: 'rogue', tablet: 'r_v3' },
];
/** v2.2 suit / point tablets (kept for comparison) */
export const COMBOS_V2: typeof COMBOS = [
  { classId: 'warrior', tablet: 'w_suit' }, { classId: 'warrior', tablet: 'w_point' },
  { classId: 'mage', tablet: 'm_suit' }, { classId: 'mage', tablet: 'm_point' },
  { classId: 'rogue', tablet: 'r_suit' }, { classId: 'rogue', tablet: 'r_point' },
];
export const COMBOS_EXTRA: typeof COMBOS = [
  ...COMBOS.map(c => ({ ...c, stage: 'built' as const })),
];

const pct = (x: number) => (x * 100).toFixed(0) + '%';
const f1 = (x: number) => x.toFixed(2), f0 = (x: number) => x.toFixed(1);
export function formatTable(rs: SimReport[]): string {
  const head = '| 组合 | 局数 | 通关率 | ≥4 颗回合 | 6 颗回合 | 4 颗质变/场（普/精/首） | 终极/场（普/精/首） | 回合/场（普/精/首） | 普攻占比 | 平均等级 | 到店金 | 剩余金 | 死于（普/精/首） |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|';
  const lines = rs.map(r => `| ${r.label} | ${r.n} | ${pct(r.winRate)} | ${pct(r.pct4)} | ${pct(r.pct6)} | ${f1(r.big4PerFight.normal)} / ${f1(r.big4PerFight.elite)} / ${f1(r.big4PerFight.midBoss)} | ${f1(r.ultPerFight.normal)} / ${f1(r.ultPerFight.elite)} / ${f1(r.ultPerFight.midBoss)} | ${f0(r.turnsPerFight.normal)} / ${f0(r.turnsPerFight.elite)} / ${f0(r.turnsPerFight.midBoss)} | ${pct(r.basicShare)} | ${f0(r.extra.level)} | ${f0(r.extra.shopGold)} | ${f0(r.extra.endGold)} | ${r.extra.diedNormal}/${r.extra.diedElite}/${r.extra.diedBoss} |`);
  return [head, ...lines].join('\n');
}
/** class-specific side metrics (§7「附带要看的」) */
export function formatSide(rs: SimReport[]): string {
  const head = '| 组合 | 卖血/回合 | 吟唱占比 | 满环出手均颗 | 交汇/场 | 反噬致死 | 精准产残/回合 | 标记产残/回合 | 袖箭化影/回合 | 产残回合占比 | 击杀金占比 | 溢出触顶 | 召唤触顶 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|';
  const lines = rs.map(r => { const e = r.extra; return `| ${r.label} | ${f1(e.bloodPerTurn)} | ${pct(e.chantShare)} | ${f1(e.fullRingAvgDice)} | ${f1(e.mixPerFight)} | ${e.backlashDeaths} | ${f1(e.precisePerTurn)} | ${f1(e.markPerTurn)} | ${f1(e.sleevePerTurn)} | ${pct(e.spawnTurnShare)} | ${pct(e.killGoldShare)} | ${pct(e.overflowCapHit)} | ${pct(e.summonCapHit)} |`; });
  return [head, ...lines].join('\n');
}
export function formatRows(rs: SimReport[]): string {
  return rs.map(r => `${r.label}: ` + Object.entries(r.rows).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${slotName(k)} ${v}`).join('，')
    + (Object.keys(r.big4Rows).length ? '；4 颗以上/场：' + Object.entries(r.big4Rows).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${slotName(k)} ${v.toFixed(2)}`).join('，') : '')).join('\n');
}
function slotName(id: string) { try { return slotRow({ rowId: id, level: 1 }).name; } catch { return id; } }
/** v4.1 one-fight sim (the 盾卫嘲讽 encounter is not in the slice): n fights at full HP with the stage's build */
export const TAUNT_WAVES = [['forest_treant', 'forest_banshee', 'forest_wolf_priest']];
export function simEncounter(o: { n: number; classId: ClassId; waves: string[][]; kind: FightKind; stage?: Stage; seed0?: number }) {
  const ex = o.stage === 'built' ? builtUp(o.classId) : {};
  const lo = loadoutB(CLASSES[o.classId].tablets[0], { full: ex.full, level: ex.rowLevel });
  let wins = 0, turns = 0, lost = 0, backFirst = 0;
  for (let i = 0; i < o.n; i++) {
    const b = new Battle2({ seed: (o.seed0 ?? 1) * 7717 + i, classId: o.classId, loadout: lo, talents: ex.talents, relics: ex.relics, waves: o.waves, kind: o.kind });
    const hp0 = b.s.player.hp;
    b.start();
    // turn each enemy died; 后排先死 = a non-guardian died in an earlier turn than every guardian
    const diedAt = new Map<number, number>();
    let guard = 0;
    while (!b.s.result && guard++ < 60) {
      const t = b.s.turn;
      autoBattle2(b, { seed: (o.seed0 ?? 1) * 31 + i, maxTurns: t });
      for (const e of b.s.enemies) if (e.dead && !diedAt.has(e.uid)) diedAt.set(e.uid, t);
    }
    const gT = Math.min(...b.s.enemies.filter(e => e.ct === 'guardian').map(e => diedAt.get(e.uid) ?? 99));
    const bT = Math.min(...b.s.enemies.filter(e => e.ct !== 'guardian').map(e => diedAt.get(e.uid) ?? 99));
    if (bT < gT) backFirst++;
    if (b.s.result === 'win') wins++;
    turns += b.stats.turns; lost += Math.max(0, hp0 - Math.max(0, b.s.player.hp));
  }
  return { win: wins / o.n, turns: turns / o.n, hpLost: lost / o.n, backFirst: backFirst / o.n };
}
/** v4.1 刀鞘 table (rogue): strikes per turn, cap-blocked turns, 刀鞘 +1 picks */
export function formatSheath(rs: SimReport[]): string {
  const head = '| 组合 | 刀鞘开局 | 通关 | 死于 普/精/首 | 1 / 2 / 3 / 4 / 5 / 6 刀 | ≥3 刀 | ≥4 刀 | 刀鞘卡住 | 升级次数/局 | 三选一里有刀鞘 | 有刀鞘时拿它 | 局末刀鞘等级 |\n|---|---|---|---|---|---|---|---|---|---|---|---|';
  const lines = rs.map(r => { const e = r.extra; return `| ${r.label} | ${e.sheathStart} | ${pct(r.winRate)} | ${e.diedNormal}/${e.diedElite}/${e.diedBoss} | ${[e.strikes1, e.strikes2, e.strikes3, e.strikes4, e.strikes5 - e.strikes6, e.strikes6].map(pct).join(' / ')} | ${pct(e.strikesGe3)} | ${pct(e.strikesGe4)} | ${pct(e.capBlockedShare)} | ${f1(e.levelUps)} | ${pct(e.sheathOfferShare)} | ${pct(e.sheathPickShare)} | ${f1(e.sheathEndLevel)} |`; });
  return [head, ...lines].join('\n');
}
/** v4 table (CORE4 §4 targets) */
export function formatV4(rs: SimReport[]): string {
  const head = '| 组合 | 局数 | 通关 | 死于 普/精/首 | 回合/场 普/精/首 | 首领 >12 回合 | 掉血/场 普/精/首 | 刺客 1/2/3/4/5 刀 | ≥3 刀 | ≥4 刀 | 补骰/回合 | 狂战 斩首/完防/任一/两者 · 挨打回合里任一 | 卖血/场 · 返还 | 斩杀再动/场 | 魔导 小咒/释放 每场 · 释放均颗 · 纯吟唱 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|';
  const lines = rs.map(r => { const e = r.extra; const t = r.turnsPerFight; return `| ${r.label} | ${r.n} | ${pct(r.winRate)} | ${e.diedNormal}/${e.diedElite}/${e.diedBoss} | ${f0(t.normal)} / ${f0(t.elite)} / ${f0(t.midBoss)} | ${pct(e.bossOver12)}（最长 ${e.bossMaxTurns}） | ${f0(e.hpLostNormal)} / ${f0(e.hpLostElite)} / ${f0(e.hpLostBoss)} | ${[e.strikes1, e.strikes2, e.strikes3, e.strikes4, e.strikes5].map(pct).join(' / ')} | ${pct(e.strikesGe3)} | ${pct(e.strikesGe4)} | ${f1(e.refillsPerTurn)} | ${pct(e.beheadShare)} / ${pct(e.guardShare)} / ${pct(e.eitherShare)} / ${pct(e.bothShare)} · 普/精/首 ${pct(e.either_normal)} / ${pct(e.either_elite)} / ${pct(e.either_midBoss)} · 挨打回合里 ${pct(e.eitherAttackShare)}（占 ${pct(e.attackShare)}） | ${f0(e.bloodPerFight)} · ${pct(e.refundShare)} | ${f1(e.killActsPerFight)} | ${f1(e.minorPerFight)} / ${f1(e.releasePerFight)} · ${f1(e.releaseDice)} · ${pct(e.holdShare)} |`; });
  return [head, ...lines].join('\n');
}

// CLI: see simcli.ts (vite-node drops the script path from argv, so the runner lives in its own file)
export function runCli(argv: string[]) {
  // npx vite-node src/core/v2/simcli.ts 200 [extra] [v3] [cls=rogue] [stage=built] [sleeve=first2] [refund=1]
  const n = Number(argv.find(a => /^\d+$/.test(a)) || 100);
  const arg = (k: string) => argv.find(a => a.startsWith(k + '='))?.slice(k.length + 1);
  if (arg('sleeve')) V4_PARAMS.sleeveRefill = arg('sleeve') as typeof V4_PARAMS.sleeveRefill;
  if (arg('refund')) V4_PARAMS.bloodRefund = Number(arg('refund'));
  if (arg('start')) V4_PARAMS.rogueStartStrikes = Number(arg('start'));
  // v4.2 rule switches for before / after runs: spell=0 (caster attacks are random statuses again), guardall=0 (one blocked hit is 完防)
  if (arg('spell')) ENEMY_TRAITS.spellHits = arg('spell') !== '0';
  if (arg('guardall')) ENEMY_TRAITS.guardAll = arg('guardall') !== '0';
  let list = argv.includes('v3') ? COMBOS_V3 : argv.includes('extra') ? [...COMBOS, ...COMBOS_EXTRA] : COMBOS;
  if (arg('cls')) list = list.filter(c => c.classId === arg('cls'));
  if (arg('stage')) list = list.map(c => ({ ...c, stage: arg('stage') as Stage }));
  const seed0 = Number(arg('seed') || 1);
  const rs = list.map(c => simulate({ n, seed0, ...c }));
  console.log(`参数：袖箭 ${V4_PARAMS.sleeveRefill}，血偿 ${V4_PARAMS.bloodRefund}，刀鞘开局 ${V4_PARAMS.rogueStartStrikes}，法术伤害可挡 ${ENEMY_TRAITS.spellHits}，完防=全挡 ${ENEMY_TRAITS.guardAll}，${n} 局`);
  console.log(formatTable(rs)); console.log(); console.log(formatV4(rs)); console.log(); console.log(formatRows(rs));
  if (list.some(c => c.classId === 'rogue')) { console.log(); console.log(formatSheath(rs.filter((_, i) => list[i].classId === 'rogue'))); }
  if (argv.includes('taunt')) {
    // 盾卫遭遇（腐化树人 + 哀嚎女妖 + 月光狼灵）：嘲讽开 / 关
    console.log('\n| 遭遇 | 职业 | 构筑 | 嘲讽 | 胜率 | 回合 | 掉血 | 后排先死 |\n|---|---|---|---|---|---|---|---|');
    for (const [name, waves, kind] of [['普通（树人 + 女妖 + 狼灵）', TAUNT_WAVES, 'normal'], ['加强（再 + 食尸鬼，精英倍率）', [[...TAUNT_WAVES[0], 'forest_ghoul']], 'elite']] as Array<[string, string[][], FightKind]>)
      for (const classId of ['warrior', 'mage', 'rogue'] as ClassId[]) for (const stage of ['initial', 'built'] as Stage[]) for (const on of [false, true]) {
        ENEMY_TRAITS.taunt = on;
        const r = simEncounter({ n, classId, waves, kind, stage });
        console.log(`| ${name} | ${CLASSES[classId].name} | ${stage === 'built' ? '成型' : '初始'} | ${on ? '开' : '关'} | ${pct(r.win)} | ${f0(r.turns)} | ${f0(r.hpLost)} | ${pct(r.backFirst)} |`);
      }
    ENEMY_TRAITS.taunt = true;
  }
  return rs;
}
