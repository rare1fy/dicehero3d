// Battle2: rules v2 battle state machine (SPEC_v2 §1, §2, §5). Deterministic (seeded mulberry32 from ../rng), events only, no three / DOM.
// Usage: const b = new Battle2(setup); b.start(); then b.reroll(uids) / b.play(ref, uids, target) / b.endTurn(); each returns events.
import { createRng, type Rng } from '../rng';
import { matchRow, bestMatch, type Match } from './cond';
import {
  CLASSES, CRACKED_VALUES, DROPS, ECON, ENEMY_TRAITS, FIGHT_SCALE, FURY_DIE_SUITS, JUNK, MELEE_START_DISTANCE, OVERKILL_PER_GOLD,
  STAR_DIE_VALUES, SUMMON_MAX_TOTAL, enemyCfgV2, relicV2, slotRow,
} from './data';
import type { Ev2, GainReason, DieSnap2 } from './events2';
import type {
  ClassDefV2, ClassId, Die, DieKind, Effect, Enemy, EnemyAction, EnemyRank, Face, Level, Loadout, RowDef, Status, StatusV2, Suit, Target, Tier, TierName,
} from './types';

const JUNK_ON = JUNK.on;

// ─────────────────────────────────────────────────────────── setup / state
export type FightKind = 'normal' | 'elite' | 'midBoss' | 'boss';
export interface Battle2Setup {
  seed: number; classId: ClassId; loadout: Loadout;
  talents?: Record<string, 1 | 2>; relics?: string[];
  hp?: number; maxHp?: number;
  waves: string[][]; kind: FightKind;
  god?: boolean;
}
export type RowRef = number | 'basic';
export interface BoardRow { ref: number; tablet: number; slot: number; rowId: string; name: string; level: Level; def: RowDef }

export interface PlayerV2 { hp: number; maxHp: number; armor: number; barrier: number; statuses: Status[]; rage: number; backlash: number }
export interface Battle2State {
  turn: number; phase: 'idle' | 'player' | 'enemy' | 'over'; result: null | 'win' | 'lose';
  player: PlayerV2;
  dice: Die[];
  /** dice count this turn started with (for metrics, overload) */
  turnDice: number;
  freeRerollsLeft: number; rerollsThisTurn: number; bloodRerolls: number; freeBloodLeft: number;
  strikesUsed: number; maxStrikes: number;
  lastStrike: { ref: RowRef; count: number } | null;
  comboThisTurn: boolean; earnUsed: boolean; danceUsed: boolean; tripleUsed: boolean; chainUsed: boolean; whetUsed: number;
  stormPct: number;
  // mage
  chantRing: number; overcharge: number; starTurnsLeft: number; resonanceNext: number; chantsThisCycle: number; chantedThisTurn: boolean;
  chantHits: number; echo: number; flipsLeft: number; prismSuit: Suit | null; pierceHitsThisCycle: number;
  /** v2.2 反噬: a chant cycle is running (opens on the first chant after a play, closes when a play resolves) */
  cycleActive: boolean;
  /** v2.2 R3-4: after a play, the leftover dice the mage keeps (uids, at most keepInfo().cap); null = default (highest points) */
  keepSel: number[] | null;
  // rogue
  /** v2.1 飞刀标记: shape the next strike must complete, and the bounced die it must include */
  knifeMark: { shape: KnifeShape; dieUid: number } | null;
  /** v2.1: class spawns this turn (精准产残 + 飞刀标记产残), max 2 */
  classSpawns: number;
  bonusFreeNext: number; chantsThisCycleAtPlay: number;
  // warrior
  overflow: number; rageNext: number; freeBloodNext: number;
  earned: { behead: number; guard: number; tier: number; extra: number };
  caps: { behead: number; guard: number };
  /** dice that go to the next turn (fury, shadow, sheathe, titan, retained) */
  carry: Die[];
  junkNext: 'cracked' | 'cursed' | null;
  nextReasons: GainReason[];
  enemies: Enemy[]; waves: string[][]; waveIdx: number; targetUid: number | null;
  goldEarned: number; xpEarned: number;
  dieUid: number; enemyUid: number;
  /** one-shot relic flags */
  hourglassUsed: boolean;
  /** v2.1 relics: 怒火燎原 primed; 战场急救 uses this fight */
  wildfire: boolean; fieldAidUsed: number;
  /** 铁壁护符 / 稳健之心: +1 free reroll next turn */
  ironNext: boolean; steadyNext: boolean;
  /** v2.1 per-fight income (3.2 caps): kill gold, overflow gold, economy-relic gold, summon gold / xp */
  income: { kill: number; overflow: number; relic: number; summonGold: number; summonXp: number };
}
export interface BattleStats {
  turns: number; diceAtStart: number[]; ultimates: number; plays: number; basics: number; rows: Record<string, number>;
  bloodRerolls: number; chantTurns: number; combos: number; backlashDeath: boolean; strikes: number;
  /** rogue: shadow dice by source; turns with ≥1 class spawn; knife marks set */
  preciseSpawns: number; markSpawns: number; sleeveSpawns: number; spawnTurns: number; marks: number;
  /** mage: 元素交汇 plays; plays from a full ring and the dice they handed in */
  mixPlays: number; fullRingPlays: number; fullRingDice: number;
  /** row plays that handed in ≥4 counted dice (SPEC §7「4 颗质变触发」) */
  big4: number;
  /** big4 by row id */
  big4Rows: Record<string, number>;
  /** income caps hit this fight */
  capHits: { overflow: boolean; relic: boolean; summon: boolean };
}
export type KnifeShape = 'straight' | 'sameValue';
export interface PlayOpts {
  /** 飞刀: shape to mark (default: the first shape row on the board) */
  mark?: KnifeShape;
  /** 飞刀 II+: bounce the die −1 instead of +1 */
  knifeDelta?: 1 | -1;
}
export type Result2 = { ok: true; events: Ev2[] } | { ok: false; reason: string; events: Ev2[] };
export interface Intent2 { kind: 'atk' | 'def' | 'skl' | 'mov' | 'frz' | 'curse'; text: string; value?: number; status?: StatusV2; desc?: string }
export interface RowOption { ref: RowRef; rowId: string; name: string; ok: boolean; tier?: TierName; count?: number; reason?: 'cond' | 'strike' | 'chant' | 'none'; bestTier?: TierName | null }
export interface Preview { total: number; hits: Array<{ uid: number; dmg: number }>; armor: number; barrier: number; heal: number; selfDmg: number; tier: TierName | null; ultimate: boolean; gainDice: number; kills: number[] }

const BACKLASH_CAP = 30;
const NEG: StatusV2[] = ['poison', 'burn', 'vulnerable', 'weak'];
const DOT_DESC: Record<string, StatusV2> = { '灼烧': 'burn', '剧毒': 'poison', '火球': 'burn', '诅咒爆发': 'poison' };
const CTL_DESC: Record<string, StatusV2> = { '虚弱': 'weak', '易伤': 'vulnerable', '碎裂诅咒': 'vulnerable', '诅咒注入': 'weak', '诅咒锻造': 'weak' };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface PlayCtx {
  row: RowDef | null; level: Level; ref: RowRef; tierName: TierName | null; tier: Tier | null;
  dice: Die[]; X: number; count: number; coef: number; bonusPct: number; flat: number;
  ultimate: boolean; target: Enemy | null; strikeIdx: number; combo: boolean;
  dealt: number; kills: number; firstDmg: boolean; halve: boolean;
  /** v2.2 日行 2+: burns laid by this play are held until the mage's next play resolves */
  holdBurn: boolean;
}

// ─────────────────────────────────────────────────────────── battle
export class Battle2 {
  readonly setup: Battle2Setup;
  readonly cls: ClassDefV2;
  rng: Rng;
  s: Battle2State;
  stats: BattleStats;
  private ev: Ev2[] = [];
  private board: BoardRow[];

  constructor(setup: Battle2Setup, restore?: { s: Battle2State; stats: BattleStats; rngState: number }) {
    this.setup = setup;
    this.cls = CLASSES[setup.classId];
    this.board = buildBoard(setup.loadout);
    if (restore) {
      this.s = restore.s; this.stats = restore.stats; this.rng = createRng(restore.rngState);
      return;
    }
    this.rng = createRng(setup.seed);
    const maxHp = setup.maxHp ?? this.cls.hp;
    this.s = {
      turn: 1, phase: 'idle', result: null,
      player: { hp: setup.hp ?? maxHp, maxHp, armor: 0, barrier: 0, statuses: [], rage: 0, backlash: 0 },
      dice: [], turnDice: 0,
      freeRerollsLeft: 0, rerollsThisTurn: 0, bloodRerolls: 0, freeBloodLeft: 0,
      strikesUsed: 0, maxStrikes: 1, lastStrike: null, comboThisTurn: false, earnUsed: false, danceUsed: false, tripleUsed: false, chainUsed: false, whetUsed: 0, stormPct: 0,
      chantRing: 0, overcharge: 0, starTurnsLeft: 0, resonanceNext: 0, chantsThisCycle: 0, chantedThisTurn: false, chantHits: 0, echo: 0, flipsLeft: 0, prismSuit: null, pierceHitsThisCycle: 0, cycleActive: false, keepSel: null,
      knifeMark: null, classSpawns: 0, bonusFreeNext: 0, chantsThisCycleAtPlay: 0,
      overflow: 0, rageNext: 0, freeBloodNext: 0,
      earned: { behead: 0, guard: 0, tier: 0, extra: 0 }, caps: { behead: 1, guard: 1 },
      carry: [], junkNext: null, nextReasons: [],
      enemies: [], waves: setup.waves.map(w => w.slice()), waveIdx: 0, targetUid: null,
      goldEarned: 0, xpEarned: 0, dieUid: 1, enemyUid: 1, hourglassUsed: false,
      wildfire: false, fieldAidUsed: 0, ironNext: false, steadyNext: false, income: { kill: 0, overflow: 0, relic: 0, summonGold: 0, summonXp: 0 },
    };
    this.stats = {
      turns: 0, diceAtStart: [], ultimates: 0, plays: 0, basics: 0, rows: {}, bloodRerolls: 0, chantTurns: 0, combos: 0, backlashDeath: false, strikes: 0,
      preciseSpawns: 0, markSpawns: 0, sleeveSpawns: 0, spawnTurns: 0, marks: 0, mixPlays: 0, fullRingPlays: 0, fullRingDice: 0, big4: 0, big4Rows: {},
      capHits: { overflow: false, relic: false, summon: false },
    };
  }

  clone(): Battle2 {
    return new Battle2(this.setup, { s: structuredClone(this.s), stats: structuredClone(this.stats), rngState: this.rng.state() });
  }

  // ───────────────────────────────────────── queries
  rows(): BoardRow[] { return this.board; }
  dice(): Die[] { return this.s.dice; }
  alive(): Enemy[] { return this.s.enemies.filter(e => !e.dead); }
  enemy(uid: number) { return this.s.enemies.find(e => e.uid === uid) || null; }
  talent(id: string): number { return this.setup.talents?.[id] || 0; }
  hasRelic(id: string) { return !!this.setup.relics?.includes(id); }
  strikesLeft() { return this.s.phase === 'player' ? Math.max(0, this.s.maxStrikes - this.s.strikesUsed) : 0; }
  mustEndTurn() { return this.s.phase === 'player' && (this.strikesLeft() <= 0 || this.s.dice.length === 0); }
  target(): Enemy | null {
    const t = this.s.targetUid != null ? this.enemy(this.s.targetUid) : null;
    if (t && !t.dead) return t;
    const a = this.alive(); const n = a.find(e => e.ct === 'guardian') || a[0] || null;
    this.s.targetUid = n ? n.uid : null; return n;
  }

  /** free = free rerolls left; bloodCost = HP for the next paid reroll (null = class cannot pay) */
  rerollInfo(): { free: number; bloodCost: number | null } {
    const s = this.s;
    if (s.freeRerollsLeft > 0) return { free: s.freeRerollsLeft, bloodCost: this.bloodCost() };
    return { free: 0, bloodCost: this.bloodCost() };
  }
  private bloodCost(): number | null {
    if (this.cls.id !== 'warrior') return null;
    const s = this.s, p = s.player;
    if (s.freeBloodLeft > 0) return 0;
    if (this.hasStatus('player', 'berserk')) return 3;
    // v2.2 1.8: the k-th sale this turn costs ceil(maxHp × 2% × 2^(k−1)); free sales count toward k too
    return Math.ceil(p.maxHp * 0.02 * 2 ** s.bloodRerolls - 1e-9);
  }
  canReroll(uids: number[]): string | null {
    const s = this.s;
    if (s.phase !== 'player') return '不是你的回合';
    const sel = this.pick(uids); if (!sel.length || sel.length !== uids.length) return '先选要重投的骰子';
    if (s.freeRerollsLeft > 0) { if (sel.some(d => d.kind === 'cursed')) return '诅咒骰不能免费重投'; return null; }
    const c = this.bloodCost(); if (c == null) return '重投次数用完了';
    if (c >= s.player.hp) return '生命不足以卖血';
    return null;
  }

