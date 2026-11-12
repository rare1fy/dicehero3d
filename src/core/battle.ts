// The battle state machine (rules only). Port of the 3D prototype's rules (03_rules.js + the rule parts of 04_battle.js), corrected
// against the 2D original where they differ (see docs/规则对照_阶段1.md; places still waiting on that check are marked SPEC).
// Usage: const b = new Battle(setup); b.start(); then b.reroll(uids) / b.play(uids, target) / b.endTurn(), each returning the events
// the presentation stages. Deterministic for a given seed. No three.js, no DOM, no timers.
import { createRng, type Rng } from './rng';
import * as P from './piles';
import { checkHands, handDisp, handMultiplier, handTier, STRAIGHTS, TRIPLE_OR_BETTER, type HandName } from './hands';
import { DATA, dieDef, enemyCfg } from './data';
import { RELIC_FX, RELIC_POOL, relicTarget, relicText, type RelicCtx, type RelicRes } from './relics';
import type { BattleEvent, Who } from './events';
import type { Die, Enemy, EnemyCfg, Outcome, OutcomeStep, QuoteKind, Status, StatusType } from './types';

// ---------------------------------------------------------------- tables
/** [hpScale, dmgScale] per map depth 0..14 (config/balance). */
export const DEPTH_SCALING: Array<[number, number]> = [[0.9, 0.4], [1.1, 0.5], [1.25, 0.6], [1.5, 0.75], [1.2, 0.65], [1.4, 0.8], [1.2, 0.7], [1.8, 1.0], [1.1, 0.6], [1.4, 0.8], [1.6, 0.9], [1.8, 1.0], [2.0, 1.1], [1.3, 0.8], [2.5, 1.3]];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const depthScale = (d: number) => DEPTH_SCALING[clamp(d, 0, 14)];
/** Die bonus growth with depth (bonusDamage × dmg, bonusMult + mult). */
export const depthBonus = (d: number) => ({ dmg: 1 + Math.floor(Math.max(0, d) / 3) * 0.15, mult: Math.floor(Math.max(0, d) / 5) * 0.05 });
export const STATUS_CN: Record<StatusType, string> = { poison: '中毒', burn: '灼烧', vulnerable: '易伤', weak: '虚弱', strength: '力量', freeze: '冻结', slow: '减速' };
const DOT_DESC: Record<string, StatusType> = { '剧毒': 'poison', '毒雾': 'poison', '毒素': 'poison', '灼烧': 'burn', '火焰': 'burn' };
const CTL_DESC: Record<string, StatusType> = { '虚弱': 'weak', '易伤': 'vulnerable', '冻结': 'freeze' };
export const isNeg = (s: Status) => ['poison', 'burn', 'vulnerable', 'weak'].includes(s.type);
export const stv = (list: Status[], t: StatusType) => list.find(s => s.type === t)?.value || 0;
export function upsertStatus(list: Status[], s: Status) {
  const ex = list.find(x => x.type === s.type);
  if (ex) { ex.value += s.value; if (s.duration != null) ex.duration = Math.max(ex.duration || 0, s.duration); } else list.push({ ...s });
  return list;
}
export function tickStatuses(list: Status[]) {
  return list.map(s => (s.duration !== undefined && s.duration > 0 ? { ...s, duration: s.duration - 1 } : s)).filter(s => s.duration === undefined || s.duration > 0);
}

// ---------------------------------------------------------------- setup / state
export interface BattleSetup {
  seed: number;
  cls?: string;
  /** Owned dice ids (default: the class's initial dice). */
  owned?: string[];
  relics?: string[];
  /** Enemy config ids per wave. */
  waves: string[][];
  depth: number;
  isBoss?: boolean;
  hp?: number;
  gold?: number;
  /** Debug: player cannot drop below 1 HP. */
  god?: boolean;
}

export interface PlayerState {
  cls: string; hp: number; maxHp: number; gold: number; statuses: Status[]; relics: string[];
  drawCount: number; maxPlays: number; freeRerolls: number; canBloodReroll: boolean; furyHits: number; depth: number;
}
export interface BattleState {
  turn: number; phase: 'idle' | 'player' | 'enemy' | 'over'; result: null | 'win' | 'lose';
  playsLeft: number; rerollCount: number; bloodRerollCount: number; hpLostThisTurn: number; armor: number;
  reapKill: number; reapBlock: number; rageMult: number; rageFireBonus: number; played: boolean; comboCount: number; lastHand: string | null;
  extraPlaysNext: number; tauntUsed: boolean;
  enemies: Enemy[]; waves: string[][]; waveIdx: number; targetUid: number | null; goldEarned: number; isBoss: boolean;
  piles: P.Piles<Die>;
}
export type Result = { ok: true; events: BattleEvent[] } | { ok: false; reason: string; events: BattleEvent[] };

export interface Intent { kind: 'atk' | 'def' | 'skl' | 'mov' | 'frz'; text: string; value?: number; status?: StatusType; desc?: string }

export class Battle {
  readonly rng: Rng;
  readonly player: PlayerState;
  readonly s: BattleState;
  private ev: BattleEvent[] = [];
  private dieUid = 1;
  private enemyUid = 1;
  private god: boolean;

  constructor(setup: BattleSetup) {
    const cd = DATA.classes[setup.cls || 'warrior'];
    if (!cd) throw new Error('unknown class ' + setup.cls);
    this.rng = createRng(setup.seed);
    this.god = !!setup.god;
    const owned = (setup.owned || cd.initialDice).slice();
    this.player = {
      cls: cd.id, hp: setup.hp ?? cd.hp, maxHp: cd.maxHp, gold: setup.gold || 0, statuses: [], relics: (setup.relics || []).slice(),
      drawCount: cd.drawCount, maxPlays: cd.maxPlays, freeRerolls: cd.freeRerolls, canBloodReroll: cd.canBloodReroll, furyHits: 0, depth: setup.depth,
    };
    this.s = {
      turn: 1, phase: 'idle', result: null, playsLeft: 0, rerollCount: 0, bloodRerollCount: 0, hpLostThisTurn: 0, armor: 0,
      reapKill: 0, reapBlock: 0, rageMult: 0, rageFireBonus: 0, played: false, comboCount: 0, lastHand: null, extraPlaysNext: 0, tauntUsed: false,
      enemies: [], waves: setup.waves.map(w => w.slice()), waveIdx: 0, targetUid: null, goldEarned: 0, isBoss: !!setup.isBoss,
      piles: { owned, bag: this.rng.shuffle(owned), discard: [], hand: [] },
    };
  }

