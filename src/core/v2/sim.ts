// Batch simulation for SPEC_v2.1 §7 metrics. `simulate()` runs N bot runs of the slice and returns a table row;
// `npx vite-node src/core/v2/sim.ts 200` (or tests/v2/sim.test.ts) prints the table for every class × tablet, in the two
// build stages of §7: 初始构筑 (start rows, level I, no talents / relics) and 成型构筑 (full rows, level II, 2 talents, 3 relics).
import { autoBattle2 } from './bot2';
import { Run2, type Run2Options, type RunNode } from './run2';
import { CLASSES, PROTO_RELICS, TABLETS, TALENTS, loadoutB, slotRow } from './data';
import type { Battle2 } from './battle2';
import type { ClassId } from './types';

export interface FightStat {
  kind: string; turns: number; ultimates: number; big4: number; big4Rows: Record<string, number>; diceAtStart: number[]; basics: number; plays: number; rows: Record<string, number>; won: boolean;
  bloodRerolls: number; chantTurns: number; combos: number;
  mixPlays: number; fullRingPlays: number; fullRingDice: number; backlashDeath: boolean;
  preciseSpawns: number; markSpawns: number; sleeveSpawns: number; spawnTurns: number;
  gold: { kill: number; overflow: number; relic: number; summon: number }; capHits: { overflow: boolean; relic: boolean; summon: boolean };
}
export interface RunResult {
  win: boolean; diedAt: number | null; hp: number; gold: number; level: number;
  fights: FightStat[];
  spent: number; relics: string[];
  /** gold when entering the first shop (null = never reached) */
  shopGold: number | null;
}

/** Greedy run policy: level-up prefers add row → evolve → upgrade; first talent offered; shop buys engrave / relic / potion. */
export function autoRun(o: Run2Options & { battleSeed?: number }): RunResult {
  const run = new Run2(o);
  const res: RunResult = { win: false, diedAt: null, hp: 0, gold: 0, level: 1, fights: [], spent: 0, relics: [], shopGold: null };
  let guard = 0;
  while (guard++ < 50) {
    const s = run.s;
    if (s.phase === 'win') { res.win = true; break; }
    if (s.phase === 'dead') break;
    if (s.phase === 'battle') {
      if (s.hp < s.maxHp * 0.5 && s.potions) run.drink();
      const b = run.startBattle();
      autoBattle2(b, { seed: (o.seed * 31 + s.node) >>> 0 });
      res.fights.push(fightStats(run.node().kind, b));
      if (b.s.result !== 'win') { res.diedAt = s.node; run.endBattle(b); break; }
      run.endBattle(b);
      continue;
    }
    if (s.phase === 'choice') {
      const c = run.pending()!;
      if (c.kind === 'levelUp') {
        const pref = ['addRow', 'evolve', 'upgrade'];
        let idx = 0; for (const k of pref) { const i = c.cards.findIndex(x => x.kind === k); if (i >= 0) { idx = i; break; } }
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
  return res;
}
const pri = (k: string) => (k === 'engrave' ? 0 : k === 'relic' ? 1 : 2);

function fightStats(kind: string, b: Battle2): FightStat {
  const st = b.stats, inc = b.s.income;
  return {
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
    },
  };
}

/** v3 default: one pattern tablet per class */
export const COMBOS: Array<{ classId: ClassId; tablet?: string; version?: 'A' | 'B'; stage?: Stage }> = [
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

// CLI: npx vite-node src/core/v2/sim.ts [n] [extra]
const g = globalThis as unknown as { process?: { argv: string[] } };
const argv = g.process?.argv || [];
if (argv.some(a => /sim\.ts$/.test(a))) {
  const n = Number(argv.find(a => /^\d+$/.test(a)) || 100);
  const list = argv.includes('extra') ? [...COMBOS, ...COMBOS_EXTRA] : COMBOS;
  const rs = list.map(c => simulate({ n, ...c }));
  console.log(formatTable(rs)); console.log(); console.log(formatSide(rs)); console.log(); console.log(formatRows(rs));
}