  /** Per-row state for the selected dice (tablet lamps). */
  options(uids: number[]): RowOption[] {
    const sel = this.pick(uids), faces = sel.map(d => this.faceOf(d)), kinds = sel.map(d => d.kind);
    const allF = this.s.dice.map(d => this.faceOf(d)), allK = this.s.dice.map(d => d.kind);
    const out: RowOption[] = this.board.map(r => {
      const bm = bestMatch(r.def, allF, allK);
      const base = { ref: r.ref as RowRef, rowId: r.def.id, name: r.def.name, bestTier: bm ? bm.match.tier : null };
      const why = this.rowBlocked(r.def); if (why) return { ...base, ok: false, reason: why };
      if (!sel.length) return { ...base, ok: false, reason: 'none' as const };
      const m = matchRow(r.def, faces, kinds);
      return m ? { ...base, ok: true, tier: m.tier, count: m.count } : { ...base, ok: false, reason: 'cond' as const };
    });
    const ba = this.cls.basicAttack;
    out.push({ ref: 'basic', rowId: 'basic', name: ba.name, ok: sel.length >= ba.minDice && sel.length <= ba.maxDice, bestTier: null });
    return out;
  }
  private rowBlocked(def: RowDef): RowOption['reason'] | null {
    if (def.onlyAsStrike === 2 && this.s.strikesUsed < 1) return 'strike';
    if (def.flags?.needChant && this.s.chantsThisCycle < def.flags.needChant) return 'chant';
    return null;
  }
  /** Can this row fire with these dice? Returns the match, or a reason string. */
  check(ref: RowRef, uids: number[]): { match: Match | null; reason?: string } {
    const s = this.s;
    if (s.phase !== 'player') return { match: null, reason: '不是你的回合' };
    if (this.strikesLeft() <= 0) return { match: null, reason: '本回合不能再出手' };
    if (!this.alive().length) return { match: null, reason: '没有目标' };
    const sel = this.pick(uids); if (!sel.length || sel.length !== uids.length || new Set(uids).size !== uids.length) return { match: null, reason: '先选骰子' };
    if (ref === 'basic') {
      const ba = this.cls.basicAttack;
      if (sel.length < ba.minDice || sel.length > ba.maxDice) return { match: null, reason: `${ba.name}要交 ${ba.minDice === ba.maxDice ? ba.minDice : ba.minDice + '～' + ba.maxDice} 颗` };
      return { match: { count: sel.length, companions: 0, tier: 'single', tierIdx: 0 } };
    }
    const r = this.board[ref]; if (!r) return { match: null, reason: '没有这一行' };
    const why = this.rowBlocked(r.def); if (why) return { match: null, reason: why === 'strike' ? '这一行只能当第二刀' : '吟唱回合不够' };
    const m = matchRow(r.def, sel.map(d => this.faceOf(d)), sel.map(d => d.kind));
    return m ? { match: m } : { match: null, reason: '骰子不满足这一行的条件' };
  }

  preview(ref: RowRef, uids: number[], target?: number): Preview | null {
    if (!this.check(ref, uids).match) return null;
    const c = this.clone();
    const p0 = { armor: c.s.player.armor, barrier: c.s.player.barrier, hp: c.s.player.hp };
    const ev = c.doPlay(ref, uids, target, true);
    const hits = new Map<number, number>(); let ult = false, tier: TierName | null = null, gain = 0, self = 0, heal = 0;
    const kills: number[] = [];
    for (const e of ev) {
      if (e.t === 'hit') { hits.set(e.uid, (hits.get(e.uid) || 0) + e.dmg); if (e.killed) kills.push(e.uid); }
      if (e.t === 'rowPlay') { ult = e.ultimate; tier = e.tier; }
      if (e.t === 'gainDice') gain += e.n;
      if (e.t === 'hp') { if (e.delta < 0) self -= e.delta; else heal += e.delta; }
    }
    return {
      total: [...hits.values()].reduce((a, b) => a + b, 0), hits: [...hits].map(([uid, dmg]) => ({ uid, dmg })),
      armor: Math.max(0, c.s.player.armor - p0.armor), barrier: Math.max(0, c.s.player.barrier - p0.barrier), heal, selfDmg: self,
      tier, ultimate: ult, gainDice: gain, kills,
    };
  }

  /** Dice count next turn (before overflow cut) and its reasons, for the floating prep area. */
  nextDice(): { count: number; overflow: number; reasons: GainReason[] } {
    const raw = this.nextRaw();
    return { count: Math.min(6, raw), overflow: this.cls.overflow === 'damagePct' ? Math.max(0, raw - 6) : 0, reasons: this.s.nextReasons.slice() };
  }
  private nextRaw(): number {
    const s = this.s;
    if (this.cls.id === 'warrior') return 3 + s.earned.behead + s.earned.guard + s.earned.tier + s.earned.extra + Math.min(this.talent('t_ember') >= 2 ? 2 : 1, s.carry.filter(d => d.kind === 'furyDie').length + (s.phase === 'player' ? s.dice.filter(d => d.kind === 'furyDie' && d.carried < (this.talent('t_ember') ? 2 : 1)).length : 0));
    if (this.cls.id === 'mage') {
      if (s.phase !== 'player') return 3 + s.chantRing;   // turn start: the ring was settled at the end of the last turn
      if (s.strikesUsed === 0) return 3 + Math.min(3, s.chantRing + (this.talent('t_deepchant') && s.chantsThisCycle < this.talent('t_deepchant') ? 2 : 1));
      return 3 + s.resonanceNext;
    }
    return 3 + s.carry.length + (s.phase === 'player' ? this.shadowCarryCount() : 0);
  }

  /**
   * 魔导「再吟唱一回合，预计多承受 Y 伤害」: Y = extra damage from backlash layers if this turn is a chant, hit by hit against the
   * enemies' current intents (barrier included; N and layers continue the current cycle). 0 for other classes.
   */
  chantRisk(): number {
    const s = this.s, p = s.player;
    if (this.cls.id !== 'mage' || s.result) return 0;
    const ring = s.chantRing;
    let barrier = p.barrier + 4 + 2 * (ring + s.overcharge);
    let barrier0 = barrier, armor = p.armor, armor0 = armor;
    let layers = p.backlash, n = s.chantHits, extra = 0;
    const mul = (this.hasStatus('player', 'vulnerable') ? 1.5 : 1);
    for (const e of this.alive()) {
      const it = this.intent(e);
      if (it.kind !== 'atk' || !it.value) continue;
      const raw = it.value * mul;
      const take = (v: number, b: number, a: number) => { const bb = Math.min(b, v); v -= bb; const aa = Math.min(a, v); return { hp: v - aa, b: b - bb, a: a - aa }; };
      const w = take(Math.ceil(raw * (1 + 0.1 * layers) - 1e-9), barrier, armor);
      const o = take(Math.ceil(raw - 1e-9), barrier0, armor0);
      extra += Math.max(0, w.hp - o.hp);
      barrier = w.b; armor = w.a; barrier0 = o.b; armor0 = o.a;
      n++; layers = Math.min(BACKLASH_CAP, layers + 2 ** n);
    }
    return extra;
  }

  /** 刺客: shadow dice that would carry to next turn if the turn ended now (v2.2: only unused ones on the field) */
  private shadowCarryCount(): number {
    const s = this.s;
    if (this.cls.id !== 'rogue' || s.classSpawns <= 0) return 0;
    return Math.min(1 + this.talent('t_shadowbox'), s.dice.filter(d => d.kind === 'shadowDie').length);
  }
  /** 魔导 after a play: how many leftovers may stay (3, 余韵 4), whether the player must choose, and the current pick. null = no choice now */
  keepInfo(): { cap: number; need: boolean; selected: number[] } | null {
    const s = this.s;
    if (this.cls.id !== 'mage' || s.phase !== 'player' || s.strikesUsed === 0 || this.lastWasLightBasic) return null;
    const cap = 3 + s.resonanceNext;
    const left = s.dice.filter(d => d.kind !== 'cracked' && d.kind !== 'cursed');
    return { cap, need: left.length > cap, selected: this.keepSelection(left, cap) };
  }
  /** 魔导: choose which leftover dice stay after a play (at most cap). No events. */
  setKeep(uids: number[]): Result2 {
    const k = this.keepInfo(); if (!k) return this.fail('现在不用选保留的骰子');
    const sel = this.pick(uids);
    if (sel.length !== uids.length || new Set(uids).size !== uids.length) return this.fail('只能选场上的骰子');
    if (sel.length > k.cap) return this.fail('最多保留 ' + k.cap + ' 颗');
    this.s.keepSel = uids.slice();
    return { ok: true, events: [] };
  }
  private keepSelection(left: Die[], cap: number): number[] {
    const ok = left.filter(d => d.kind !== 'cracked' && d.kind !== 'cursed');
    const sel = this.s.keepSel;
    if (sel) return sel.filter(u => ok.some(d => d.uid === u)).slice(0, cap);
    return ok.map((d, i) => ({ d, i })).sort((a, b) => b.d.face.value - a.d.face.value || a.i - b.i).slice(0, cap).map(x => x.d.uid);
  }

  intent(e: Enemy): Intent2 {
    if (this.hasStatus(e, 'stun') || this.hasStatus(e, 'freeze')) return { kind: 'frz', text: this.hasStatus(e, 'freeze') ? '冻结' : '眩晕' };
    if (this.isMelee(e) && e.distance > 0) return { kind: 'mov', text: '逼近 ' + e.distance };
    const a = this.enemyAction(e);
    const pc = e.ct === 'priest' || e.ct === 'caster';
    if (e.taunted && (a.type !== '攻击' || pc)) { const v = this.attackValue(e, e.attackDmg); return { kind: 'atk', text: String(v), value: v }; }
    if (a.type === '防御') return { kind: 'def', text: String(a.value), value: a.value };
    if (a.curse) return JUNK_ON ? { kind: 'curse', text: '诅咒骰', desc: a.desc } : { kind: 'skl', text: '剧毒 1', status: 'poison', value: 1, desc: a.desc };
    if (a.type === '技能' || (pc && a.type === '攻击')) {
      const dot = a.desc ? DOT_DESC[a.desc] : undefined, ctl = a.desc ? CTL_DESC[a.desc] : undefined;
      if (!pc && (dot || ctl)) { const v = this.attackValue(e, e.attackDmg); return { kind: 'atk', text: v + '+' + (dot || ctl), value: v, status: dot || ctl }; }
      if (dot) return { kind: 'skl', text: dot + ' ' + a.value, status: dot, value: a.value, desc: a.desc };
      if (ctl) return { kind: 'skl', text: ctl, status: ctl, desc: a.desc };
      return { kind: 'skl', text: '施法', desc: a.desc };
    }
    const v = this.attackValue(e, a.value);
    return { kind: 'atk', text: String(v), value: v, desc: a.desc };
  }

  // ───────────────────────────────────────── actions
  start(): Ev2[] {
    this.ev = [];
    if (this.s.phase !== 'idle') return [];
    this.spawnWave(0);
    this.turnStart();
    return this.flush();
  }

  reroll(uids: number[]): Result2 {
    this.ev = [];
    const why = this.canReroll(uids); if (why) return this.fail(why);
    const s = this.s, p = s.player;
    const sel = this.pick(uids);
    let cost = 0, free = false;
    if (s.freeRerollsLeft > 0) { s.freeRerollsLeft--; free = true; }
    else {
      cost = this.bloodCost()!;
      if (s.freeBloodLeft > 0) s.freeBloodLeft--;
      s.bloodRerolls++;
      if (cost > 0) { p.hp -= cost; this.emit({ t: 'hp', who: 'player', delta: -cost, hp: p.hp, reason: 'reroll' }); }
      this.stats.bloodRerolls++;
    }
    let capped = false;
    // 1.8: HP → rage +1 (or +5 armor when full) → fury-die check → reroll
    if (!free) {
      if (p.rage >= 5) { capped = true; p.armor += 5; this.emit({ t: 'armor', who: 'player', delta: 5, total: p.armor, reason: '血怒已满' }); }
      else { p.rage++; this.emit({ t: 'rage', stacks: p.rage }); }
    }
    s.rerollsThisTurn++;
    // 怒火骰: the paid reroll that reaches rage 3 (狂血: 2, and II also 4) turns one of the rerolled dice into a fury die
    let fury: Die | null = null;
    if (!free && !capped && this.cls.id === 'warrior') {
      const marks = this.talent('t_wildblood') ? (this.talent('t_wildblood') >= 2 ? [2, 4] : [2]) : [3];
      if (marks.includes(p.rage)) {
        const cand = sel.filter(d => d.kind === 'normal'); fury = cand.length ? cand[this.rng.int(0, cand.length - 1)] : null;
        if (fury) {
          const titan = this.board.some(r => r.def.flags?.titanFist);
          fury.kind = titan ? 'titanDie' : 'furyDie'; fury.source = 'mechanic'; fury.persist = titan ? 'turn' : 'untilUsed';
        }
      }
    }
    this.emit({ t: 'reroll', uids: sel.map(d => d.uid), hpCost: cost, rage: p.rage, capped, free });
    for (const d of sel) this.rollDie(d);
    if (fury) this.emit({ t: 'special', action: 'transform', uid: fury.uid, kind: fury.kind, value: fury.face.value, suit: fury.face.suit });
    this.emit({ t: 'roll', dice: sel.map(d => this.snap(d)), reason: 'reroll', kept: [] });
    return { ok: true, events: this.flush() };
  }