  // ------------------------------------------------------------ queries
  get hand() { return this.s.piles.hand.filter(d => !d.spent); }
  alive() { return this.s.enemies.filter(e => !e.dead && e.hp > 0); }
  enemy(uid: number) { return this.s.enemies.find(e => e.uid === uid) || null; }
  die(uid: number) { return this.s.piles.hand.find(d => d.uid === uid) || null; }
  hasRelic(id: string) { return this.player.relics.includes(id); }
  target(): Enemy | null {
    const t = this.s.targetUid != null ? this.enemy(this.s.targetUid) : null;
    if (t && !t.dead) return t;
    const a = this.alive(); const n = a.find(e => e.ct === 'guardian') || a[0] || null;
    this.s.targetUid = n ? n.uid : null; return n;
  }
  /** HP cost of the next reroll: 0 = free, -1 = not allowed (rogue / mage), else HP (logic/rerollCalc.ts). */
  rerollHpCost(): number {
    const free = this.player.freeRerolls || 1, n = this.s.rerollCount;
    if (n < free) return 0;
    if (!this.player.canBloodReroll) return -1;
    return Math.ceil(this.player.maxHp * Math.pow(2, n - free + 1) / 100);
  }
  /** Can the selected dice be played (non-warriors may not multi-select a high card). */
  canPlay(uids: number[]): boolean {
    if (this.s.phase !== 'player' || this.s.playsLeft <= 0 || !uids.length || !this.alive().length) return false;
    const sel = this.pick(uids); if (sel.length !== uids.length) return false;
    if (sel.length > 1 && this.player.cls !== 'warrior') { const h = checkHands(this.handDice(sel)); if (h.activeHands.length === 1 && h.activeHands[0] === '普通攻击') return false; }
    return true;
  }
  mustEndTurn() { return this.s.phase === 'player' && (this.s.playsLeft <= 0 || this.hand.length === 0); }
  preview(uids: number[], targetUid?: number): Outcome | null {
    const sel = this.pick(uids); if (!sel.length) return null;
    const t = targetUid != null ? this.enemy(targetUid) : this.target();
    return this.calcOutcome(sel, t);
  }

  // ------------------------------------------------------------ flow
  start(): BattleEvent[] {
    this.ev = [];
    this.spawnWave(0);
    this.turnStart();
    return this.flush();
  }

  reroll(uids: number[]): Result {
    this.ev = [];
    const s = this.s, p = this.player;
    if (s.phase !== 'player') return this.fail('不是你的回合');
    const sel = this.pick(uids); if (!sel.length) return this.fail('先选要重投的骰子');
    let cost = this.rerollHpCost();
    if (cost < 0) return this.fail('免费重投已用完');
    if (cost > 0 && sel.some(d => d.def.isCursed)) cost *= 2;   // SPEC: cursed doubling condition
    if (cost >= p.hp) return this.fail('生命不足以支付重投代价');
    let bloodCapped = false;
    if (cost > 0) {
      p.hp -= cost; s.hpLostThisTurn += cost;
      this.emit({ t: 'hp', who: 'player', delta: -cost, hp: p.hp, reason: 'reroll' });
      bloodCapped = s.bloodRerollCount >= 5;
      s.bloodRerollCount = Math.min(5, s.bloodRerollCount + 1);
      if (bloodCapped) { s.armor += 5; this.emit({ t: 'armor', who: 'player', delta: 5, total: s.armor, reason: '血怒已满' }); }
    }
    s.rerollCount++;
    this.emit({ t: 'reroll', uids: sel.map(d => d.uid), hpCost: cost, blood: s.bloodRerollCount, bloodCapped });
    // temporary dice re-roll in place; normal dice go to the discard and as many are drawn (the replacement tumbles from the old spot)
    const temps = sel.filter(d => P.isTemp(d)), normals = sel.filter(d => !P.isTemp(d));
    for (const d of temps) d.value = this.roll(d);
    P.returnToDiscard(s.piles, normals);
    const { ids, reshuffled } = P.draw(s.piles, normals.length, a => this.rng.shuffle(a));
    const fresh = ids.map(id => this.newDie(id));
    s.piles.hand.push(...fresh);
    this.emit({ t: 'draw', dice: fresh.concat(temps).map(d => ({ uid: d.uid, defId: d.defId, value: d.value })), reshuffled, reason: 'reroll' });
    this.check('reroll');
    return { ok: true, events: this.flush() };
  }

  play(uids: number[], targetUid?: number): Result {
    this.ev = [];
    const s = this.s, p = this.player;
    if (!this.canPlay(uids)) return this.fail(this.player.cls !== 'warrior' && uids.length > 1 ? '不成牌型时只能出 1 颗骰子' : '现在不能出牌');
    const sel = this.pick(uids);
    if (targetUid != null) { const t = this.enemy(targetUid); if (t && !t.dead) s.targetUid = t.uid; }
    const target = this.target();
    const out = this.calcOutcome(sel, target);
    s.playsLeft -= 1; s.played = true; s.comboCount += 1;
    this.emit({ t: 'play', uids: sel.map(d => d.uid), target: target ? target.uid : null, outcome: out });
    // hits
    const targets = out.aoe ? this.alive() : target ? [target] : [];
    for (const e of targets) {
      const r = this.hitEnemy(e, out.damage, out.armorBreak);
      this.emit({ t: 'hit', uid: e.uid, dmg: out.damage, absorbed: r.absorbed, hpDmg: r.hpDmg, armorBroke: r.armorBroke, killed: r.killed, aoe: out.aoe, source: 'play' });
      for (const st of out.statuses) { upsertStatus(e.statuses, st); this.emit({ t: 'statusAdd', who: e.uid, status: { ...st } }); }
      this.afterEnemyHit(e, r.hpDmg);
    }
    const ops = out.skipOnPlay ? [] : sel.map(d => d.def.onPlay || {});
    if (!out.aoe && target && ops.some(o => o.splinterDamage) && (target.overkill || 0) > 0) {
      const others = this.alive().filter(x => x !== target);
      if (others.length) { const o2 = this.rng.pick(others); const r = this.hitEnemy(o2, target.overkill || 0, false); this.emit({ t: 'hit', uid: o2.uid, dmg: target.overkill || 0, absorbed: r.absorbed, hpDmg: r.hpDmg, armorBroke: false, killed: r.killed, aoe: false, source: 'splinter' }); this.afterEnemyHit(o2, r.hpDmg); }
    }
    // effects on the player
    if (out.armor > 0) { s.armor += out.armor; this.emit({ t: 'armor', who: 'player', delta: out.armor, total: s.armor, reason: '出牌' }); }
    if (out.heal !== 0) this.changeHp(out.heal, out.heal > 0 ? 'heal' : 'self');
    if (out.purify > 0) this.purifyPlayer(out.purify);
    if (out.gold > 0) { p.gold += out.gold; }
    for (const [k, v] of out.post) {
      if (k === 'freeReroll') s.rerollCount -= v || 1;
      if (k === 'consumeRage') s.rageFireBonus = 0;
      if (k === 'maxHp') { p.maxHp += v || 0; p.hp += v || 0; this.emit({ t: 'hp', who: 'player', delta: v || 0, hp: p.hp, reason: 'maxHp' }); }
    }
    // dice bookkeeping
    for (const d of sel) { P.spend(s.piles, d); if (d.def.onPlay?.tauntAll && !out.skipOnPlay) s.tauntUsed = true; }
    this.emit({ t: 'spent', uids: sel.map(d => d.uid) });
    if (ops.some(o => (o as { grantExtraPlay?: number }).grantExtraPlay)) s.playsLeft++;
    s.lastHand = out.hands.bestHand;
    P.compact(s.piles);
    this.check('play');
    this.resolveDeaths(true);
    return { ok: true, events: this.flush() };
  }

  endTurn(): Result {
    this.ev = [];
    const s = this.s;
    if (s.phase !== 'player') return this.fail('不是你的回合');
    s.phase = 'enemy';
    this.enemyTurn();
    return { ok: true, events: this.flush() };
  }

  // ------------------------------------------------------------ internals: flow
  private spawnWave(idx: number) {
    const s = this.s; s.waveIdx = idx; s.targetUid = null;
    const [hm, dm] = depthScale(this.player.depth);
    s.enemies = s.waves[idx].map(id => this.buildEnemy(enemyCfg(id), hm, dm));
    this.emit({ t: 'battleStart', enemies: s.enemies.map(e => e.uid), isBoss: s.isBoss });
    for (const e of s.enemies) this.emit({ t: 'enemyEnter', uid: e.uid });
    const q = s.isBoss ? s.enemies[0] : this.rng.pick(s.enemies);
    this.quote(q, 'enter', 1);
  }

  private turnStart() {
    const s = this.s, p = this.player;
    if (s.result) return;
    s.phase = 'player';
    s.armor = 0; s.playsLeft = p.maxPlays + (this.hasRelic('double_strike') ? 1 : 0) + s.extraPlaysNext; s.extraPlaysNext = 0;
    s.rerollCount = 0; s.hpLostThisTurn = 0; s.played = false; s.tauntUsed = false;
    // draw phase: the warrior keeps nothing; temporary dice vanish, cracked dice break, the rest go to the discard
    const hand = s.piles.hand.filter(d => !d.spent);
    const gone = P.discardDice(s.piles, hand);
    if (hand.length) this.emit({ t: 'discard', uids: hand.map(d => d.uid), destroyed: gone.map(d => d.uid) });
    const reap = p.cls === 'warrior' ? s.reapKill + s.reapBlock : 0;
    s.reapKill = 0; s.reapBlock = 0;
    const raw = p.drawCount + reap, target = Math.min(6, raw);
    s.rageMult = p.cls === 'warrior' && raw > 6 ? (raw - 6) * 0.1 : 0;   // 过充溢出: +10% per die beyond 6
    this.emit({ t: 'turnStart', turn: s.turn, playsLeft: s.playsLeft, drawBonus: reap, overflowMult: s.rageMult });
    const { ids, reshuffled } = P.draw(s.piles, target, a => this.rng.shuffle(a));
    const fresh = ids.map(id => this.newDie(id));
    s.piles.hand.push(...fresh);
    this.emit({ t: 'draw', dice: fresh.map(d => ({ uid: d.uid, defId: d.defId, value: d.value })), reshuffled, reason: 'turn' });
    this.check('turn');
  }