  /** 魔导天赋「逆转」: flip one die to its opposite face (7 − value). */
  flip(uid: number): Result2 {
    this.ev = [];
    const s = this.s; if (s.phase !== 'player') return this.fail('不是你的回合');
    if (s.flipsLeft <= 0) return this.fail('没有逆转次数');
    const d = this.pick([uid])[0]; if (!d || d.kind === 'cursed') return this.fail('这颗不能翻');
    s.flipsLeft--;
    this.setFace(d, 7 - d.face.value);
    this.emit({ t: 'roll', dice: [this.snap(d)], reason: 'flip', kept: [] });
    return { ok: true, events: this.flush() };
  }

  play(ref: RowRef, uids: number[], targetUid?: number, opts?: PlayOpts): Result2 {
    this.ev = [];
    const c = this.check(ref, uids); if (!c.match) return this.fail(c.reason || '不能出手');
    this.doPlay(ref, uids, targetUid, false, opts);
    return { ok: true, events: this.flush() };
  }

  endTurn(opts?: { keep?: number[] }): Result2 {
    this.ev = [];
    if (this.s.phase !== 'player') return this.fail('不是你的回合');
    if (opts?.keep) { const r = this.setKeep(opts.keep); if (!r.ok) return r; }
    this.finishPlayerTurn();
    if (!this.s.result) this.enemyTurn();
    return { ok: true, events: this.flush() };
  }

  // ───────────────────────────────────────── play resolution
  /** returns the events of this play (also left in this.ev) */
  private doPlay(ref: RowRef, uids: number[], targetUid: number | undefined, dry: boolean, opts?: PlayOpts): Ev2[] {
    const s = this.s, p = s.player;
    const m = this.check(ref, uids).match!;
    const sel = this.pick(uids);
    this.rewards = [];
    if (targetUid != null) { const t = this.enemy(targetUid); if (t && !t.dead) s.targetUid = t.uid; }
    const target = this.target();
    const row = ref === 'basic' ? null : this.board[ref];
    const def = row?.def || null, level: Level = row?.level || 1;
    const strikeIdx = s.strikesUsed;
    const isRogue = this.cls.id === 'rogue';
    // v2.1 精准连击: same row as the previous strike (damage); 精准产残 also needs more dice than that strike
    const combo = isRogue && !!def && !!s.lastStrike && s.lastStrike.ref === ref;
    const preciseSpawn = combo && sel.length > s.lastStrike!.count;
    // v2.1 飞刀标记: this strike completes the mark set by the previous one
    const mk = isRogue ? s.knifeMark : null;
    const markDone = !!mk && !!def && !!def.flags?.shape && def.cond.t === mk.shape && sel.some(d => d.uid === mk.dieUid) && sel.length >= 3 && sel.length === s.dice.length;
    if (isRogue) s.knifeMark = null;
    const tierName = def ? m.tier : null;
    const tier = def && tierName ? def.tiers[tierName] || null : null;
    const ultimate = tierName === 'ultimate';

    // X: points handed in (浴血 / 不屈 / 幻影 modify)
    const pts = sel.map(d => this.points(d, def));
    const X = pts.reduce((a, b) => a + b, 0);
    // percent bonuses (added, SPEC 1.6)
    let bonus = 0;
    if (this.cls.id === 'warrior') {
      bonus += p.rage * 0.15 * (def?.flags?.rageDouble ? 2 : 1);
      bonus += s.overflow * [0.1, 0.2, 0.3][this.talent('t_overdrive')];
      if (this.hasStatus('player', 'berserk')) bonus += 0.3;
    }
    if (this.cls.id === 'mage') bonus += s.overcharge * 0.1;
    if (isRogue) {
      if (strikeIdx >= 1) bonus += [0.2, 0.35, 0.5][this.talent('t_dualmaster')];
      if (combo) bonus += [0.25, 0.4, 0.55][this.talent('t_precision')];
      if (markDone && this.talent('t_markmaster')) bonus += 0.3;
      if (strikeIdx === 2 && this.talent('t_triple') >= 2) bonus += 0.3;
      bonus += s.stormPct;
    }
    // relics: once per whole play (4.1); flat bonuses land on the first damage segment only
    let flat = 0;
    if (this.hasRelic('grindstone') && sel.length <= 2) flat += 12;
    if (this.hasRelic('greedy_hand') && sel.length >= 4) flat += 20;
    if (this.hasRelic('wildfire') && s.wildfire && sel.length >= 2) { flat += ECON.wildfireFlat; s.wildfire = false; this.emit({ t: 'relic', id: 'wildfire', text: '+' + ECON.wildfireFlat }); }
    if (this.hasRelic('dice_master') && sel.length >= 5) { flat += 15; bonus += 0.3; }
    if (this.hasRelic('twin_stars') && def?.cond.t === 'sameValue') bonus += 0.5;
    if (this.hasRelic('elemental_overload') && sel.length >= 3 && new Set(sel.map(d => this.faceOf(d).suit)).size === 1 && this.faceOf(sel[0]).suit !== 'none') bonus += 0.6;
    if (def?.flags?.perLen && def.cond.t === 'straight') bonus += def.flags.perLen * Math.max(0, sel.length - 3);
    if (def?.flags?.chantBonus) bonus += s.chantsThisCycleAtPlay * (level >= 2 ? def.flags.chantBonusL2 ?? def.flags.chantBonus : def.flags.chantBonus);
    if (def?.flags?.chase && strikeIdx >= 2) bonus += def.flags.chase - 1;

    s.strikesUsed++; this.stats.strikes++;
    if (ref === 'basic') this.stats.basics++; else { this.stats.plays++; this.stats.rows[def!.id] = (this.stats.rows[def!.id] || 0) + 1; }
    if (ultimate) this.stats.ultimates++;
    if (def && m.count >= 4) { this.stats.big4++; this.stats.big4Rows[def.id] = (this.stats.big4Rows[def.id] || 0) + 1; }
    if (combo) { this.stats.combos++; s.comboThisTurn = true; }
    if (def && this.cls.id === 'mage') {
      if (def.cond.t === 'mixedRelease') this.stats.mixPlays++;
      if (s.chantRing >= 3) { this.stats.fullRingPlays++; this.stats.fullRingDice += sel.length; }
    }
    this.emit({ t: 'rowPlay', ref, rowId: def ? def.id : 'basic', name: def ? def.name : this.cls.basicAttack.name, tier: tierName, count: m.count, uids: sel.map(d => d.uid), companions: m.companions, target: target ? target.uid : null, strike: strikeIdx + 1, ultimate, combo, X, bonusPct: Math.round(bonus * 100) });

    // dice leave the field (飞刀 returns its die later)
    const knife = !!tier?.effects.some(e => e.t === 'hook' && e.id === 'knifeReturn');
    s.dice = s.dice.filter(d => !sel.includes(d));
    this.emit({ t: 'spent', uids: sel.map(d => d.uid) });
    // self damage from special / junk dice
    let self = 0;
    for (const d of sel) { if (d.kind === 'titanDie') self += Math.ceil(p.maxHp * 0.1); if (d.kind === 'cracked') self += 2; }
    if (self) this.changeHp(-self, 'self');

    const ctx: PlayCtx = {
      row: def, level, ref, tierName, tier, dice: sel, X, count: m.count, coef: def ? this.coefOf(def, level, tier) : this.cls.basicAttack.coef,
      bonusPct: bonus, flat, ultimate, target, strikeIdx, combo, dealt: 0, kills: 0, firstDmg: true, halve: false,
      holdBurn: !!tier?.effects.some(e => e.t === 'hook' && e.id === 'burnHold'),
    };
    // mage: playing breaks the chant
    if (this.cls.id === 'mage') {
      const light = ref === 'basic' && sel.length === 1 && this.talent('t_lightspell') > 0 && s.strikesUsed === 1;
      this.lastWasLightBasic = light;
      if (!light) {
        if (s.turnDice >= 6 && (m.count + this.devourCount(ctx)) >= 4 && def) { const n = this.talent('t_supernova') ? 3 : 2; s.starTurnsLeft = n; if (this.talent('t_supernova') >= 2) s.bonusFreeNext = 1; this.emit({ t: 'overload', turns: n }); }
        s.resonanceNext = 0; s.chantRing = 0; s.overcharge = 0; s.chantsThisCycle = 0; s.pierceHitsThisCycle = 0; s.cycleActive = false;
        // 反噬: layers and N both clear on a play (2.2)
        s.chantHits = 0;
        if (p.backlash) { p.backlash = 0; this.emit({ t: 'backlash', stacks: 0 }); }
      }
    }

    if (ref === 'basic') this.resolveBasic(ctx);
    else this.resolveTier(ctx);

    // rogue bookkeeping
    if (isRogue) {
      s.lastStrike = ref === 'basic' ? null : { ref, count: sel.length };
      if (strikeIdx === 0) { s.freeRerollsLeft++; this.emit({ t: 'freeReroll', n: 1, reason: 'firstStrike' }); }
      if (preciseSpawn) this.classSpawn('precise');
      if (markDone) {
        this.classSpawn('mark');
        if (this.talent('t_markmaster') >= 2) { s.freeRerollsLeft++; this.emit({ t: 'freeReroll', n: 1, reason: 'markmaster' }); }
      }
      if (strikeIdx === 2 && this.talent('t_triple') && !s.tripleUsed) { s.tripleUsed = true; this.addStrike(1, '三连闪'); }
      if (def?.flags?.tripleFlash && strikeIdx === 2 && !s.tripleUsed) { s.tripleUsed = true; this.addStrike(1, '三连闪'); }
      if (def?.flags?.bladeStorm) s.stormPct += def.flags.bladeStorm;
      if (this.hasRelic('shadow_drain') && strikeIdx === 1 && ref !== 'basic') this.changeHp(6, 'heal');
    }
    if (knife) {
      this.knifeReturn(sel, def!, level, opts?.knifeDelta);
      if (def!.flags?.marksShape && sel.length) {
        const shape = this.markShape(opts?.mark);
        if (shape) { s.knifeMark = { shape, dieUid: sel[0].uid }; this.stats.marks++; }
      }
    }
    // relics on play
    if (this.hasRelic('healing_breeze')) this.changeHp(3, 'heal');
    if (this.hasRelic('lucky_coin')) this.relicGold(2);
    if (this.cls.id === 'mage' && this.talent('t_prism') && def) { const su = suitOfCond(def); if (su) s.prismSuit = su; }
    // v2.2 R3-3: once a mage play resolves, burns held from earlier 日行 plays go out; the ones this play laid stay
    if (this.cls.id === 'mage' && !this.lastWasLightBasic) {
      for (const e of this.alive()) {
        const b = e.statuses.find(x => x.type === 'burn'); if (!b || !b.held) continue;
        b.value = Math.max(0, b.value - b.held); b.held = 0;
        if (b.value <= 0) { e.statuses = e.statuses.filter(x => x !== b); this.emit({ t: 'statusExpire', who: e.uid, type: 'burn' }); }
      }
    }
    // v2.2 1.9: kill rewards come after the whole play (effects, spawned dice), then the turn / wave ends
    const rw = this.rewards; this.rewards = null;
    if (rw) for (const f of rw) f();

    this.resolveDeaths(true);
    void dry;
    return this.ev;
  }