  private enemyTurn() {
    const s = this.s, p = this.player;
    this.emit({ t: 'enemyTurn', turn: s.turn });
    s.bloodRerollCount = 0; s.comboCount = 0; s.lastHand = null;
    // player poison ticks at the start of the enemy turn
    const pp = p.statuses.find(x => x.type === 'poison');
    if (pp && pp.value > 0) { const dmg = pp.value; pp.value -= 1; if (pp.value <= 0) p.statuses.splice(p.statuses.indexOf(pp), 1); this.emit({ t: 'statusTick', who: 'player', type: 'poison', dmg }); this.playerTakeHit(dmg, null, true); if (s.result) return; }
    // enemies: armor resets, burn then poison ticks
    let dot = false;
    for (const e of this.alive()) {
      e.armor = 0;   // SPEC: does enemy armor reset every turn?
      const b = e.statuses.find(x => x.type === 'burn');
      if (b && b.value > 0) { dot = true; e.statuses = e.statuses.filter(x => x !== b); e.hp = Math.max(0, e.hp - b.value); this.emit({ t: 'statusTick', who: e.uid, type: 'burn', dmg: b.value }); this.afterEnemyHit(e, b.value); }
    }
    if (dot && !this.resolveDeaths(false)) return;
    dot = false;
    for (const e of this.alive()) {
      const po = e.statuses.find(x => x.type === 'poison');
      if (po && po.value > 0) { dot = true; const pv = po.value; e.hp = Math.max(0, e.hp - pv); po.value -= 1; this.emit({ t: 'statusTick', who: e.uid, type: 'poison', dmg: pv }); this.afterEnemyHit(e, pv); }
      const hadFreeze = e.statuses.some(x => x.type === 'freeze');
      const before = e.statuses.map(x => x.type);
      e.statuses = tickStatuses(e.statuses.filter(x => x.type !== 'poison' || x.value > 0));
      for (const t of before) if (!e.statuses.some(x => x.type === t)) this.emit({ t: 'statusExpire', who: e.uid, type: t });
      if (hadFreeze && !e.statuses.some(x => x.type === 'freeze')) e.wasFrozen = true;
    }
    if (dot && !this.resolveDeaths(false)) return;
    // actions
    for (const e of this.alive().slice()) { if (s.result) return; if (e.dead) continue; this.enemyAct(e); if (s.result) return; }
    // elite / boss traits, summons (logic/elites.ts, logic/enemySummonRevive.ts)
    const t = s.turn;
    for (const e of this.alive().slice()) {
      this.eliteTraits(e, t);
      this.trySummon(e, t);
    }
    s.turn++;
    // player burn ticks at the end of the enemy turn, then durations count down
    const pb = p.statuses.find(x => x.type === 'burn');
    if (pb && pb.value > 0) { p.statuses = p.statuses.filter(x => x !== pb); this.emit({ t: 'statusTick', who: 'player', type: 'burn', dmg: pb.value }); this.playerTakeHit(pb.value, null, true); if (s.result) return; }
    const before = p.statuses.map(x => x.type);
    p.statuses = tickStatuses(p.statuses);
    for (const ty of before) if (!p.statuses.some(x => x.type === ty)) this.emit({ t: 'statusExpire', who: 'player', type: ty });
    this.turnStart();
  }

  private eliteTraits(e: Enemy, t: number) {
    // SPEC: v6 did both junk dice and stacked boss armor every 2 turns; the original adds ONE junk die per turn (cursed if < 40% HP on
    // its cycle, else cracked on its cycle). Cycles below are v6's until the spec confirms ELITE_CONFIG.
    if (e.cat === 'elite' && t % 3 === 0) { this.addJunk('cracked', e); return; }
    if (e.cat === 'boss') {
      if (e.hp / e.maxHp < 0.4 && t % 2 === 0) { this.addJunk('cursed', e); return; }
      if (t % 3 === 0) { this.addJunk('cracked', e); return; }
    }
  }

  private trySummon(e: Enemy, t: number) {
    const cfg = enemyCfg(e.cfgId), sm = cfg.summons;
    if (!sm || e.isSummoned) return;
    const interval = Math.max(1, sm.interval), offset = sm.offset || 0, count = sm.count || 1, maxTotal = sm.maxTotal ?? 3, waveCap = sm.waveCap ?? 4;
    if (t < 1 || (t - offset) % interval !== 0 || e.summoned >= maxTotal) return;
    const wave = this.alive().length; if (wave >= waveCap) return;
    if (sm.hpThreshold != null && e.hp / e.maxHp > sm.hpThreshold) return;
    const n = Math.min(count, maxTotal - e.summoned, waveCap - wave);
    for (let i = 0; i < n; i++) {
      const m = this.buildEnemy(enemyCfg(sm.minionId), 1, 1);   // original: summons are not depth-scaled
      m.isSummoned = true; m.distance = 1;   // SPEC: summon start distance
      this.s.enemies.push(m);
      this.emit({ t: 'summon', by: e.uid, uid: m.uid });
    }
    e.summoned += n;
  }

  private enemyAct(e: Enemy) {
    const s = this.s;
    const melee = e.ct === 'warrior' || e.ct === 'guardian';
    if (e.statuses.some(x => x.type === 'freeze' && (x.duration || 0) > 0)) { this.emit({ t: 'enemyAct', uid: e.uid, kind: 'frozen' }); return; }
    if (melee && e.distance > 0) { e.distance--; this.emit({ t: 'enemyMove', uid: e.uid, distance: e.distance }); return; }
    const a = this.enemyAction(e, s.turn); const pc = e.ct === 'priest' || e.ct === 'caster';
    let type = a.type; if (pc && type === '攻击') type = '技能';   // SPEC: the original caster attack behaviour
    if (type === '防御') {
      const v = Math.floor(a.value * (e.arch === 'bulwark' ? 2 : 1));
      e.armor += v; this.emit({ t: 'enemyAct', uid: e.uid, kind: 'defend', value: v }); this.emit({ t: 'armor', who: e.uid, delta: v, total: e.armor, reason: '防御' });
      return;
    }
    let rider: { st: StatusType; val: number } | null = null;
    if (type === '技能') {
      const dot = a.desc ? DOT_DESC[a.desc] : undefined, ctl = a.desc ? CTL_DESC[a.desc] : undefined;
      if (a.curseDice) { this.emit({ t: 'enemyAct', uid: e.uid, kind: 'curse', desc: a.desc }); for (let i = 0; i < (a.curseDiceCount || 1); i++) this.addJunk(a.curseDice, e); return; }
      if (!pc && (dot || ctl)) rider = { st: (dot || ctl)!, val: Math.max(1, Math.floor((a.value || 1) / 2)) };
      else if (dot || ctl) {
        this.emit({ t: 'enemyAct', uid: e.uid, kind: 'skill', desc: a.desc, value: a.value });
        if (dot) this.applyPlayerStatus(dot, a.value, dot === 'burn' ? 3 : undefined); else this.applyPlayerStatus(ctl!, 1, ctl === 'freeze' ? 1 : 2);
        return;
      } else if (pc) { this.casterSkill(e); return; }
    }
    const base = a.type === '攻击' ? a.value : e.attackDmg;
    if (e.ct === 'ranger') e.attackCount += 2;
    const dmg = this.attackValue(e, base, { player: true });
    this.emit({ t: 'enemyAct', uid: e.uid, kind: 'attack', desc: a.desc, value: dmg });
    this.playerTakeHit(dmg, e, false);
    if (s.result) return;
    if (rider) { if (rider.st === 'burn' || rider.st === 'poison') this.applyPlayerStatus(rider.st, rider.val, rider.st === 'burn' ? 3 : undefined); else this.applyPlayerStatus(rider.st, 1, rider.st === 'freeze' ? 1 : 2); }
    if (this.rng.next() < 0.3) this.quote(e, 'attack', 1);
  }

  private casterSkill(e: Enemy) {
    // SPEC: v6's caster skill (random poison / burn / weak). Waiting for the original's caster behaviour.
    const r = this.rng.next(), atk = e.attackDmg;
    this.emit({ t: 'enemyAct', uid: e.uid, kind: 'skill', desc: '施法' });
    if (r < 0.4) this.applyPlayerStatus('poison', Math.max(2, Math.floor(atk * 0.4)));
    else if (r < 0.7) this.applyPlayerStatus('burn', Math.max(1, Math.floor(atk * 0.3)), 3);
    else { this.applyPlayerStatus('poison', Math.max(1, Math.floor(atk * 0.25))); this.applyPlayerStatus('weak', 1, 2); }
  }

  enemyAction(e: Enemy, t: number) {
    const cfg = enemyCfg(e.cfgId), ph = cfg.phases;
    let chosen = ph[ph.length - 1], idx = ph.length - 1;
    for (let i = 0; i < ph.length; i++) { const p = ph[i]; if (p.hpThreshold == null) { chosen = p; idx = i; continue; } if (e.hp >= e.maxHp * p.hpThreshold) { chosen = p; idx = i; break; } }
    const acts = chosen.actions;
    if (!acts.length) return { type: '攻击' as const, value: e.attackDmg, phaseIdx: idx };
    const a = acts[(((t - 1) % acts.length) + acts.length) % acts.length];
    return { type: a.type, value: a.scalable === false ? a.baseValue : Math.floor(a.baseValue * e.dmgScale), desc: a.description, curseDice: a.curseDice, curseDiceCount: a.curseDiceCount, phaseIdx: idx };
  }

  /** What an enemy will do this turn (intent bubble). */
  intent(e: Enemy): Intent {
    const t = this.s.turn, melee = e.ct === 'warrior' || e.ct === 'guardian';
    if (e.statuses.some(x => x.type === 'freeze' && (x.duration || 0) > 0)) return { kind: 'frz', text: '冻结' };
    if (melee && e.distance > 0) return { kind: 'mov', text: '逼近 ' + e.distance };
    const a = this.enemyAction(e, t), pc = e.ct === 'priest' || e.ct === 'caster';
    if (a.type === '防御') { const v = Math.floor(a.value * (e.arch === 'bulwark' ? 2 : 1)); return { kind: 'def', text: String(v), value: v }; }
    if (a.type === '技能' || (pc && a.type === '攻击')) {
      const dot = a.desc ? DOT_DESC[a.desc] : undefined, ctl = a.desc ? CTL_DESC[a.desc] : undefined;
      if (!pc && (dot || ctl)) { const v = this.attackValue(e, e.attackDmg); return { kind: 'atk', text: v + '+' + STATUS_CN[(dot || ctl)!], value: v, status: dot || ctl }; }
      if (dot) return { kind: 'skl', text: STATUS_CN[dot] + ' ' + a.value, status: dot, value: a.value, desc: a.desc };
      if (ctl) return { kind: 'skl', text: STATUS_CN[ctl], status: ctl, desc: a.desc };
      if (a.curseDice) return { kind: 'skl', text: '诅咒骰', desc: a.desc };
      return { kind: 'skl', text: '施法', desc: a.desc };
    }
    const v = this.attackValue(e, a.value);
    return { kind: 'atk', text: String(v), value: v, desc: a.desc };
  }

  /** Enemy → player attack value (logic/attackCalc.ts). */
  attackValue(e: Enemy, base: number, o: { player?: boolean } = {}) {
    let v = base;
    if (e.ct === 'warrior') v = Math.floor(v * 1.3);   // SPEC
    const str = stv(e.statuses, 'strength'); if (str) v += str;
    if (e.statuses.some(x => x.type === 'weak')) v = Math.max(1, Math.floor(v * 0.75));
    if (o.player && this.player.statuses.some(x => x.type === 'vulnerable')) v = Math.floor(v * 2.0);
    return v;
  }

  private playerTakeHit(dmg: number, e: Enemy | null, isDot: boolean) {
    const s = this.s, p = this.player;
    let rem = Math.max(0, dmg), byArmor = 0;
    if (!isDot && s.armor > 0 && rem > 0) { byArmor = Math.min(s.armor, rem); s.armor -= byArmor; rem -= byArmor; }
    let hpDmg = 0;
    if (rem > 0) {
      const before = p.hp; p.hp = Math.max(this.god ? 1 : 0, p.hp - rem); hpDmg = before - p.hp; s.hpLostThisTurn += hpDmg;
    }
    const perfectBlock = !isDot && dmg > 0 && rem === 0;
    this.emit({ t: 'playerHit', from: e ? e.uid : null, dmg, byArmor, hpDmg, isDot, perfectBlock });
    if (rem > 0 && !isDot) {
      if (this.hasRelic('rage_fire_relic')) { s.rageFireBonus += 15; this.emit({ t: 'relic', id: 'rage_fire_relic', trigger: 'on_damage_taken', to: 'weapon', text: '下次出牌 +15 伤害' }); }   // SPEC: stacking
      p.furyHits = Math.min(10, p.furyHits + 1);
    }
    if (!isDot && p.cls === 'warrior' && dmg > 0 && byArmor === dmg && s.reapBlock < 1) { s.reapBlock = 1; this.emit({ t: 'reap', kind: 'block' }); }
    if (p.hp <= 0) {
      if (this.hasRelic('emergency_hourglass')) { p.hp = 1; this.emit({ t: 'relic', id: 'emergency_hourglass', trigger: 'on_fatal', to: 'hero', text: '免疫致命伤害' }); }
      else { s.result = 'lose'; s.phase = 'over'; this.emit({ t: 'defeat' }); }
    }
  }