  /** 飞刀标记 shape: the requested one if a row of that shape is on the board, else the first shape row */
  private markShape(want?: KnifeShape): KnifeShape | null {
    const shapes = this.board.filter(r => r.def.flags?.shape && (r.def.cond.t === 'straight' || r.def.cond.t === 'sameValue')).map(r => r.def.cond.t as KnifeShape);
    if (want && shapes.includes(want)) return want;
    return shapes[0] || null;
  }
  /** shapes the knife may mark on this board (for the UI picker) */
  markShapes(): KnifeShape[] {
    return [...new Set(this.board.filter(r => r.def.flags?.shape && (r.def.cond.t === 'straight' || r.def.cond.t === 'sameValue')).map(r => r.def.cond.t as KnifeShape))];
  }
  /** 职业产残 (精准 / 飞刀标记): a shadow die now; max 2 per turn; the first one also means 1 shadow die carries to next turn */
  private classSpawn(reason: 'precise' | 'mark') {
    const s = this.s;
    if (s.classSpawns >= 2) return;
    s.classSpawns++;
    if (s.classSpawns === 1) this.stats.spawnTurns++;
    if (reason === 'precise') this.stats.preciseSpawns++; else this.stats.markSpawns++;
    this.spawnShadow(1, reason);
    this.gain(s.classSpawns === 1 ? 1 : 0, reason);
  }
  private relicGold(n: number) {
    const s = this.s, room = ECON.relicGoldCap - s.income.relic;
    const g = Math.max(0, Math.min(n, room));
    if (g < n) this.stats.capHits.relic = true;
    s.income.relic += g; s.goldEarned += g;
  }

  private coefOf(def: RowDef, level: Level, tier: Tier | null) {
    return def.coef[level - 1] * (tier?.coefMul ?? 1) + (tier?.coefAdd ?? 0);
  }
  private devourCount(ctx: PlayCtx) {
    return ctx.tier?.effects.some(e => e.t === 'hook' && e.id === 'devour') ? this.s.dice.filter(d => !ctx.dice.includes(d)).length : 0;
  }

  private resolveBasic(ctx: PlayCtx) {
    const t = ctx.target; if (!t) return;
    const base = ctx.X * ctx.coef + ctx.flat;
    if (base > 0) this.dealHit(t, this.finalDmg(base, ctx, t), ctx, {});
    if (this.cls.basicAttack.shadowify) {
      const d = ctx.dice[0];
      const su = this.faceOf(d).suit;
      if (su === 'poison' || su === 'blade' || d.kind === 'cracked' || d.kind === 'cursed') { this.stats.sleeveSpawns++; this.spawnShadow(1, 'shadowify'); }
    }
  }

  private resolveTier(ctx: PlayCtx, sub = false) {
    const s = this.s, p = s.player, def = ctx.row!, flags = def.flags || {};
    // v2.2: effects tagged onStrike only fire on that strike (1 = the first, 2 = any later one)
    const fx = (ctx.tier?.effects || []).filter(e => !e.onStrike || (e.onStrike === 1 ? ctx.strikeIdx === 0 : ctx.strikeIdx >= 1));
    const isRogue = this.cls.id === 'rogue';
    // rogue: +1 strike / shadow from the earn tier only once per turn
    const earnGate = isRogue && fx.some(e => e.t === 'earnDie');
    const earnBlocked = earnGate && s.earnUsed;
    if (earnGate && !earnBlocked) s.earnUsed = true;
    // devour (虚空坍缩): other dice join this hit
    const devour = fx.find(e => e.t === 'hook' && e.id === 'devour') as Extract<Effect, { t: 'hook' }> | undefined;
    if (devour) {
      const rest = s.dice.slice(); s.dice = [];
      if (rest.length) { this.emit({ t: 'spent', uids: rest.map(d => d.uid) }); const per = ctx.level >= 2 ? devour.p?.perL2 ?? 3 : devour.p?.per ?? 2; ctx.flat += rest.reduce((a, d) => a + this.faceOf(d).value, 0) * per; }
    }
    // assassin: 1 shadow die → ×3.5 ignore armor
    if (flags.assassin && ctx.count === 1) ctx.coef = flags.assassin;
    // void 4+ → ultimate hits all
    const voidAll = def.id.startsWith('m_void') && ctx.ultimate && ctx.count >= 4;
    const late = (e: Effect) => (e.t === 'heal' && e.of === 'dmg') || (e.t === 'hook' && (e.id === 'furyUlt' || e.id === 'killShadow'));
    const ordered = [...fx.filter(e => !late(e)), ...fx.filter(late)];
    for (const e of ordered) {
      if (!this.alive().length && (e.t === 'dmg' || e.t === 'hook' && ['bolts', 'dance', 'twinCut', 'elements', 'transfer'].includes(e.id))) continue;
      switch (e.t) {
        case 'dmg': {
          let tgt: Target = e.target; if (voidAll) tgt = 'all';
          if (flags.armorToDmg && ctx.target) { ctx.flat += ctx.target.armor; ctx.target.armor = 0; }
          this.damageEffect(ctx, tgt, e.mul ?? 1, e.flat ?? 0, { ignoreArmor: !!e.ignoreArmor || !!(flags.assassin && ctx.count === 1), armorBreak: !!e.armorBreak, raw: !!e.raw });
          break;
        }
        case 'armor': {
          let v = 0;
          if (e.of === 'coef2') v = ctx.X * (def.coef2 ? def.coef2[ctx.level - 1] : 1) * (ctx.tier?.coefMul ?? 1) * e.mul;
          else if (e.of === 'suitPoints') v = ctx.dice.filter(d => this.faceOf(d).suit === e.suit).reduce((a, d) => a + this.points(d, def), 0) * e.mul;
          else v = e.mul;
          this.addArmor(Math.ceil(v), def.name);
          if (flags.armorStrike) { const t = ctx.count >= 3 ? 'all' : 'one'; this.damageEffect(ctx, t, 0, Math.ceil(p.armor * flags.armorStrike), { rawFlat: true }); }
          break;
        }
        case 'barrier': {
          let mul = e.mul;
          if (flags.barrier3 && ctx.count === 3) mul *= flags.barrier3;   // 成对行: 3 颗时屏障 ×1.5
          const v = Math.ceil(ctx.X * mul * (ctx.halve ? 0.5 : 1)); p.barrier += v; this.emit({ t: 'barrier', delta: v, total: p.barrier }); break;
        }
        case 'heal': {
          let v = 0;
          if (e.of === 'X') v = ctx.X * e.mul; else if (e.of === 'dmg') v = ctx.dealt * e.mul; else if (e.of === 'flat') v = e.mul;
          else v = ctx.dice.filter(d => this.faceOf(d).suit === e.suit).reduce((a, d) => a + this.points(d, def), 0) * e.mul;
          this.healPlayer(Math.ceil(v), flags, e.overArmor);
          break;
        }
        case 'status': {
          let v = e.ofX != null ? Math.ceil(ctx.X * e.ofX) : e.value;
          if (e.status === 'burn') { if (flags.burnL3 && ctx.level >= 3) v = Math.ceil(v * flags.burnL3); if (flags.burnHalf) v = Math.ceil(v / 2); }
          if (e.target === 'self') { this.addPlayerStatus(e.status, v, e.duration); break; }
          for (const t of this.targets(e.target, ctx.target)) this.addEnemyStatus(t, e.status, v, e.duration, e.status === 'burn' && ctx.holdBurn);
          break;
        }
        case 'stun': for (const t of this.targets(e.target, ctx.target)) this.stunEnemy(t, e.look || 'stun', e.turns || 1, ctx.ultimate, e.elseWeak); break;
        case 'taunt': for (const t of this.alive()) t.taunted = true; break;
        case 'purify': this.purifyPlayer(e.n, flags.purifyHeal); break;
        case 'earnDie': this.applyEarn(ctx, earnBlocked); break;
        case 'capUp': s.caps[e.which] += e.n; break;
        case 'rage': p.rage = Math.min(5, p.rage + e.n); this.emit({ t: 'rage', stacks: p.rage }); break;
        case 'freeBlood': s.freeBloodNext = 1; break;
        case 'spawnShadow': if (!earnBlocked) this.spawnShadow(e.n, 'tier'); break;
        case 'extraStrike': if (!earnBlocked) this.addStrike(e.n, def.name); break;
        case 'resonance': s.resonanceNext = Math.max(s.resonanceNext, e.n); break;
        case 'hook': this.hook(e.id, e.p || {}, ctx); break;
      }
    }
    if (flags.echo) this.s.echo = 0;
    if (def.flags?.vulnFromL2 && ctx.level >= 2 && ctx.target && !ctx.target.dead) this.addEnemyStatus(ctx.target, 'vulnerable', 1, 1);
    // 破绽: the hit target is vulnerable for 2 turns
    if (flags.gapVuln && ctx.target && !ctx.target.dead && ctx.dealt > 0) this.addEnemyStatus(ctx.target, 'vulnerable', 1, flags.gapVuln);
    void sub;
  }

  private hook(id: string, p: Record<string, number>, ctx: PlayCtx) {
    const s = this.s, def = ctx.row!, flags = def.flags || {};
    switch (id) {
      case 'furyUlt': {
        if (ctx.kills > 0) { s.earned.extra++; this.gain(1, 'furyUlt'); if (flags.titanOnBehead) this.carryNew('titanDie'); }
        break;
      }
      case 'cleave': break;   // handled in dealHit via ctx.row tiers (see damageEffect)
      case 'twinCut': {
        const vals = ctx.dice.map(d => this.points(d, def)); const sorted = vals.slice().sort((a, b) => a - b);
        const pairA = sorted[0] * 2, pairB = sorted[2] * 2;
        const a = ctx.target, others = this.alive().filter(e => e !== a); const b = others[0] || a;
        if (a) this.dealHit(a, this.finalDmg(pairA * ctx.coef + ctx.flat, ctx, a), ctx, {});
        ctx.flat = 0;
        if (b && !b.dead) this.dealHit(b, this.finalDmg(pairB * ctx.coef, ctx, b), ctx, {});
        if (ctx.kills >= 2) { s.caps.behead = Math.max(s.caps.behead, 2); }
        if (flags.killHeal) this.changeHp(flags.killHeal * ctx.kills, 'heal');
        break;
      }
      case 'bolts': {
        const stars = ctx.dice.filter(d => this.faceOf(d).suit === 'star');
        const pts = stars.map(d => this.points(d, def));
        // v2.2 R3-6: extra bolts use the average star points (not rounded); each bolt rounds on its own (1.6)
        const avg = pts.reduce((a, b) => a + b, 0) / Math.max(1, pts.length);
        let n = pts.length + s.chantsThisCycleAtPlay + (p.extra || 0);
        if (p.double) n *= 2;
        const per = ctx.coef - (p.minus || 0);   // coef = flat bolt damage for this row
        const list: number[] = []; for (let i = 0; i < n; i++) list.push((pts[i] ?? avg) + per);
        const hit = new Set<Enemy>();
        for (const [i, v] of list.entries()) {
          if (!this.alive().length) break;
          const fl = i === 0 ? ctx.flat : 0;   // fixed bonuses land on the first bolt only (1.6)
          if (p.all) for (const t of this.alive()) { this.dealHit(t, this.finalDmg(v * (ctx.halve ? 0.5 : 1) + fl, ctx, t), ctx, { aoe: true }); hit.add(t); }
          else {
            let t = ctx.target && !ctx.target.dead ? ctx.target : null;
            if (!t && flags.boltChain) t = this.alive()[0] || null;
            if (!t) break;
            this.dealHit(t, this.finalDmg(v * (ctx.halve ? 0.5 : 1) + fl, ctx, t), ctx, {}); hit.add(t);
          }
        }
        ctx.firstDmg = false;
        // v2.1 星行: targets hit become vulnerable for 1 turn (after the volley, so the bolts themselves do not double-dip)
        if (flags.boltVuln) for (const t of hit) if (!t.dead) this.addEnemyStatus(t, 'vulnerable', 1, 1);
        break;
      }
      case 'burnHold': break;   // marker: burns this tier lays are held (see PlayCtx.holdBurn)
      case 'devour': break;   // handled up front
      // 刃行: first strike turns blades into shadow dice (淬刃: poison instead); a later strike heals
      case 'bladeFirst': {
        const blades = ctx.dice.filter(d => this.faceOf(d).suit === 'blade').length;
        if (flags.venomFirst && ctx.target) this.addEnemyStatus(ctx.target, 'poison', blades * flags.venomFirst);
        else { const n = Math.floor(blades / (p.per || 2)) + (p.extra || 0); if (n > 0) this.spawnShadow(n, 'blade'); }
        break;
      }
      case 'bladeSecond': {
        const blades = ctx.dice.filter(d => this.faceOf(d).suit === 'blade').length;
        this.healPlayer(blades * (p.per || 3) * (p.mul || 1), flags);
        if (p.purify) this.purifyPlayer(p.purify);
        break;
      }
      case 'dance': {
        let segs = ctx.dice.map(d => this.points(d, def));
        if (p.double) segs = segs.concat(segs);
        for (const v of segs) {
          if (!this.alive().length) break;
          const targets = p.all ? this.alive() : [ctx.target && !ctx.target.dead ? ctx.target : this.alive()[0]];
          for (const t of targets) { this.dealHit(t, this.finalDmg(v * ctx.coef * (p.mul ?? 1) + (ctx.firstDmg ? ctx.flat : 0), ctx, t), ctx, { aoe: !!p.all }); if (p.weak && !t.dead) this.addEnemyStatus(t, 'weak', 1, 1); }
          ctx.firstDmg = false;
        }
        if (ctx.dice.length === 2 && !s.danceUsed && !s.earnUsed) { s.danceUsed = true; s.earnUsed = true; this.addStrike(1, def.name); this.spawnShadow(1, 'dance'); }
        break;
      }
      case 'poison': {
        const per = ctx.coef; let stacks = ctx.count * per;
        const targets = p.all ? this.alive() : ctx.target && !ctx.target.dead ? [ctx.target] : [];
        for (const t of targets) {
          if (ctx.strikeIdx >= 1 && t === ctx.target) { const cur = this.stv(t, 'poison'); if (cur > 0) this.dealHit(t, Math.ceil(cur * 0.5), ctx, { source: 'detonate', raw: true }); }
          if (t.dead) continue;
          let n = stacks; if (p.extra && this.stv(t, 'poison') > 0) n += ctx.count;
          if (flags.doublePoison) n = Math.max(n, this.stv(t, 'poison'));
          this.addEnemyStatus(t, 'poison', n);
        }
        void stacks;
        break;
      }
      case 'deathTouch': {
        for (const t of this.alive()) {
          const v = (this.stv(t, 'poison') + this.stv(t, 'burn')) * 2;
          if (v > 0) this.dealHit(t, v, ctx, { source: 'detonate', raw: true, aoe: true });
        }
        break;
      }
      case 'killShadow': if (ctx.kills > 0) this.spawnShadow(ctx.kills, 'kill'); break;
      case 'knifeReturn': break;   // after the play
      case 'transfer': break;      // handled in damageEffect (overkill → lowest-HP other enemy)
      case 'elements': this.elements(ctx, !!p.all); break;
    }
  }