  private applyPlayerStatus(type: StatusType, value: number, duration?: number) {
    if (type === 'freeze') return;   // the player cannot be frozen (v6: shown as 冻结（无效）)
    const st: Status = duration != null ? { type, value, duration } : { type, value };
    upsertStatus(this.player.statuses, st);
    this.emit({ t: 'statusAdd', who: 'player', status: st });
  }

  private addJunk(id: string, e: Enemy) { P.addJunk(this.s.piles, id); this.emit({ t: 'junk', id, from: e.uid }); this.check('junk'); }

  private changeHp(delta: number, reason: 'heal' | 'self') {
    const s = this.s, p = this.player, before = p.hp;
    if (delta > 0) p.hp = Math.min(p.maxHp, p.hp + delta);
    else { p.hp = Math.max(1, p.hp + delta); s.hpLostThisTurn += before - p.hp; }
    if (p.hp !== before) this.emit({ t: 'hp', who: 'player', delta: p.hp - before, hp: p.hp, reason });
  }

  /** Cleanse negative statuses first; with none left, remove one junk die (exactly one physical copy, via piles). */
  private purifyPlayer(n: number) {
    const p = this.player, removed: StatusType[] = [];
    for (let i = 0; i < n; i++) { const idx = p.statuses.findIndex(isNeg); if (idx < 0) break; removed.push(p.statuses[idx].type); p.statuses.splice(idx, 1); }
    if (removed.length) { this.emit({ t: 'purify', removed }); return; }
    if (n > 0 && n < 99) {
      const r = P.removeJunk(this.s.piles);
      if (r) { this.emit({ t: 'purify', removed: [], junk: { id: r.id, where: r.where, uid: r.die?.uid } }); this.check('purify'); }
    }
  }

  private hitEnemy(e: Enemy, dmg: number, armorBreak: boolean) {
    if (e.dead) return { absorbed: 0, hpDmg: 0, overkill: 0, armorBroke: false, killed: false };
    let absorbed = 0, hpDmg = dmg, armorBroke = false;
    if (armorBreak) { if (e.armor > 0) armorBroke = true; e.armor = 0; }
    else if (e.armor > 0) { absorbed = Math.min(e.armor, dmg); e.armor -= absorbed; hpDmg = dmg - absorbed; }
    const before = e.hp; e.hp = Math.max(0, e.hp - hpDmg); const overkill = Math.max(0, hpDmg - before);
    if (e.hp <= 0) { e.killedDirect = true; e.overkill = overkill; }
    return { absorbed, hpDmg, overkill, armorBroke, killed: e.hp <= 0 };
  }

  /** Phase change and low-HP / hurt quotes after an enemy loses HP. */
  private afterEnemyHit(e: Enemy, hpDmg: number) {
    if (e.hp <= 0) return;
    const ph = this.enemyAction(e, this.s.turn).phaseIdx;
    if (ph !== e.phaseIdx) { e.phaseIdx = ph; this.emit({ t: 'phase', uid: e.uid, phaseIdx: ph }); }
    if (!e.quotedLow && e.hp / e.maxHp < (e.cat === 'boss' ? 0.5 : 0.3)) { e.quotedLow = true; this.quote(e, 'lowHp', 1); return; }   // SPEC: thresholds
    if (hpDmg > 0 && e.cat === 'boss') this.quote(e, 'hurt', 0.35);
  }

  /** Deaths: on_kill relics, warrior reap, gold; wave transition or victory. Returns true if the battle goes on. */
  private resolveDeaths(direct: boolean): boolean {
    const s = this.s, p = this.player;
    for (const e of s.enemies) {
      if (e.dead || e.hp > 0) continue;
      e.dead = true; s.goldEarned += e.dropGold || 0;
      this.emit({ t: 'death', uid: e.uid, direct, overkill: e.overkill || 0, gold: e.dropGold || 0 });
      this.quote(e, 'death', e.cat === 'boss' ? 1 : 0.5);
      if (e.killedDirect && direct && p.cls === 'warrior' && s.reapKill < 1) { s.reapKill = 1; this.emit({ t: 'reap', kind: 'kill' }); }
      for (const id of p.relics) {
        const fx = RELIC_FX[id]?.on_kill; if (!fx) continue;
        const r = fx(this.relicCtx({ overkill: e.overkill || 0 }));
        this.emit({ t: 'relic', id, trigger: 'on_kill', to: relicTarget(r), text: relicText(r) });
        if (r.heal) this.changeHp(r.heal, 'heal');
        if (r.grantExtraPlay) s.playsLeft += r.grantExtraPlay;
      }
    }
    if (this.alive().length) return true;
    if (s.waveIdx + 1 < s.waves.length) {
      const hd = this.hand; const gone = P.discardDice(s.piles, hd);
      if (hd.length) this.emit({ t: 'discard', uids: hd.map(d => d.uid), destroyed: gone.map(d => d.uid) });
      s.bloodRerollCount = 0; s.comboCount = 0; s.lastHand = null; s.turn = 1;
      this.spawnWave(s.waveIdx + 1);
      this.turnStart();
      return false;
    }
    this.victory();
    return false;
  }

  private victory() {
    const s = this.s, p = this.player;
    s.result = 'win'; s.phase = 'over';
    let gold = s.goldEarned;
    for (const id of p.relics) { const fx = RELIC_FX[id]?.on_battle_end; if (!fx) continue; const r = fx(this.relicCtx({})); if (r.goldBonus) { gold += r.goldBonus; this.emit({ t: 'relic', id, trigger: 'on_battle_end', to: 'gold', text: relicText(r) }); } }
    const hd = this.hand; P.discardDice(s.piles, hd, { keepCracked: true }); P.victoryCleanup(s.piles);
    p.gold += gold; p.statuses = [];
    const choices = this.rng.shuffle(RELIC_POOL.filter(id => !this.hasRelic(id) && DATA.relics[id] && ['rare', 'legendary', 'uncommon'].includes(DATA.relics[id].rarity))).slice(0, 3);   // SPEC: boss reward pool
    this.emit({ t: 'victory', gold, relicChoices: choices });
  }