  /** 元素交汇: X × coef (all at 6), +resonance per element status already on the target, then one element effect per suit with ≥2 dice */
  private elements(ctx: PlayCtx, all: boolean) {
    const def = ctx.row!, flags = def.flags || {};
    const bySuit = new Map<Suit, number[]>();
    for (const d of ctx.dice) { const su = this.faceOf(d).suit; if (su === 'none') continue; const l = bySuit.get(su) || []; l.push(this.points(d, def)); bySuit.set(su, l); }
    const per = (def.cond.t === 'mixedRelease' ? def.cond.perSuit : 2);
    const four = !!flags.anyFourSuits && bySuit.size >= 4;
    const fired = [...bySuit.entries()].filter(([, l]) => l.length >= (four ? 1 : per)).map(([su]) => su);
    const ignoreArmor = fired.includes('void');
    const pct = flags.resonancePct ?? 0.25;
    const targets = all ? this.alive() : this.targets('one', ctx.target);
    for (const t of targets) {
      if (t.dead) continue;
      const res = (['burn', 'freeze', 'vulnerable'] as StatusV2[]).filter(x => this.hasStatus(t, x)).length;
      const base = ctx.X * ctx.coef + (ctx.firstDmg ? ctx.flat : 0);
      const c2: PlayCtx = { ...ctx, bonusPct: ctx.bonusPct + res * pct };
      this.dealHit(t, this.finalDmg(base, c2, t), ctx, { aoe: all, ignoreArmor });
      ctx.firstDmg = false;
    }
    for (const t of targets) {
      if (t.dead) continue;
      if (fired.includes('star')) this.addEnemyStatus(t, 'vulnerable', 1, 1);
      if (fired.includes('moon')) this.stunEnemy(t, 'freeze', 1, ctx.ultimate, 2);
      if (fired.includes('sun')) { const v = (bySuit.get('sun') || []).reduce((a, b) => a + b, 0); this.addEnemyStatus(t, 'burn', v); }
    }
  }

  /** damage effect on its targets; mul × X × coef (raw: X only) + flat */
  private damageEffect(ctx: PlayCtx, tgt: Target, mul: number, flatAdd: number, o: { ignoreArmor?: boolean; armorBreak?: boolean; raw?: boolean; rawFlat?: boolean }) {
    const def = ctx.row, flags = def?.flags || {};
    const targets = this.targets(tgt, ctx.target);
    const aoe = tgt === 'all' || tgt === 'others';
    for (const t of targets) {
      if (t.dead) continue;
      let base = o.rawFlat ? flatAdd : (o.raw ? ctx.X : ctx.X * ctx.coef) * mul + flatAdd + (ctx.firstDmg ? ctx.flat : 0);
      if (!o.rawFlat && flags.rageFlat) base += flags.rageFlat * this.s.player.rage;
      if (!o.rawFlat && flags.echo && ctx.firstDmg) base += Math.min(flags.echo, this.s.echo);
      const execLine = flags.executeHigh && ctx.count >= 3 ? flags.executeHigh : flags.execute;
      if (execLine && t.hp < t.maxHp * execLine && !o.rawFlat) base *= 2;
      if (flags.frozenBonusFromL2 && ctx.level >= 2 && (this.hasStatus(t, 'freeze') || t.ctlImmune > 0)) base *= 1 + flags.frozenBonusFromL2;
      if (flags.judge && t.rank !== 'midBoss' && t.rank !== 'boss' && t.hp < t.maxHp * flags.judge) base = Math.max(base, t.hp + t.armor);
      const d = this.finalDmg(base * (ctx.halve && !o.rawFlat ? 1 : 1), ctx, t);
      this.dealHit(t, d, ctx, { aoe, ignoreArmor: o.ignoreArmor, armorBreak: o.armorBreak });
      // 顺劈 (同点行 feed+): overkill carries to another enemy, chains
      if (t.dead && ctx.tier?.effects.some(e => e.t === 'hook' && e.id === 'cleave')) {
        let over = t.overkill;
        while (over > 0) { const n = this.alive()[0]; if (!n) break; this.dealHit(n, over, ctx, { source: 'cleave', raw: true }); over = n.dead ? n.overkill : 0; }
      }
      // 千钧行 (3+): overkill goes in full to the lowest-HP other enemy; 4 颗 chains
      const tr = ctx.tier?.effects.find(e => e.t === 'hook' && e.id === 'transfer') as Extract<Effect, { t: 'hook' }> | undefined;
      if (t.dead && tr) {
        let over = t.overkill;
        while (over > 0) {
          const n = this.alive().slice().sort((a, b) => a.hp - b.hp)[0]; if (!n) break;
          this.dealHit(n, over, ctx, { source: 'cleave', raw: true });
          over = n.dead && tr.p?.chain ? n.overkill : 0;
        }
      }
      if (flags.knifeBounce && def?.id.startsWith('r_knife')) { const o2 = this.alive().find(e => e !== t); if (o2) this.dealHit(o2, d, ctx, {}); }
    }
    if (!o.rawFlat) ctx.firstDmg = false;
  }

  /** ⌈base × (1 + bonus) × weak × vulnerable⌉ */
  private finalDmg(base: number, ctx: PlayCtx, t: Enemy) {
    let v = base * (1 + ctx.bonusPct);
    if (this.hasStatus('player', 'weak')) v *= 0.75;
    if (this.hasStatus(t, 'vulnerable')) v *= 1.5;
    return Math.max(0, Math.ceil(v - 1e-9));
  }

  private dealHit(t: Enemy, dmg: number, ctx: PlayCtx, o: { aoe?: boolean; ignoreArmor?: boolean; armorBreak?: boolean; source?: 'play' | 'cleave' | 'detonate'; raw?: boolean }) {
    if (t.dead) return;
    const ignore = !!o.ignoreArmor || ctx.ultimate;
    let absorbed = 0, hpDmg = dmg;
    if (o.armorBreak && t.armor > 0) { this.emit({ t: 'armor', who: t.uid, delta: -t.armor, total: 0, reason: '破甲' }); t.armor = 0; }
    else if (!ignore && t.armor > 0) { absorbed = Math.min(t.armor, dmg); t.armor -= absorbed; hpDmg = dmg - absorbed; }
    const before = t.hp; t.hp = Math.max(0, t.hp - hpDmg);
    const killed = t.hp <= 0;
    if (killed) { t.overkill = Math.max(0, hpDmg - before); t.killedDirect = true; ctx.kills++; }
    ctx.dealt += Math.min(before, hpDmg);
    this.emit({ t: 'hit', uid: t.uid, dmg, absorbed, hpDmg: before - t.hp, killed, aoe: !!o.aoe, ultimate: ctx.ultimate, source: o.source || 'play' });
    if (killed) this.markDead(t, true, ctx);
    else this.afterEnemyHit(t);
  }

  private applyEarn(ctx: PlayCtx, blocked = false) {
    const s = this.s;
    if (this.cls.earnDieMode === 'nextTurnPlusOne') { if (s.earned.tier < 1) { s.earned.tier = 1; this.gain(1, 'tier'); } }
    else if (this.cls.earnDieMode === 'resonance') { if (s.resonanceNext < 1) { s.resonanceNext = 1; this.gain(1, 'resonance'); } }
    void ctx; void blocked;   // rogue: the tier lists extraStrike + spawnShadow itself
  }

  private knifeReturn(sel: Die[], def: RowDef, level: Level, delta?: 1 | -1) {
    const s = this.s;
    // II+: the player may bounce −1 instead of +1
    const dv = delta === -1 && level >= 2 ? -1 : 1;
    for (const d of sel) {
      const v = clamp(d.face.value + dv, 1, 6);
      this.setFace(d, v);
      if (def.flags?.knifeBounce) this.rollDie(d);
      s.dice.push(d);
    }
    this.emit({ t: 'roll', dice: sel.map(d => this.snap(d)), reason: 'return', kept: [] });
  }

  // ───────────────────────────────────────── turn flow
  private turnStart() {
    const s = this.s, p = s.player, cls = this.cls;
    if (s.result) return;
    // armor / barrier clear (不动如山 keeps half / two thirds)
    const keep = [0, 0.5, 2 / 3][this.talent('t_mountain')];
    const na = Math.floor(p.armor * keep); if (na !== p.armor) { this.emit({ t: 'armor', who: 'player', delta: na - p.armor, total: na, reason: '回合开始' }); p.armor = na; }
    if (p.barrier) { p.barrier = 0; this.emit({ t: 'barrier', delta: 0, total: 0 }); }
    // dice count
    const raw = this.nextRaw();
    const count = Math.min(cls.maxDice, raw);
    s.overflow = cls.overflow === 'damagePct' ? Math.max(0, raw - cls.maxDice) : 0;
    const reasons = s.nextReasons.slice();
    s.phase = 'player';
    // reset per-turn
    const relicFree = (s.ironNext ? 1 : 0) + (s.steadyNext ? 1 : 0);
    if (relicFree) this.emit({ t: 'freeReroll', n: relicFree, reason: s.ironNext ? 'iron_charm' : 'steady_heart' });
    s.ironNext = false; s.steadyNext = false;
    s.freeRerollsLeft = cls.freeRerolls + s.bonusFreeNext + relicFree; s.bonusFreeNext = 0; s.resonanceNext = 0;
    s.rerollsThisTurn = 0; s.bloodRerolls = 0; s.strikesUsed = 0; s.maxStrikes = cls.strikesPerTurn;
    s.lastStrike = null; s.comboThisTurn = false; s.earnUsed = false; s.danceUsed = false; s.tripleUsed = false; s.chainUsed = false; s.whetUsed = 0; s.stormPct = 0;
    s.knifeMark = null; s.classSpawns = 0;
    s.freeBloodLeft = s.freeBloodNext + [0, 1, 2][this.talent('t_instinct')]; s.freeBloodNext = 0;
    p.rage = Math.min(3, s.rageNext); s.rageNext = 0; if (p.rage) this.emit({ t: 'rage', stacks: p.rage });
    s.caps = { behead: 1 + (this.hasRelic('war_crest') ? 1 : 0), guard: 1 + (this.hasRelic('war_crest') ? 1 : 0) };
    s.chantsThisCycleAtPlay = s.chantsThisCycle;
    s.chantedThisTurn = false; s.flipsLeft = this.talent('t_reverse');
    for (const e of s.enemies) e.taunted = false;
    // build the field: carried / retained dice first, then fresh dice
    const carried = s.carry; s.carry = [];
    const field: Die[] = [];
    const kept: number[] = [];
    for (const d of carried) {
      if (field.length >= count) { this.emit({ t: 'special', action: 'vanish', uid: d.uid, kind: d.kind, value: d.face.value, suit: d.face.suit }); continue; }
      d.carried++;
      if (d.persist === 'retained') {
        if (this.board.some(r => r.def.flags?.retainGrow)) this.setFace(d, Math.min(6, d.face.value + 1));
        kept.push(d.uid);
      } else if (d.source === 'mechanic' && d.kind === 'normal') kept.push(d.uid);   // 收刀: value kept
      else this.rollDie(d);
      field.push(d);
    }
    const fresh: Die[] = [];
    while (field.length + fresh.length < count) {
      const kind: DieKind = s.starTurnsLeft > 0 ? 'starDie' : 'normal';
      fresh.push(this.newDie(kind, 'base'));
    }
    if (s.starTurnsLeft > 0) s.starTurnsLeft--;
    if (s.junkNext && fresh.length) {
      const i = this.rng.int(0, fresh.length - 1); const d = fresh[i];
      d.kind = s.junkNext; d.source = 'enemy'; d.persist = 'turn'; this.rollDie(d);
    }
    s.junkNext = null;
    // 棱镜聚焦: at least 1 / 2 fresh dice of the chosen suit
    if (s.prismSuit && this.talent('t_prism')) {
      const need = this.talent('t_prism'); const vals = cls.suitTable.map((su, v) => su === s.prismSuit ? v : 0).filter(v => v > 0);
      let have = fresh.filter(d => d.kind === 'normal' && d.face.suit === s.prismSuit).length;
      for (const d of fresh) { if (have >= need) break; if (d.kind !== 'normal' || d.face.suit === s.prismSuit || !vals.length) continue; this.setFace(d, vals[this.rng.int(0, vals.length - 1)]); have++; }
      s.prismSuit = null;
    }
    s.dice = field.concat(fresh);
    s.turnDice = s.dice.length;
    s.earned = { behead: 0, guard: 0, tier: 0, extra: 0 }; s.nextReasons = [];
    this.stats.turns++; this.stats.diceAtStart.push(s.turnDice);
    this.emit({ t: 'turnStart', turn: s.turn, diceCount: s.turnDice, overflow: s.overflow, strikes: s.maxStrikes, reasons });
    this.emit({ t: 'roll', dice: s.dice.map(d => this.snap(d)), reason: 'turn', kept });
  }

  /** Leftover dice go to the class mechanic. */
  private finishPlayerTurn() {
    const s = this.s, p = s.player, cls = this.cls;
    const left = s.dice; s.dice = [];
    const vanish = (d: Die) => this.emit({ t: 'special', action: 'vanish', uid: d.uid, kind: d.kind, value: d.face.value, suit: d.face.suit });
    if (cls.id === 'warrior') {
      const maxKeep = this.talent('t_ember') >= 2 ? 2 : 1, maxAge = this.talent('t_ember') >= 1 ? 2 : 1;
      let kept = s.carry.filter(d => d.kind === 'furyDie').length;
      for (const d of left) {
        if (d.kind === 'furyDie' && d.carried < maxAge && kept < maxKeep) { kept++; s.carry.push(d); this.gain(0, 'fury'); this.emit({ t: 'special', action: 'carry', uid: d.uid, kind: d.kind, value: d.face.value, suit: d.face.suit }); }
        else if (d.kind !== 'normal') vanish(d);
      }
    } else if (cls.id === 'mage') {
      const light = s.strikesUsed === 1 && this.lastWasLightBasic;
      const chant = s.strikesUsed === 0 || light;
      if (chant) {
        const before = s.chantRing, overBefore = s.overcharge;
        let add = 1; if (this.talent('t_deepchant') && s.chantsThisCycle < this.talent('t_deepchant')) add = 2;
        if (s.chantRing >= 3) { s.overcharge++; } else s.chantRing = Math.min(3, s.chantRing + add);
        s.chantsThisCycle++; s.chantedThisTurn = true; s.cycleActive = true; this.stats.chantTurns++;
        // v2.2 R3-5: barrier = 4 + 2 × (ring before this chant + overcharge turns before this one)
        let bar = 4 + 2 * (before + overBefore);
        if (light && this.talent('t_lightspell') < 2) bar = Math.ceil(bar / 2);
        p.barrier += bar; this.emit({ t: 'barrier', delta: bar, total: p.barrier });
        this.emit({ t: 'chant', ring: s.chantRing, barrier: p.barrier, overcharge: s.overcharge });
        this.gain(s.chantRing - before, 'chant');
        if (this.hasRelic('charge_core')) { this.addArmor(4, '蓄力晶核'); this.changeHp(3, 'heal'); }
      }
      const cap = chant ? 3 + s.chantRing : 3 + s.resonanceNext;
      // v2.2 R3-4: after a play the player picks which leftovers stay (default: highest points); a chant keeps them all
      const pick = chant ? null : new Set(this.keepSelection(left, cap));
      for (const d of left) {
        if (d.kind === 'cracked' || d.kind === 'cursed') { vanish(d); continue; }
        if ((pick ? pick.has(d.uid) : true) && s.carry.length < cap) { d.persist = 'retained'; s.carry.push(d); } else vanish(d);
      }
      s.keepSel = null;
      if (!chant) { s.chantRing = s.resonanceNext; }
      // v2.1 反噬: N runs over the whole chant cycle and only clears on a play (doPlay)
    } else {
      // 暗影残骰 (v2.2 1.1): a class spawn this turn lets 1 (影匣 2 / 3) shadow die still on the field stay; nothing is created
      const n = s.classSpawns > 0 ? 1 + this.talent('t_shadowbox') : 0;
      const keep = left.filter(d => d.kind === 'shadowDie').slice(0, n);
      for (const d of left) {
        if (keep.includes(d) && s.carry.length < 6) {
          d.persist = 'untilUsed'; s.carry.push(d); this.gain(s.carry.length > 1 ? 1 : 0, 'shadow');
          this.emit({ t: 'special', action: 'carry', uid: d.uid, kind: d.kind, value: d.face.value, suit: d.face.suit });
        } else vanish(d);
      }
    }
    if (this.hasRelic('steady_heart') && s.strikesUsed > 0 && s.rerollsThisTurn === 0) s.steadyNext = true;
    this.lastWasLightBasic = false;
  }
  private lastWasLightBasic = false;
  /** kill rewards queued during a play (paid after it resolves); null outside a play */
  private rewards: Array<() => void> | null = null;

  private enemyTurn() {
    const s = this.s, p = s.player;
    s.phase = 'enemy';
    this.emit({ t: 'enemyTurn', turn: s.turn });
    for (const e of this.alive()) e.justSummoned = false;
    for (const e of this.alive().slice()) this.trySummon(e);
    // enemy DoT (end of the player's turn): burn then poison
    for (const e of this.alive()) {
      e.armor = 0;
      const b = e.statuses.find(x => x.type === 'burn');
      if (b && b.value > 0) {
        this.dotEnemy(e, b.value, 'burn');
        // v2.2: plain burn goes out; the held part (日行 2+) stays until the mage's next play resolves
        const held = Math.min(b.value, (b.held || 0) + (b.heldNew || 0));
        if (held > 0) { b.value = held; b.held = held; b.heldNew = 0; }
        else { e.statuses = e.statuses.filter(x => x !== b); this.emit({ t: 'statusExpire', who: e.uid, type: 'burn' }); }
      }
      if (e.dead) continue;
      const po = e.statuses.find(x => x.type === 'poison');
      if (po && po.value > 0) { this.dotEnemy(e, po.value, 'poison'); po.value--; if (po.value <= 0) { e.statuses = e.statuses.filter(x => x !== po); this.emit({ t: 'statusExpire', who: e.uid, type: 'poison' }); } }
    }
    if (this.waveCleared()) { this.afterWaveClear(); return; }
    // actions
    for (const e of this.alive().slice()) {
      if (s.result) return;
      if (e.dead || e.justSummoned) { e.age++; continue; }
      this.enemyAct(e);
      e.age++;
      if (s.result) return;
    }
    if (this.waveCleared()) { this.afterWaveClear(); return; }
    // junk traits (one junk die per turn at most), boss armor
    for (const e of this.alive()) if (JUNK_ON) this.junkTrait(e);
    for (const e of this.alive()) if ((e.rank === 'midBoss' || e.rank === 'boss') && e.age > 0 && e.age % 2 === 0) { const v = Math.floor(e.attackDmg * 2); e.armor += v; this.emit({ t: 'armor', who: e.uid, delta: v, total: e.armor, reason: '护盾' }); }
    // enemy durations
    for (const e of this.alive()) this.tickEnemy(e);
    // player DoT and durations
    const pp = p.statuses.find(x => x.type === 'poison');
    if (pp && pp.value > 0) { const v = pp.value; pp.value--; if (pp.value <= 0) p.statuses = p.statuses.filter(x => x !== pp); this.emit({ t: 'statusTick', who: 'player', type: 'poison', dmg: v }); this.playerTakeHit(v, null, true); if (s.result) return; }
    const pb = p.statuses.find(x => x.type === 'burn');
    if (pb && pb.value > 0) { p.statuses = p.statuses.filter(x => x !== pb); this.emit({ t: 'statusTick', who: 'player', type: 'burn', dmg: pb.value }); this.playerTakeHit(pb.value, null, true); if (s.result) return; }
    const before = p.statuses.map(x => x.type);
    p.statuses = p.statuses.filter(x => { if (x.duration == null) return true; x.duration--; return x.duration > 0; });
    for (const ty of before) if (!p.statuses.some(x => x.type === ty)) this.emit({ t: 'statusExpire', who: 'player', type: ty });
    s.turn++;
    this.turnStart();
  }

  private dotEnemy(e: Enemy, v: number, type: StatusV2) {
    e.hp = Math.max(0, e.hp - v);
    this.emit({ t: 'statusTick', who: e.uid, type, dmg: v });
    if (e.hp <= 0) this.markDead(e, false, null); else this.afterEnemyHit(e);
  }
  private tickEnemy(e: Enemy) {
    if (e.ctlImmune > 0) e.ctlImmune--;
    const before = e.statuses.map(x => x.type);
    const hadCtl = e.statuses.some(x => x.type === 'stun' || x.type === 'freeze');
    e.statuses = e.statuses.filter(x => { if (x.type === 'poison' || x.type === 'burn') return true; if (x.duration == null) return false; x.duration--; return x.duration > 0; });
    if (hadCtl && !e.statuses.some(x => x.type === 'stun' || x.type === 'freeze')) e.ctlImmune = 1;
    for (const t of before) if (!e.statuses.some(x => x.type === t)) this.emit({ t: 'statusExpire', who: e.uid, type: t });
  }

  private enemyAct(e: Enemy) {
    const s = this.s;
    if (this.hasStatus(e, 'stun') || this.hasStatus(e, 'freeze')) {
      this.emit({ t: 'enemyAct', uid: e.uid, kind: this.hasStatus(e, 'freeze') ? 'frozen' : 'stunned' });
      if (this.cls.id === 'warrior' && s.earned.guard < s.caps.guard) { s.earned.guard++; this.gain(1, 'stun', e.uid); }
      return;
    }
    if (this.isMelee(e) && e.distance > 0) { e.distance--; this.emit({ t: 'enemyMove', uid: e.uid, distance: e.distance }); return; }
    const a = this.enemyAction(e);
    const pc = e.ct === 'priest' || e.ct === 'caster';
    const half = e.interrupted ? 0.5 : 1; const interrupted = e.interrupted; e.interrupted = false;
    if (e.taunted && (a.type !== '攻击' || pc)) { this.enemyAttack(e, Math.floor(this.attackValue(e, e.attackDmg) * half), undefined, interrupted, true); return; }
    if (a.type === '防御') { const v = Math.floor(a.value * half); e.armor += v; this.emit({ t: 'enemyAct', uid: e.uid, kind: 'defend', value: v, interrupted }); this.emit({ t: 'armor', who: e.uid, delta: v, total: e.armor, reason: '防御' }); return; }
    if (a.curse) {
      this.emit({ t: 'enemyAct', uid: e.uid, kind: 'curse', desc: a.desc, interrupted });
      // v2.1 原型: junk dice are off; the lich's 诅咒 is 1 poison stack (3D behaviour)
      if (JUNK_ON) this.addJunk('cursed', e); else this.addPlayerStatus('poison', 1);
      return;
    }
    if (a.type === '技能' || (pc && a.type === '攻击')) {
      const dot = a.desc ? DOT_DESC[a.desc] : undefined, ctl = a.desc ? CTL_DESC[a.desc] : undefined;
      if (!pc && (dot || ctl)) {
        this.enemyAttack(e, Math.floor(this.attackValue(e, e.attackDmg) * half), a.desc, interrupted, false);
        if (s.result) return;
        const st = (dot || ctl)!; this.addPlayerStatus(st, st === 'poison' || st === 'burn' ? Math.max(1, Math.floor((a.value || 1) / 2)) : 1, st === 'poison' || st === 'burn' ? undefined : 2);
        return;
      }
      this.emit({ t: 'enemyAct', uid: e.uid, kind: 'skill', desc: a.desc || '施法', value: a.value, interrupted });
      if (dot) this.addPlayerStatus(dot, Math.max(1, Math.floor(a.value * half)));
      else if (ctl) this.addPlayerStatus(ctl, 1, 2);
      else this.casterSkill(e, half);
      return;
    }
    this.enemyAttack(e, Math.floor(this.attackValue(e, a.value) * half), a.desc, interrupted, false);
  }
  private enemyAttack(e: Enemy, v: number, desc: string | undefined, interrupted: boolean, taunted: boolean) {
    this.emit({ t: 'enemyAct', uid: e.uid, kind: 'attack', desc, value: v, interrupted, taunted });
    this.playerTakeHit(v, e, false);
    if (!this.s.result && this.rng.next() < 0.3) this.quote(e, 'attack', 1);
  }
  private casterSkill(e: Enemy, half: number) {
    const r = this.rng.next(), atk = e.attackDmg * half;
    if (r < 0.4) this.addPlayerStatus('poison', Math.max(2, Math.floor(atk * 0.4)));
    else if (r < 0.7) this.addPlayerStatus('burn', Math.max(1, Math.floor(atk * 0.3)));
    else { this.addPlayerStatus('poison', Math.max(1, Math.floor(atk * 0.25))); this.addPlayerStatus('weak', 1, 2); }
  }