  // ------------------------------------------------------------ settlement (expectedOutcomeCalc + settlement phases 1–4)
  private relicCtx(o: Partial<RelicCtx>): RelicCtx {
    const s = this.s, p = this.player;
    return { handType: '', diceCount: 0, pointSum: 0, rerollsThisTurn: s.rerollCount, currentHp: p.hp, maxHp: p.maxHp, hpLostThisTurn: s.hpLostThisTurn, currentDepth: Math.max(0, p.depth), overkill: 0, currentGold: p.gold, ...o };
  }

  calcOutcome(sel: Die[], target: Enemy | null): Outcome {
    const s = this.s, p = this.player;
    const hands = checkHands(this.handDice(sel));
    const X = sel.reduce((a, d) => a + d.value, 0);
    const hm = handMultiplier(hands);
    const baseDamage = Math.ceil(X * hm);
    const out: Outcome = { X, hands, handMult: hm, baseDamage, multiplier: 1, extra: 0, armor: 0, heal: 0, pierce: 0, armorBreak: false, statuses: [], purify: 0, gold: 0, relics: [], tags: [], post: [], steps: [], skipOnPlay: false, aoe: false, tier: 0, total: 0, damage: 0 };
    const step = (st: OutcomeStep) => out.steps.push(st);
    step({ kind: 'base', label: '点数', txt: sel.map(d => d.value).join('+') + ' = ' + X, v: X });
    step({ kind: 'hand', label: handDisp(hands), txt: '×' + hm.toFixed(1) + ' → ' + baseDamage, v: baseDamage });
    if (hands.activeHands.includes('葫芦') || hands.activeHands.includes('大葫芦')) { out.armorBreak = true; out.tags.push('真伤'); }
    // on_play relics
    const rctx = this.relicCtx({ handType: hands.bestHand, diceCount: sel.length, pointSum: X });
    for (const id of p.relics) {
      const fx = RELIC_FX[id]?.on_play; if (!fx) continue;
      const res: RelicRes = fx(rctx) || {};
      let used = false;
      if (res.damage) { out.extra += res.damage; used = true; }
      if (res.armor) { out.armor += res.armor; used = true; }
      if (res.heal) { out.heal += res.heal; used = true; }
      if (res.multiplier && res.multiplier !== 1) { out.multiplier *= res.multiplier; used = true; }
      if (res.goldBonus) { out.gold += res.goldBonus; used = true; }
      if (res.purifyDebuff) { out.purify += res.purifyDebuff; used = true; }
      if (res.grantFreeReroll) { out.post.push(['freeReroll', res.grantFreeReroll]); used = true; }
      if (used) { out.relics.push(id); step({ kind: 'relic', label: DATA.relics[id].name, txt: relicText(res), id, dmg: res.damage || 0, mult: res.multiplier || 1, armor: res.armor || 0, heal: res.heal || 0, gold: res.goldBonus || 0, to: relicTarget(res) }); }
    }
    if (s.rageFireBonus > 0) { out.extra += s.rageFireBonus; out.relics.push('rage_fire_relic'); out.post.push(['consumeRage']); step({ kind: 'relic', label: DATA.relics.rage_fire_relic.name, txt: '+' + s.rageFireBonus + ' 伤害', id: 'rage_fire_relic', dmg: s.rageFireBonus, mult: 1, to: 'weapon' }); }
    // a multi-die high card disables die effects (warrior may multi-select; the effects stay off)
    const skip = sel.length > 1 && hands.activeHands.length === 1 && hands.activeHands[0] === '普通攻击';
    out.skipOnPlay = skip;
    if (skip) sel.forEach(d => { if (d.def.onPlay?.armorBreak) out.armorBreak = true; });   // SPEC
    const db = depthBonus(p.depth);
    const hasTriple = hands.activeHands.some(h => TRIPLE_OR_BETTER.includes(h as HandName));
    const procDie = (d: Die) => {
      const op = d.def.onPlay || {};
      if (op.selfDamage && p.hp + out.heal > op.selfDamage) out.heal -= op.selfDamage;
      if (op.bonusDamage && !op.requiresTriple) out.extra += Math.ceil(op.bonusDamage * db.dmg);
      if (op.bonusMult) out.multiplier *= 1 + (op.bonusMult - 1 + db.mult);
      if (op.heal) out.heal += op.heal;
      if (op.pierce) out.pierce += op.pierce;
      if (op.statusToEnemy) upsertStatus(out.statuses, { ...op.statusToEnemy });
      if (op.selfDamagePercent) { const sd = Math.ceil(p.maxHp * op.selfDamagePercent); if (p.hp + out.heal > sd) out.heal -= sd; }
      if (op.armor) out.armor += op.armor;
      if (op.armorFromTotalPoints) out.armor += X;
      if (op.armorMultFromTotalPoints) out.armor += Math.ceil(X * op.armorMultFromTotalPoints);
      if (op.armorBreak) out.armorBreak = true;
      if (op.armorToDamage && target) out.extra += target.armor || 0;
      if (op.scaleWithHits) out.extra += Math.min(10, p.furyHits);   // SPEC: 怒火 in the original
      if (op.scaleWithLostHp) out.extra += Math.ceil((p.maxHp - p.hp) * op.scaleWithLostHp);
      if (op.executeThreshold && target && target.hp / target.maxHp < op.executeThreshold) { out.multiplier *= op.executeMult || 1; if (op.executeHeal) out.heal += op.executeHeal; }   // SPEC: heal only on kill?
      if (op.aoeDamage) out.extra += op.aoeDamage;
      if (op.healFromValue) out.heal += d.value;
      if (op.healOrMaxHp) { if (p.hp < p.maxHp) out.heal += d.value; else out.post.push(['maxHp', 3]); }
      if (op.lowHpOverrideValue && op.lowHpThreshold && p.hp / p.maxHp < op.lowHpThreshold && d.value < op.lowHpOverrideValue) out.extra += op.lowHpOverrideValue - d.value;
      if (op.requiresTriple && op.bonusDamageFromPoints && hasTriple) out.extra += Math.ceil(X * op.bonusDamageFromPoints);
      if (op.scaleWithBloodRerolls && s.bloodRerollCount) out.extra += Math.min(s.bloodRerollCount, 3);
      if (op.selfBerserk) { out.multiplier *= 1.3; const bd = Math.ceil(p.maxHp * 0.05); if (p.hp + out.heal > bd) out.heal -= bd; }
      if (op.scaleWithSelfDamage) out.multiplier *= 1 + (s.bloodRerollCount || 0) * 2 * 0.2;
      if (op.damageFromArmor) out.extra += Math.ceil((s.armor + out.armor) * op.damageFromArmor);
      if (op.purifyAll) out.purify += 99;
      if (op.purifyOne) out.purify += 1;
    };
    if (!skip) for (const d of sel) {
      const b0 = { e: out.extra, m: out.multiplier, p: out.pierce, a: out.armor, h: out.heal, s: JSON.stringify(out.statuses), pu: out.purify, ab: out.armorBreak };
      procDie(d);
      const bits: string[] = [];
      if (out.extra !== b0.e) bits.push('+' + (out.extra - b0.e) + ' 伤害');
      if (Math.abs(out.multiplier - b0.m) > 1e-6) bits.push('×' + +(out.multiplier / b0.m).toFixed(2) + ' 伤害');
      if (out.pierce !== b0.p) bits.push('穿透+' + (out.pierce - b0.p));
      if (out.armor !== b0.a) bits.push('护甲+' + (out.armor - b0.a));
      if (out.heal !== b0.h) bits.push((out.heal - b0.h > 0 ? '回复+' : '自伤') + (out.heal - b0.h));
      if (out.armorBreak && !b0.ab) bits.push('破甲');
      if (out.purify !== b0.pu) bits.push('净化');
      if (JSON.stringify(out.statuses) !== b0.s) { const before: Status[] = JSON.parse(b0.s); for (const st of out.statuses) { const ob = before.find(x => x.type === st.type); const dv = st.value - (ob ? ob.value : 0); if (dv > 0 || !ob) bits.push(STATUS_CN[st.type] + (st.type === 'freeze' ? '' : ' ' + dv)); } }
      if (bits.length) step({ kind: 'die', label: d.def.name, txt: bits.join(' '), uid: d.uid });
    }
    if (skip) step({ kind: 'mod', label: '多选普攻', txt: '骰子特效禁用' });
    const total = Math.ceil(baseDamage * out.multiplier) + out.extra + out.pierce;
    let dmg = total;
    if (p.statuses.some(x => x.type === 'weak')) { dmg = Math.ceil(dmg * 0.75); out.tags.push('虚弱 -25%'); }
    if (target && target.statuses.some(x => x.type === 'vulnerable')) { dmg = Math.ceil(dmg * 2.0); out.tags.push('易伤 ×2'); }
    const fury = p.cls === 'warrior' ? Math.min(s.bloodRerollCount, 5) : 0;
    if (fury > 0) { dmg = Math.ceil(dmg * (1 + fury * 0.15)); out.tags.push('血怒 +' + fury * 15 + '%'); }
    if (p.cls === 'warrior' && s.rageMult > 0) { dmg = Math.ceil(dmg * (1 + s.rageMult)); out.tags.push('过充 +' + Math.round(s.rageMult * 100) + '%'); }
    for (const tg of out.tags) step({ kind: 'mod', label: tg.split(' ')[0], txt: tg.split(' ').slice(1).join(' ') });
    out.damage = dmg; out.total = total;
    out.aoe = (!skip && sel.some(d => d.def.onPlay?.aoe)) || hands.activeHands.some(h => STRAIGHTS.includes(h as HandName));
    out.tier = handTier(hands);
    return out;
  }