  private enemyAction(e: Enemy): { type: EnemyAction['type']; value: number; desc?: string; curse: boolean; phaseIdx: number } {
    const cfg = enemyCfgV2(e.cfgId), ph = cfg.phases;
    let chosen = ph[ph.length - 1], idx = ph.length - 1;
    for (let i = 0; i < ph.length; i++) { const q = ph[i]; if (q.hpThreshold == null) { chosen = q; idx = i; continue; } if (e.hp >= e.maxHp * q.hpThreshold) { chosen = q; idx = i; break; } }
    const acts = chosen.actions;
    const a = acts[e.age % acts.length];
    const value = a.scalable === false ? a.baseValue : Math.floor(a.baseValue * this.fightScale().dmg);
    return { type: a.type, value, desc: a.description, curse: !!a.curseDice, phaseIdx: idx };
  }
  private fightScale() { return FIGHT_SCALE[this.setup.kind]; }
  private attackValue(e: Enemy, base: number) {
    let v = base;
    if (e.ct === 'warrior') v = Math.floor(v * 1.3);
    if (ENEMY_TRAITS.vengeance && e.arch === 'berserker' && e.vengeance > 0 && !e.cfgId.startsWith('boss_')) v = Math.floor(v * (1 + 0.5 * e.vengeance));
    if (this.hasStatus(e, 'weak')) v = Math.max(1, Math.floor(v * 0.75));
    return v;
  }

  private junkTrait(e: Enemy) {
    const t = e.age;   // already incremented: number of enemy turns this enemy has had
    if (e.rank === 'elite' && t % JUNK.eliteCycle === 0) { this.addJunk('cracked', e); return; }
    if (e.rank === 'midBoss' || e.rank === 'boss') {
      if (e.hp / e.maxHp < JUNK.bossCurseHpRatio && t % JUNK.bossCurseCycle === 0) { this.addJunk('cursed', e); return; }
      if (t % JUNK.bossCrackedCycle === 0) this.addJunk('cracked', e);
    }
  }
  private addJunk(kind: 'cracked' | 'cursed', e: Enemy) {
    const s = this.s;
    if (s.junkNext === 'cursed' || (s.junkNext === 'cracked' && kind === 'cracked')) return;   // at most one per turn; cursed wins
    s.junkNext = kind; this.emit({ t: 'junk', kind, from: e.uid });
  }

  private trySummon(e: Enemy) {
    const sm = enemyCfgV2(e.cfgId).summons; if (!sm || e.isSummoned) return;
    const t = e.age + 1;
    const interval = Math.max(1, sm.interval), offset = sm.offset || 0, count = sm.count || 1, maxTotal = SUMMON_MAX_TOTAL[e.cfgId] ?? sm.maxTotal ?? 3, waveCap = sm.waveCap ?? 4;
    if ((t - offset) % interval !== 0 || e.summoned >= maxTotal) return;
    const wave = this.alive().length; if (wave >= waveCap) return;
    if (sm.hpThreshold != null && e.hp / e.maxHp > sm.hpThreshold) return;
    const n = Math.min(count, maxTotal - e.summoned, waveCap - wave);
    for (let i = 0; i < n; i++) {
      const m = this.buildEnemy(sm.minionId, 'summon', { hp: 1, dmg: 1 });
      m.isSummoned = true; m.justSummoned = true;
      this.s.enemies.push(m);
      this.emit({ t: 'summon', by: e.uid, uid: m.uid });
      this.emit({ t: 'enemyEnter', uid: m.uid, summonedBy: e.uid });
    }
    e.summoned += n;
  }

  // ───────────────────────────────────────── player damage
  private playerTakeHit(dmg: number, e: Enemy | null, isDot: boolean) {
    const s = this.s, p = s.player;
    let v = dmg;
    if (!isDot) {
      if (this.hasStatus('player', 'vulnerable')) v *= 1.5;
      if (this.hasStatus('player', 'berserk')) v *= 1.2;
      // 反噬: this hit uses the layers already there; the new 2^N layers come after (2.2)
      v *= 1 + 0.1 * p.backlash;
      v = Math.ceil(v - 1e-9);
    }
    let rem = Math.max(0, v), byBarrier = 0, byArmor = 0;
    if (p.barrier > 0 && rem > 0) { byBarrier = Math.min(p.barrier, rem); p.barrier -= byBarrier; rem -= byBarrier; }
    if (!isDot && p.armor > 0 && rem > 0) { byArmor = Math.min(p.armor, rem); p.armor -= byArmor; rem -= byArmor; }
    if (byBarrier) s.echo += byBarrier;
    const before = p.hp;
    if (rem > 0) p.hp = Math.max(this.setup.god ? 1 : 0, p.hp - rem);
    const hpDmg = before - p.hp;
    const perfectBlock = !isDot && v > 0 && rem === 0 && byArmor > 0;
    this.emit({ t: 'playerHit', from: e ? e.uid : null, dmg: v, byBarrier, byArmor, hpDmg, isDot, perfectBlock });
    // 完防
    if (perfectBlock && this.cls.id === 'warrior' && s.earned.guard < s.caps.guard) { s.earned.guard++; this.gain(1, 'guard', e?.uid); }
    if (perfectBlock && e && this.board.some(r => r.def.flags?.thorns)) { const t = e; if (!t.dead) { t.hp = Math.max(0, t.hp - byArmor); this.emit({ t: 'hit', uid: t.uid, dmg: byArmor, absorbed: 0, hpDmg: byArmor, killed: t.hp <= 0, aoe: false, ultimate: false, source: 'thorns' }); if (t.hp <= 0) this.markDead(t, false, null); } }
    // 法术反噬: hits during a chant cycle (also those the barrier stopped); N counts from the cycle start, cap 30
    if (!isDot && e && this.cls.id === 'mage' && s.cycleActive && v > 0) {
      const blockedByBarrier = rem === 0 && byArmor === 0;
      const sv = this.talent('t_steadyvein');
      let skip = blockedByBarrier && sv > 0;
      if (!skip && !blockedByBarrier && sv >= 2 && s.pierceHitsThisCycle === 0) { s.pierceHitsThisCycle++; skip = true; }
      if (!skip) {
        s.chantHits++; p.backlash = Math.min(BACKLASH_CAP, p.backlash + 2 ** s.chantHits); this.emit({ t: 'backlash', stacks: p.backlash });
      }
    }
    if (!isDot && v > 0 && e) {
      if (this.hasRelic('wildfire')) s.wildfire = true;
      if (this.hasRelic('iron_charm')) s.ironNext = true;
    }
    if (p.hp <= 0) {
      if (this.hasRelic('emergency_hourglass') && !s.hourglassUsed) { s.hourglassUsed = true; p.hp = 1; this.emit({ t: 'relic', id: 'emergency_hourglass', text: '免疫致命伤害' }); return; }
      s.result = 'lose'; s.phase = 'over';
      if (this.cls.id === 'mage' && p.backlash > 0) this.stats.backlashDeath = true;
      this.emit({ t: 'defeat' });
    }
  }

  // ───────────────────────────────────────── deaths, waves, rewards
  private markDead(e: Enemy, direct: boolean, ctx: PlayCtx | null) {
    if (e.dead) return;
    const s = this.s;
    e.dead = true; e.hp = 0;
    this.emit({ t: 'death', uid: e.uid, direct, overkill: e.overkill || 0 });
    this.quote(e, 'death', e.rank === 'midBoss' || e.rank === 'boss' ? 1 : 0.5);
    const ov = e.overkill || 0;
    if (this.rewards) { this.rewards.push(() => this.killReward(e, direct, ctx, ov)); return; }
    this.killReward(e, direct, ctx, ov);
  }
  private killReward(e: Enemy, direct: boolean, ctx: PlayCtx | null, overkill: number) {
    const s = this.s;
    const dr = DROPS[e.rank];
    // v2.1 3.2: overflow gold (enemy bonus + 收割 + relics) is summed, then cut to the per-fight cap; summons capped at 5 gold / 5 xp
    let over = Math.min(dr.maxBonus, Math.floor((direct ? overkill : 0) / OVERKILL_PER_GOLD));
    if (direct && ctx?.row?.flags?.overkillGold) over += Math.floor(overkill * ctx.row.flags.overkillGold);
    const ocap = ECON.overflowGoldCap[this.setup.kind] ?? 6;
    const overG = Math.max(0, Math.min(over, ocap - s.income.overflow));
    if (overG < over) this.stats.capHits.overflow = true;
    s.income.overflow += overG;
    let base = dr.gold, xp = dr.xp;
    if (e.rank === 'summon') {
      const g = Math.max(0, Math.min(base, ECON.summonCap.gold - s.income.summonGold));
      const x = Math.max(0, Math.min(xp, ECON.summonCap.xp - s.income.summonXp));
      if (g < base || x < xp) this.stats.capHits.summon = true;
      s.income.summonGold += g; s.income.summonXp += x; base = g; xp = x;
    } else s.income.kill += base;
    const gold = base + overG;
    s.goldEarned += gold; s.xpEarned += xp;
    this.emit({ t: 'gold', amount: gold, from: e.uid, overflow: overG });
    this.emit({ t: 'xp', amount: xp, from: e.uid });
    if (this.hasRelic('field_aid') && s.fieldAidUsed < (relicV2('field_aid').perBattleCap ?? 3) && !s.result) {
      s.fieldAidUsed++; this.changeHp(ECON.fieldAidHeal, 'heal'); this.emit({ t: 'relic', id: 'field_aid', text: '+' + ECON.fieldAidHeal });
    }
    if (direct && ctx) {
      // 斩首
      if (this.cls.id === 'warrior' && s.earned.behead < s.caps.behead) { s.earned.behead++; this.gain(1, 'behead', e.uid); }
      const fl = ctx.row?.flags;
      if (fl?.executeHeal && ctx.row?.flags?.execute) this.changeHp(fl.executeHeal, 'heal');
      if (fl?.chainKill && !s.chainUsed && ctx.count >= fl.chainKill) { s.chainUsed = true; this.addStrike(1, '连斩'); }
      if (this.cls.id === 'rogue' && this.talent('t_whet') && s.whetUsed < this.talent('t_whet')) { s.whetUsed++; this.spawnShadow(1, 'whet'); }
      if (this.hasRelic('loot_die')) { s.freeRerollsLeft++; this.emit({ t: 'freeReroll', n: 1, reason: 'loot_die' }); }
    }
    if (ENEMY_TRAITS.vengeance && direct) for (const o of this.alive()) if (o.arch === 'berserker') o.vengeance++;
  }

  private waveCleared() { return !this.alive().length; }

  private resolveDeaths(direct: boolean) {
    void direct;
    if (!this.waveCleared() || this.s.result) return;
    // the player's turn ends with the wave
    this.finishPlayerTurn();
    this.afterWaveClear();
  }
  private afterWaveClear() {
    const s = this.s;
    if (s.waveIdx + 1 < s.waves.length) {
      s.phase = 'enemy';
      // 1.9: dice earned this turn carry into the next wave's first turn; tell the UI before the next wave enters
      const nd = this.nextDice();
      this.emit({ t: 'waveClear', wave: s.waveIdx, nextDice: nd.count, reasons: nd.reasons });
      this.spawnWave(s.waveIdx + 1);
      s.turn++;
      this.turnStart();
      return;
    }
    s.result = 'win'; s.phase = 'over';
    this.emit({ t: 'victory', gold: s.goldEarned, xp: s.xpEarned });
  }

  private spawnWave(idx: number) {
    const s = this.s; s.waveIdx = idx; s.targetUid = null;
    const kind = this.setup.kind, sc = this.fightScale();
    s.enemies = s.waves[idx].map((id, i) => {
      const rank: EnemyRank = kind === 'normal' ? 'normal' : kind === 'elite' ? (i === 0 ? 'elite' : 'eliteMinion') : kind === 'midBoss' ? (i === 0 ? 'midBoss' : 'summon') : (i === 0 ? 'boss' : 'summon');
      return this.buildEnemy(id, rank, sc);
    });
    this.emit({ t: 'battleStart', enemies: s.enemies.map(e => e.uid), isBoss: kind === 'midBoss' || kind === 'boss', wave: idx });
    for (const e of s.enemies) this.emit({ t: 'enemyEnter', uid: e.uid });
    const q = kind === 'midBoss' || kind === 'boss' ? s.enemies[0] : this.rng.pick(s.enemies);
    if (q) this.quote(q, 'enter', 1);
  }
  private buildEnemy(id: string, rank: EnemyRank, sc: { hp: number; dmg: number }): Enemy {
    const cfg = enemyCfgV2(id); const s = this.s;
    const hp = Math.floor(cfg.hp * sc.hp);
    return {
      uid: s.enemyUid++, cfgId: cfg.id, name: cfg.name, hp, maxHp: hp, armor: 0, attackDmg: Math.floor(cfg.dmg * sc.dmg),
      ct: cfg.ct, arch: cfg.arch, cat: cfg.cat, rank, statuses: [], distance: cfg.ct === 'warrior' || cfg.ct === 'guardian' ? MELEE_START_DISTANCE : 0,
      ctlImmune: 0, interrupted: false, skipped: false, taunted: false,
      summoned: 0, isSummoned: false, justSummoned: false, dead: false, phaseIdx: 0, vengeance: 0, quotedLow: false, overkill: 0, killedDirect: false, age: 0,
    };
  }

  private afterEnemyHit(e: Enemy) {
    if (e.dead) return;
    const ph = this.enemyAction(e).phaseIdx;
    if (ph !== e.phaseIdx) { e.phaseIdx = ph; this.emit({ t: 'phase', uid: e.uid, phaseIdx: ph }); this.quote(e, 'lowHp', 1); }
    else if (!e.quotedLow && e.hp / e.maxHp < 0.3) { e.quotedLow = true; this.quote(e, 'lowHp', 1); }
  }

  // ───────────────────────────────────────── status helpers
  private hasStatus(who: Enemy | 'player', t: StatusV2) { const l = who === 'player' ? this.s.player.statuses : who.statuses; return l.some(x => x.type === t && x.value > 0); }
  private stv(e: Enemy, t: StatusV2) { return e.statuses.find(x => x.type === t)?.value || 0; }
  private upsert(list: Status[], st: Status) {
    const ex = list.find(x => x.type === st.type);
    if (ex) { ex.value += st.value; if (st.duration != null) ex.duration = Math.max(ex.duration || 0, st.duration); if (st.heldNew) ex.heldNew = (ex.heldNew || 0) + st.heldNew; }
    else list.push({ ...st });
  }
  private addEnemyStatus(e: Enemy, type: StatusV2, value: number, duration?: number, held = false) {
    if (e.dead || value <= 0) return;
    const st: Status = duration != null ? { type, value: type === 'poison' || type === 'burn' ? value : 1, duration } : { type, value };
    if (type === 'vulnerable' || type === 'weak') { st.value = 1; st.duration = duration ?? value; }
    if (type === 'burn' && held) st.heldNew = value;
    this.upsert(e.statuses, st);
    this.emit({ t: 'statusAdd', who: e.uid, status: { ...st } });
  }
  private addPlayerStatus(type: StatusV2, value: number, duration?: number) {
    if (type === 'freeze' || type === 'stun') return;
    const st: Status = type === 'poison' || type === 'burn' ? { type, value } : { type, value: 1, duration: duration ?? value };
    this.upsert(this.s.player.statuses, st);
    this.emit({ t: 'statusAdd', who: 'player', status: { ...st } });
  }
  private stunEnemy(e: Enemy, look: 'freeze' | 'stun', turns: number, ultimate: boolean, elseWeak?: number) {
    if (e.dead) return;
    if (e.ctlImmune > 0 || this.hasStatus(e, 'stun') || this.hasStatus(e, 'freeze')) { if (elseWeak) this.addEnemyStatus(e, 'weak', 1, elseWeak); return; }
    const boss = e.rank === 'midBoss' || e.rank === 'boss';
    if (boss && !ultimate) { e.interrupted = true; this.emit({ t: 'statusAdd', who: e.uid, status: { type: look, value: 0, duration: 0 } }); return; }
    const st: Status = { type: look, value: 1, duration: turns };
    this.upsert(e.statuses, st); this.emit({ t: 'statusAdd', who: e.uid, status: { ...st } });
  }
  private purifyPlayer(n: number, healPer?: number) {
    const p = this.s.player, removed: StatusV2[] = [];
    for (let i = 0; i < n; i++) { const idx = p.statuses.findIndex(x => NEG.includes(x.type)); if (idx < 0) break; removed.push(p.statuses[idx].type); p.statuses.splice(idx, 1); }
    if (removed.length) { this.emit({ t: 'purify', removed }); if (healPer) this.changeHp(healPer * removed.length, 'heal'); }
  }
  private addArmor(v: number, reason: string) { if (v <= 0) return; const p = this.s.player; p.armor += v; this.emit({ t: 'armor', who: 'player', delta: v, total: p.armor, reason }); }
  /** overArmor (血行 4+): heal beyond max HP becomes armor 1:1; 生命熔炉 flag overhealArmor: any overheal → armor ×N */
  private healPlayer(v: number, flags: Record<string, number>, overArmor?: number) {
    if (v <= 0) return;
    const p = this.s.player; const room = p.maxHp - p.hp;
    this.changeHp(v, 'heal');
    const per = Math.max(flags.overhealArmor || 0, overArmor || 0);
    if (per && v > room) this.addArmor((v - room) * per, flags.overhealArmor ? '生命熔炉' : '满血转护甲');
    if (flags.healRage) this.s.rageNext = Math.min(3, this.s.rageNext + Math.floor(v / flags.healRage));
  }
  private changeHp(delta: number, reason: 'heal' | 'self') {
    const p = this.s.player, before = p.hp;
    if (delta > 0) p.hp = Math.min(p.maxHp, p.hp + delta); else p.hp = Math.max(1, p.hp + delta);
    if (p.hp !== before) this.emit({ t: 'hp', who: 'player', delta: p.hp - before, hp: p.hp, reason });
  }

  // ───────────────────────────────────────── dice helpers
  /** face as rules see it (cursed = 0, cracked = no suit) */
  faceOf(d: Die): Face { return d.face; }
  private points(d: Die, def: RowDef | null): number {
    if (d.kind === 'cursed') return 0;
    let v = d.face.value;
    const p = this.s.player;
    if (def?.flags?.unbowed && p.hp < p.maxHp * def.flags.unbowed) v = 6;
    const bb = this.talent('t_bloodbath'); if (bb && p.rage) v += Math.min(p.rage, bb >= 2 ? 5 : 3);
    return v;
  }
  private facesFor(kind: DieKind): number[] { return kindValues(kind); }
  private suitFor(kind: DieKind, v: number): Suit { return kindSuit(this.cls.id, kind, v); }
  private setFace(d: Die, v: number) { d.face = { value: v, suit: this.suitFor(d.kind, v) }; }
  private rollDie(d: Die) {
    const f = this.facesFor(d.kind); let v = f[this.rng.int(0, f.length - 1)];
    if (d.kind === 'shadowDie' && this.talent('t_phantom') && v <= 2) v = this.talent('t_phantom') >= 2 ? 4 : 3;
    this.setFace(d, v);
  }
  private newDie(kind: DieKind, source: Die['source']): Die {
    const d: Die = { uid: this.s.dieUid++, kind, face: { value: 1, suit: 'none' }, persist: kind === 'shadowDie' || kind === 'furyDie' ? 'untilUsed' : 'turn', source, carried: 0 };
    this.rollDie(d); return d;
  }
  private spawnShadow(n: number, why: string) {
    const s = this.s;
    for (let i = 0; i < n; i++) {
      if (s.dice.length >= 6) break;
      const d = this.newDie('shadowDie', 'mechanic'); s.dice.push(d);
      this.emit({ t: 'special', action: 'spawn', uid: d.uid, kind: d.kind, value: d.face.value, suit: d.face.suit });
      this.emit({ t: 'roll', dice: [this.snap(d)], reason: 'spawn', kept: [] });
    }
    void why;
  }
  private carryNew(kind: DieKind) {
    const d = this.newDie(kind, 'mechanic'); this.s.carry.push(d);
    this.emit({ t: 'special', action: 'carry', uid: d.uid, kind: d.kind, value: d.face.value, suit: d.face.suit });
  }
  private addStrike(n: number, reason: string) {
    const s = this.s; const before = s.maxStrikes;
    s.maxStrikes = Math.min(this.cls.id === 'rogue' ? this.cls.maxStrikes : s.maxStrikes + n, s.maxStrikes + n);
    if (s.maxStrikes > before) this.emit({ t: 'strikeGain', n: s.maxStrikes - before, reason });
  }
  private gain(n: number, reason: GainReason, from?: number) {
    this.s.nextReasons.push(reason);
    if (n > 0) this.emit({ t: 'gainDice', n, reason, from });
  }
  private targets(t: Target, main: Enemy | null): Enemy[] {
    const a = this.alive(); const m = main && !main.dead ? main : a[0]; if (!m) return [];
    switch (t) {
      case 'one': return [m];
      case 'all': return a;
      case 'others': return a.filter(e => e !== m);
      case 'adjacent': { const i = a.indexOf(m); const n = a[i + 1] || a[i - 1]; return n ? [n] : []; }
      case 'second': { const o = a.find(e => e !== m); return [o || m]; }
    }
  }
  private isMelee(e: Enemy) { return e.ct === 'warrior' || e.ct === 'guardian'; }
  private pick(uids: number[]) { return uids.map(u => this.s.dice.find(d => d.uid === u)).filter((d): d is Die => !!d); }
  private snap(d: Die): DieSnap2 { return { uid: d.uid, kind: d.kind, value: d.face.value, suit: d.face.suit }; }
  private quote(e: Enemy, kind: string, chance: number) {
    const list = enemyCfgV2(e.cfgId).q?.[kind]; if (!list || !list.length) return;
    if (chance < 1 && this.rng.next() >= chance) return;
    this.emit({ t: 'quote', uid: e.uid, kind, index: this.rng.int(0, list.length - 1) });
  }
  private emit(e: Ev2) { this.ev.push(e); }
  private flush() { const e = this.ev; this.ev = []; return e; }
  private fail(reason: string): Result2 { this.ev = []; return { ok: false, reason, events: [] }; }
}

/** Values a die kind can roll, and the suit of a value (shared with the bot's sampler). */
export function kindValues(kind: DieKind): number[] {
  switch (kind) {
    case 'starDie': return STAR_DIE_VALUES;
    case 'titanDie': return [6, 6, 6, 6, 6, 6];
    case 'cracked': return CRACKED_VALUES;
    case 'cursed': return [0];
    default: return [1, 2, 3, 4, 5, 6];
  }
}
export function kindSuit(classId: ClassId, kind: DieKind, v: number): Suit {
  switch (kind) {
    case 'furyDie': return FURY_DIE_SUITS[v] || 'fury';
    case 'titanDie': return 'fury';
    case 'shadowDie': return 'shadow';
    case 'cracked': case 'cursed': return 'none';
    default: return CLASSES[classId].suitOf(v);
  }
}

function suitOfCond(def: RowDef): Suit | null { return def.cond.t === 'suit' ? def.cond.suit : null; }

export function buildBoard(l: Loadout): BoardRow[] {
  const out: BoardRow[] = [];
  l.tablets.forEach((t, ti) => t.slots.forEach((sl, si) => { const def = slotRow(sl); out.push({ ref: out.length, tablet: ti, slot: si, rowId: sl.rowId, name: def.name, level: sl.level, def }); }));
  return out;
}