  // ------------------------------------------------------------ helpers
  private handDice(sel: Die[]) { return sel.map(d => ({ value: d.value, ignoreForHandType: !!d.def.onPlay?.ignoreForHandType })); }
  private pick(uids: number[]) { const hand = this.hand; return uids.map(u => hand.find(d => d.uid === u)).filter((d): d is Die => !!d); }
  private roll(d: Pick<Die, 'def'>) { return this.rng.pick(d.def.faces); }
  private newDie(defId: string): Die {
    const def = dieDef(defId);
    const d: Die = { uid: this.dieUid++, defId, def, value: 1, element: def.element || 'normal', temp: false, spent: false };
    d.value = this.roll(d);
    return d;
  }
  private buildEnemy(cfg: EnemyCfg, hpScale: number, dmgScale: number): Enemy {
    const hp = Math.floor(cfg.hp * hpScale);
    return {
      uid: this.enemyUid++, cfgId: cfg.id, name: cfg.name, hp, maxHp: hp, armor: 0, attackDmg: Math.floor(cfg.dmg * dmgScale), ct: cfg.ct, arch: cfg.arch, cat: cfg.cat,
      statuses: [], distance: cfg.ct === 'warrior' || cfg.ct === 'guardian' ? 2 : 3, attackCount: 0, hpScale, dmgScale, dropGold: cfg.drops?.gold ?? 20,
      summoned: 0, isSummoned: false, revived: false, wasFrozen: false, dead: false, quotedLow: false, phaseIdx: cfg.phases.length - 1,
    };
  }
  private quote(e: Enemy, kind: QuoteKind, chance: number) {
    const list = enemyCfg(e.cfgId).q?.[kind]; if (!list || !list.length) return;
    if (chance < 1 && this.rng.next() >= chance) return;
    this.emit({ t: 'quote', uid: e.uid, kind, index: this.rng.int(0, list.length - 1) });
  }
  private emit(e: BattleEvent) { this.ev.push(e); }
  private flush() { const e = this.ev; this.ev = []; return e; }
  private fail(reason: string): Result { this.ev = []; return { ok: false, reason, events: [] }; }
  /** Pile invariant: bag + discard + hand == owned. Throws in tests; the debug build reports it. */
  invariantErrors: string[] = [];
  private check(where: string) { if (!P.pilesOk(this.s.piles)) this.invariantErrors.push(`${where}: ${P.pileTotal(this.s.piles)} != ${this.s.piles.owned.length}`); }
}

export type { Who };
