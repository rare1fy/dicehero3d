// fx5 (FX_BRIEF): the skill-staging table. One row per skill and tier: the hero's move, the wind-up, the path the effect travels
// (projectile / bolt / meteor / blink …), the hit look and the camera weight. show2.ts asks it twice per play and nowhere else:
//   stageSkill(ctx)  — the moment of the play (presentPlay ③): resolves when the first blow lands, so the engine's hit beats line up;
//   stageHit(e, …)   — inside impact(): the element / mark / armour shards of each hit (the numbers, hurt and hit-stop stay in show2).
// It also keeps the control states on the bodies (ice shell while frozen, stars while stunned) by watching the plates' display state.
// Defensive plays (铁壁, 屏障, 完防) only ever use guard / chant moves.
import * as THREE from 'three';
import { V3, R, onUpdate, onLateUpdate } from '../engine/world';
import { wait, after, anim, animP, shake, slowmo, ease } from '../engine/clock';
import { CAM } from '../engine/gfx';
import { PADD, TILE } from '../engine/particles';
import { lightPulse, ringFx } from '../engine/prims';
import { GRADE } from '../look/post';
import { cue } from '../../audio/cues';
import { fxImpact, fxSparks, fxGlow, fxSmoke, fxEmbers, fxChips, fxFlare, trailSeg } from '../fx/fx';
import { fxSlashArc, fxSlashLine, fxBolt, fxGather, fxCircle, fxShock, fxShieldWall, fxPlateFlash, fxIceShell, fxIceSpikes, fxFrost, fxStunStars, fxProjectile, fxMeteor, fxAfterimage, fxShadowPuff, fxArmorShards, sideOf, type Hold } from '../fx/skillFx';
import { dh } from '../../debug/dh';
import { PREFS } from './meta/prefs';
import { gotoNode } from './adapt';
import type { BattleActor } from '../bestiary/battle';
import type { Ev2 } from '../../core/v2/events2';
import type { ClassId, StatusV2 } from '../../core/v2/types';
import type { Battle2 } from '../../core/v2/battle2';
import { Run2 } from '../../core/v2/run2';
import { blockCount } from '../fx/blocks';
import type { FoeDisp } from './hpDisplay';

type RowPlay = Extract<Ev2, { t: 'rowPlay' }>;
type Hit = Extract<Ev2, { t: 'hit' }>;

// ================================================================ the table
/** hero move: chop 过头劈 · guard 举斧横挡顿地 · sweep 横扫 · spin 旋风斩 · bash 冲撞 · leap 跃起砸地 · cast 快速施法 · release 蓄力→爆发 ·
 *  throw 甩手飞刀 · blink 瞬移身后刺 · dash 残影穿刺 · dance 闪身连斩 · nova 影葬 */
export type Move = 'chop' | 'guard' | 'sweep' | 'spin' | 'bash' | 'leap' | 'cast' | 'release' | 'throw' | 'blink' | 'dash' | 'dance' | 'nova';
/** wind-up on the hero before the move */
export type Windup = 'none' | 'blood' | 'bigBlood' | 'shadow';
/** how the effect travels from the hero to the targets */
export type Path = 'melee' | 'self' | 'knife' | 'missile' | 'shard' | 'chain' | 'skyChain' | 'frostRing' | 'meteor' | 'meteors' | 'bigMeteor' | 'shock' | 'bigShock';
/** hit look (stageHit): colour family + extras */
export type Elem = 'steel' | 'blood' | 'bash' | 'arcane' | 'ice' | 'thunder' | 'fire' | 'shadow' | 'poison';
/** the slash drawn through the target on the hit */
export type Mark = 'none' | 'chop' | 'sweep' | 'whirl' | 'stab' | 'cross';
/** camera weight: light = none · mid = a short push · heavy = push + shake · ult = push + slow motion + flash */
export type Cam = 'light' | 'mid' | 'heavy' | 'ult';
export interface SkillStage { name: string; move: Move; windup: Windup; path: Path; hit: Elem; mark: Mark; cam: Cam; /** after the blow: 血战 4 also guards */ thenGuard?: boolean }

const S = (name: string, move: Move, path: Path, hit: Elem, mark: Mark, cam: Cam, o: Partial<SkillStage> = {}): SkillStage => ({ name, move, windup: 'none', path, hit, mark, cam, ...o });
/** key = rowId/tier (basic rows: the loose row id, tier single). The audit table is docs/handoff/reports/fx_audit.md */
export const SKILL_STAGE: Record<string, SkillStage> = {
  // ── 嗜血狂战
  'w4_chop/single': S('劈砍', 'chop', 'melee', 'steel', 'chop', 'light'),
  'w4_loose/single': S('铁壁', 'guard', 'self', 'steel', 'none', 'light'),
  'w4_same/single': S('顺劈斩 2', 'sweep', 'melee', 'steel', 'sweep', 'mid'),
  'w4_same/feed': S('顺劈斩 3 溢出', 'sweep', 'melee', 'steel', 'sweep', 'mid'),
  'w4_same/area': S('顺劈斩 4+ 旋风', 'spin', 'melee', 'steel', 'whirl', 'heavy'),
  'w4_straight/single': S('盾冲 3', 'bash', 'shock', 'bash', 'none', 'mid'),
  'w4_straight/feed': S('盾冲 4 全体晕', 'bash', 'bigShock', 'bash', 'none', 'heavy'),
  'w4_straight/area': S('盾冲 5+ 全体', 'bash', 'bigShock', 'bash', 'none', 'heavy'),
  'w4_array/single': S('血战 4 斩+挡', 'chop', 'melee', 'blood', 'chop', 'heavy', { windup: 'blood', thenGuard: true }),
  'w4_array/area': S('血战 5 血旋风', 'spin', 'melee', 'blood', 'whirl', 'heavy', { windup: 'blood' }),
  'w4_array/ultimate': S('血战 6 终极', 'leap', 'bigShock', 'blood', 'none', 'ult', { windup: 'bigBlood' }),
  // ── 星界魔导（小咒 = cast；释放 = release：先蓄力再爆发）
  'm4_loose/single': S('奥术弹', 'cast', 'missile', 'arcane', 'none', 'light'),
  'm4_same/single': S('冰锥 2', 'cast', 'shard', 'ice', 'none', 'light'),
  'm4_same/feed': S('冰锥 3 冻结', 'cast', 'shard', 'ice', 'none', 'mid'),
  'm4_same/area': S('冰环 释放', 'release', 'frostRing', 'ice', 'none', 'heavy'),
  'm4_straight/single': S('闪电链 3', 'cast', 'chain', 'thunder', 'none', 'light'),
  'm4_straight/feed': S('闪电链 4 释放', 'release', 'chain', 'thunder', 'none', 'heavy'),
  'm4_straight/area': S('闪电链 5+ 释放', 'release', 'skyChain', 'thunder', 'none', 'heavy'),
  'm4_array/single': S('陨石 4 释放', 'release', 'meteor', 'fire', 'none', 'heavy'),
  'm4_array/area': S('陨石 5 释放', 'release', 'meteors', 'fire', 'none', 'heavy'),
  'm4_array/ultimate': S('陨石 6 终极', 'release', 'bigMeteor', 'fire', 'none', 'ult'),
  // ── 影锋刺客
  'r4_loose/single': S('袖箭', 'throw', 'knife', 'shadow', 'none', 'light'),
  'r4_same/single': S('背刺 2', 'blink', 'melee', 'shadow', 'stab', 'mid', { windup: 'shadow' }),
  'r4_same/feed': S('背刺 3 毒', 'blink', 'melee', 'poison', 'stab', 'mid', { windup: 'shadow' }),
  'r4_same/area': S('处决', 'blink', 'melee', 'shadow', 'cross', 'heavy', { windup: 'shadow' }),
  'r4_straight/single': S('影步 3', 'dash', 'melee', 'shadow', 'stab', 'light'),
  'r4_straight/feed': S('影步 4', 'dash', 'melee', 'shadow', 'stab', 'mid'),
  'r4_straight/area': S('千影', 'dash', 'melee', 'shadow', 'stab', 'heavy'),
  'r4_array/single': S('影舞 4', 'dance', 'melee', 'poison', 'stab', 'mid'),
  'r4_array/area': S('影舞 5', 'dance', 'melee', 'shadow', 'stab', 'heavy'),
  'r4_array/ultimate': S('影葬', 'nova', 'melee', 'shadow', 'cross', 'ult'),
};
const BASIC_ROW: Record<ClassId, string> = { warrior: 'w4_loose', mage: 'm4_loose', rogue: 'r4_loose' };
export function stageKey(e: RowPlay, cls: ClassId) {
  const row = e.rowId === 'basic' ? (cls === 'warrior' && e.v4?.loose === 'chop' ? 'w4_chop' : BASIC_ROW[cls]) : e.rowId;
  return `${row}/${e.ultimate ? 'ultimate' : e.tier ?? 'single'}`;
}
/** the table row for a play; a single-target row that actually hits several enemies (upgrades: 血战 III, 影步 III …) takes the area row */
export function stageOf(e: RowPlay, cls: ClassId, targets = 1): SkillStage {
  const k = stageKey(e, cls), row = k.split('/')[0];
  let s = SKILL_STAGE[k] ?? SKILL_STAGE[`${row}/single`];
  if (s && targets > 1 && (s.path === 'melee' && (s.move === 'chop' || s.move === 'sweep' || s.move === 'blink'))) s = SKILL_STAGE[`${row}/area`] ?? s;
  return s ?? (cls === 'mage' ? SKILL_STAGE['m4_loose/single'] : cls === 'rogue' ? SKILL_STAGE['r4_same/single'] : SKILL_STAGE['w4_chop/single']);
}

const ELEM: Record<Elem, number> = { steel: 0xffe2a8, blood: 0xff3a2a, bash: 0xffd060, arcane: 0xc080ff, ice: 0x9ae8ff, thunder: 0xfff07a, fire: 0xff7a30, shadow: 0xb070ff, poison: 0x8af070 };

// ================================================================ the play
export interface StageCtx {
  hero: BattleActor; foes: Map<number, BattleActor>; disp: Map<number, FoeDisp>; cls: ClassId;
  e: RowPlay; /** tier colour of the play */ col: number; /** the rest of the batch after this rowPlay */ next: Ev2[]; battle: Battle2 | null;
}
interface Plan { s: SkillStage; hits: Hit[]; targets: BattleActor[]; uids: number[]; tA: BattleActor | null; kills: Set<number>; freeze: Set<number>; stun: Set<number>; speed: number; last: boolean }
/** the play being staged (stageHit reads it; cleared by the next play) */
let cur: { s: SkillStage; hero: BattleActor; n: number; freeze: Set<number>; stun: Set<number>; lastKill: THREE.Vector3 | null } | null = null;
/** the rogue comes back from a blink / dash in the background: the next play waits for it */
let homing: Promise<void> = Promise.resolve();

export async function stageSkill(c: StageCtx): Promise<void> {
  await homing;
  bindBodies(c.foes, c.disp);
  const P = plan(c);
  cur = { s: P.s, hero: c.hero, n: P.uids.length, freeze: P.freeze, stun: P.stun, lastKill: null };
  STAGE.last = P.s.name; STAGE.count++;
  const fury = !!c.e.special?.some(x => x.kind === 'furyDie');
  if (c.cls === 'warrior' && c.e.strike > 1) rageFlare(c.hero);   // 斩杀再动: the extra action starts in a burst of red rage
  if (fury) furyWeapon(c.hero);
  switch (P.s.move) {
    case 'guard': return mvGuard(c, P);
    case 'chop': return mvChop(c, P);
    case 'sweep': return mvSweep(c, P);
    case 'spin': return mvSpin(c, P);
    case 'bash': return mvBash(c, P);
    case 'leap': return mvLeap(c, P);
    case 'cast': return mvCast(c, P, false);
    case 'release': return mvCast(c, P, true);
    case 'throw': return mvThrow(c, P);
    case 'blink': return mvBlink(c, P);
    case 'dash': return mvDash(c, P);
    case 'dance': return mvDance(c, P);
    case 'nova': return mvNova(c, P);
  }
}
function plan(c: StageCtx): Plan {
  const hits: Hit[] = [], freeze = new Set<number>(), stun = new Set<number>(), kills = new Set<number>(), uids: number[] = [];
  for (const x of c.next) {
    if (x.t === 'rowPlay' || x.t === 'enemyTurn') break;
    if (x.t === 'hit' && (x.source === 'play' || x.source === 'cleave')) { hits.push(x); if (x.source === 'play' && !uids.includes(x.uid)) uids.push(x.uid); if (x.killed) kills.add(x.uid); }
    if (x.t === 'statusAdd' && x.who !== 'player' && x.status.value > 0) { if (x.status.type === 'freeze') freeze.add(x.who); if (x.status.type === 'stun') stun.add(x.who); }
  }
  const live = (a?: BattleActor) => !!a && a.root.visible && !a.dead;
  const targets = uids.map(u => c.foes.get(u)).filter(live) as BattleActor[];
  const tA = (c.e.target != null && live(c.foes.get(c.e.target)) ? c.foes.get(c.e.target)! : targets[0]) ?? [...c.foes.values()].find(live) ?? null;
  const strike = c.e.v4?.strike ?? c.e.strike ?? 1, speed = c.cls === 'rogue' ? Math.min(1.6, 1 + 0.12 * (strike - 1)) : 1;
  const last = c.cls === 'rogue' && !!c.battle && c.battle.strikesLeft() === 0 && strike > 1;
  return { s: stageOf(c.e, c.cls, uids.length), hits, targets, uids, tA, kills, freeze, stun, speed, last };
}

// ---------------------------------------------------------------- shared bits
/** stand-off distance for a melee blow (same rule as before fx5: 1.6 m from a normal enemy, 2.6 m from a boss) */
function reach(c: StageCtx, hero: BattleActor, t: BattleActor | null) {
  if (!t) return 0;
  let big = false; for (const [uid, a] of c.foes) if (a === t) big = !!c.disp.get(uid)?.boss;
  return Math.max(0, hero.home.distanceTo(t.home) - (big ? 2.6 : 1.6));
}
function centroid(ts: BattleActor[], fallback: THREE.Vector3) { if (!ts.length) return fallback.clone(); const p = V3(); for (const t of ts) p.add(t.home); return p.divideScalar(ts.length); }
function flash(k: number, col: [number, number, number] = [1, 0.92, 0.8]) { GRADE.flashCol.setRGB(col[0], col[1], col[2]); anim(0.28, t => { GRADE.flash = k * (1 - t) * (1 - t); }, () => { GRADE.flash = 0; }, { real: true }); }
/** camera weight at the moment of the blow */
function camHit(cam: Cam, at: THREE.Vector3) {
  if (cam === 'mid') camPush(at, 0.55, 0.25);
  else if (cam === 'heavy') { camPush(at, 0.95, 0.35); shake(0.2); }
  else if (cam === 'ult') { camPush(at, 1.5, 0.6); slowmo(0.45, 0.3); flash(0.22); GRADE.split = 0.6; anim(0.5, t => { GRADE.split = 0.6 * (1 - t); }, () => { GRADE.split = 0; }, { real: true }); }
}
function rageFlare(hero: BattleActor) {
  const p = hero.chest(); fxEmbers(hero.home.clone().add(V3(0, 0.3, 0)), 0xff3a20, 22, { r: 0.6, up: 1.4 }); fxGlow(p, 0xff3a20, 2.2, 0.4, 2.4);
  ringFx(V3(hero.home.x, 0.05, hero.home.z), { color: 0xff3a20, radius: 1.5, r0: 0.4, life: 0.4, width: 0.2, fill: 0.15, bright: 1.8 }); cue('roar', 0.35);
}
function furyWeapon(hero: BattleActor) {
  anim(0.9, () => { const w = hero.weapon(); PADD.emit({ p: w.add(V3(R(-0.15, 0.15), R(-0.1, 0.2), R(-0.15, 0.15))), v: V3(R(-0.3, 0.3), R(1, 2.2), R(-0.3, 0.3)), s0: R(0.14, 0.24), s1: 0.03, life: R(0.3, 0.5), c0: new THREE.Color(0xffe080), c1: new THREE.Color(0xff3010), bright: 2.6, tile: TILE.glow, drag: 1, fadeIn: 0.05 }); });
}
/** the blood wind-up of 血战: red mist rising round the hero, motes pulled into the weapon */
async function windBlood(hero: BattleActor, big: boolean) {
  const n = big ? 3 : 2;
  for (let i = 0; i < n; i++) after(i * 0.12, () => { fxGather(hero.weapon(), 0xff2a1a, { r: big ? 2.2 : 1.5, n: big ? 24 : 14, life: 0.32 }); fxEmbers(hero.home.clone().add(V3(0, 0.2, 0)), 0xff2a1a, big ? 14 : 8, { r: 0.7, up: 1.6 }); });
  ringFx(V3(hero.home.x, 0.05, hero.home.z), { color: 0xff2a1a, radius: big ? 2.2 : 1.5, r0: big ? 2.0 : 1.4, life: big ? 0.6 : 0.4, width: 0.18, fill: 0.25, bright: 1.6 });
  fxGlow(hero.chest(), 0xff2a1a, big ? 2.8 : 1.8, 0.5, 2.2); cue('roar', big ? 0.7 : 0.4);
  if (big) { shake(0.25); lightPulse(hero.chest().add(V3(0, 0.5, 0.6)), 0xff2a1a, 2, 0.6, 7); }
  await wait(big ? 0.3 : 0.22);
}

// ---------------------------------------------------------------- 狂战
async function mvGuard(c: StageCtx, P: Plan) {
  const hero = c.hero, foe = P.tA; if (foe) hero.faceToward(foe.home);
  const act = hero.guard(1.25); cue('armor', 0.5);
  fxGather(hero.chest(), 0x8ac8ff, { r: 1.4, n: 14, life: 0.32 });
  await act.impact;   // the stomp: the ground rings, the wall rises in front (between the hero and the enemies)
  const f = hero.fwd(), at = hero.home.clone().addScaledVector(f, 1.0);
  fxShock(hero.home, 0x8ac8ff, 1.7, { decal: false }); shake(0.22); cue('block', 0.9);
  const wall = fxShieldWall(at, f, { w: 1.7, h: 1.55, col: 0x8ac8ff });
  after(1.05, () => wall.release(0.3));
  await wait(0.18);
}
async function mvChop(c: StageCtx, P: Plan) {
  const hero = c.hero, t = P.tA; if (t) hero.faceToward(t.home);
  if (P.s.windup === 'blood') await windBlood(hero, false);
  const act = hero.attack(reach(c, hero, t)); cue('whoosh', 0.9);
  await act.impact;
  if (t) camHit(P.s.cam, t.chest());
  // 血战 4 = 斩 + 挡: right after the blow the hero hops back home raising the axe, and the wall forms there (the armour beat that
  // follows pops its number over the hero at home, not out by the enemy)
  if (P.s.thenGuard) after(0.12, () => {
    if (hero.act !== act) return;
    const g = hero.guard(1.0, Math.max(0, hero.off.z));
    void g.impact.then(() => { const f = hero.fwd(); const w = fxShieldWall(hero.home.clone().addScaledVector(f, 0.95), f, { w: 1.4, h: 1.2, col: 0xff8a7a, cols: 4, rows: 3 }); after(0.6, () => w.release(0.25)); cue('armor', 0.6); });
  });
}
async function mvSweep(c: StageCtx, P: Plan) {
  const hero = c.hero, t = P.tA; if (t) hero.faceToward(t.home);
  const act = hero.sweep(reach(c, hero, t)); cue('whoosh', 1.0);
  await act.impact;
  if (t) camHit(P.s.cam, t.chest());
}
async function mvSpin(c: StageCtx, P: Plan) {
  const hero = c.hero, ts = P.targets.length ? P.targets : P.tA ? [P.tA] : [], mid = centroid(ts, hero.home.clone().add(V3(0, 0, -3)));
  hero.faceToward(mid);
  if (P.s.windup === 'blood') await windBlood(hero, false);
  const dist = Math.max(0, hero.home.distanceTo(mid) - 1.0), col = ELEM[P.s.hit];
  const act = hero.spin(dist); cue('whoosh', 1.1);
  // the whirl: a ring of slash streaks round the hero on every turn while it is out among the enemies
  for (const k of [0.32, 0.45, 0.58]) after(k * 1.05, () => { const p = hero.root.position.clone().add(V3(0, 0.9, 0)); fxSlashArc(p, hero.fwd(), col, { r: 1.5, span: Math.PI * 2, n: 30, life: 0.24, dur: 0.12, size: 0.14 }); cue('whoosh', 0.6); });
  await act.impact;
  const at = hero.root.position.clone();
  fxShock(at, col, 2.6, { decal: true }); camHit(P.s.cam, at.clone().add(V3(0, 1, 0)));
}
async function mvBash(c: StageCtx, P: Plan) {
  const hero = c.hero, t = P.tA; if (t) hero.faceToward(t.home);
  const act = hero.bash(reach(c, hero, t) + 0.3); cue('whoosh', 1.0);
  // dust kicked up along the charge
  anim(0.25, () => { const p = hero.root.position; fxSmoke(V3(p.x, 0.08, p.z), 0x6a6670, 1, { s: 0.3, alpha: 0.35, up: 0.4, life: 0.6 }); });
  await act.impact;
  const at = t ? t.home.clone().lerp(hero.root.position, 0.4) : hero.root.position.clone();
  if (P.s.path === 'bigShock') { fxShock(at, 0xffd060, 4.6, { life: 0.55 }); after(0.08, () => fxShock(at, 0xffffff, 3.2, { decal: false, dust: false, life: 0.4 })); }
  else fxShock(at, 0xffd060, 1.8);
  cue('block', 1); camHit(P.s.cam, t ? t.chest() : at);
}
async function mvLeap(c: StageCtx, P: Plan) {
  const hero = c.hero, ts = P.targets.length ? P.targets : P.tA ? [P.tA] : [], mid = centroid(ts, hero.home.clone().add(V3(0, 0, -3)));
  hero.faceToward(mid);
  await windBlood(hero, true);
  const act = hero.leap(Math.max(0, hero.home.distanceTo(mid) - 0.9), 1.35); cue('whoosh', 1.2);
  camPush(mid.clone().add(V3(0, 1, 0)), 0.8, 0.9);
  await act.impact;
  const at = hero.root.position.clone();
  fxShock(at, 0xff2a1a, 5.2, { life: 0.65 }); after(0.1, () => fxShock(at, 0xffd0b0, 3.4, { decal: false, dust: false, life: 0.45 }));
  fxChips(at.clone().add(V3(0, 0.3, 0)), [0x4a3a34, 0x6a5a50, 0xff3a2a], 22, { speed: 7, up: 6, glow: 0.6 });
  fxEmbers(at, 0xff3a2a, 24, { r: 1.4 }); lightPulse(at.clone().add(V3(0, 1, 1)), 0xff3a2a, 3, 0.6, 10);
  camHit('ult', at.clone().add(V3(0, 1, 0))); cue('crit', 1.4);
}

// ---------------------------------------------------------------- 魔导
async function mvCast(c: StageCtx, P: Plan, release: boolean) {
  const hero = c.hero, t = P.tA, col = ELEM[P.s.hit]; if (t) hero.faceToward(t.home);
  if (release) {
    // 释放: a real charge — staff up, a circle on the ground, light pulled into the staff, the hero lit from below — then the thrust
    const big = P.s.cam === 'ult', dur = big ? 1.45 : 1.25, ch = hero.release(dur, big); cue('magic', 0.8);
    fxCircle(hero.home, col, big ? 1.9 : 1.45, dur * 0.85, { runes: big ? 12 : 8 });
    const n = big ? 5 : 4; for (let i = 0; i < n; i++) after(0.12 + i * (dur * 0.58 / n), () => { fxGather(hero.weapon(), col, { r: big ? 2.4 : 1.8, n: big ? 26 : 18, life: 0.34 }); fxGlow(hero.weapon(), col, 0.8 + i * 0.25, 0.3, 1.6); });
    if (P.s.path === 'meteor' || P.s.path === 'meteors' || P.s.path === 'bigMeteor') { const c0 = centroid(P.targets.length ? P.targets : t ? [t] : [], V3(0, 0, -3)), sky = V3(c0.x + 2.6, 5.6, c0.z - 2.8); after(dur * 0.35, () => { fxGlow(sky, 0xff7a30, big ? 6 : 4, big ? 1.0 : 0.8, 2); lightPulse(sky.clone().add(V3(0, -4, 0)), 0xff6a20, 1.6, 0.9, 12); }); }
    lightPulse(hero.chest().add(V3(0, 0.3, 0.8)), col, 1.0, dur * 0.8, 6);
    if (big) after(dur * 0.4, () => shake(0.3));   // (the gather step already slows time for an ultimate)
    await ch.impact;
    fxFlare(hero.weapon(), col, 2.2, 0.3); fxGlow(hero.weapon(), col, 2.4, 0.3, 3); cue('magic', 1);
  } else {
    const act = hero.quickCast(0.55); fxGlow(hero.weapon(), col, 1.2, 0.3, 2.2); cue('magic', 0.5);
    await act.impact;
  }
  const from = hero.weapon(), ts = P.targets.length ? P.targets : t ? [t] : [];
  switch (P.s.path) {
    case 'missile': if (t) await fxProjectile(from, t.chest(), 'missile', { col }); break;
    case 'shard': if (t) { cue('whoosh', 0.7); await fxProjectile(from, t.chest(), 'shard', { dur: 0.18 }); } break;
    case 'chain': {   // the bolt jumps target to target, in the order the engine bounced it
      let p = from; cue('crit', 0.5);
      for (let i = 0; i < ts.length; i++) { const q = ts[i].chest(); fxBolt(p, q, col, { width: release ? 0.2 : 0.14, jag: release ? 0.4 : 0.3 }); if (release && i === 0) flash(0.1, [1, 1, 0.7]); p = q; if (i < ts.length - 1) await wait(0.07); }
      if (release && ts[0]) camHit(P.s.cam, ts[0].chest());
      break;
    }
    case 'skyChain': {   // 5+: a bolt out of the sky onto every enemy, then the chain lights up between them
      cue('crit', 0.8);
      for (let i = 0; i < ts.length; i++) { const q = ts[i].chest(); fxBolt(q.clone().add(V3(R(-0.6, 0.6), 9, R(-0.4, 0.4))), q, col, { width: 0.24, jag: 0.5, seg: 10 }); fxShock(ts[i].home, col, 1.4, { decal: true, dust: false }); if (i === 0) flash(0.14, [1, 1, 0.7]); if (i < ts.length - 1) await wait(0.05); }
      for (let i = 1; i < ts.length; i++) fxBolt(ts[i - 1].chest(), ts[i].chest(), col, { width: 0.12, jag: 0.3 });
      camHit(P.s.cam, centroid(ts, V3(0, 0, -2)).add(V3(0, 1, 0)));
      break;
    }
    case 'frostRing': {   // 冰环: the staff hits the ground, frost runs out to every enemy, ice spikes erupt under them
      const far = Math.max(2, ...ts.map(x => x.home.distanceTo(hero.home))) + 0.8;
      fxFrost(hero.home, far, 0.45); cue('shatter', 0.6);
      for (const x of ts) fxIceSpikes(x.home, Math.max(0.6, x.width * 0.55), 7, { h: Math.min(1.6, x.top * 0.6), delay: 0.38 * (x.home.distanceTo(hero.home) / far) });
      await wait(0.36); camHit(P.s.cam, centroid(ts, V3(0, 0, -2)).add(V3(0, 1, 0)));
      break;
    }
    case 'meteor': if (t) { await fxMeteor(t.chest(), { size: 0.7, dur: 0.5 }); camHit(P.s.cam, t.chest()); } break;
    case 'meteors': {
      ts.forEach((x, i) => { if (i > 0) void fxMeteor(x.chest(), { size: 0.6, dur: 0.5, delay: i * 0.12 }); });
      if (ts[0]) { await fxMeteor(ts[0].chest(), { size: 0.6, dur: 0.5 }); camHit(P.s.cam, ts[0].chest()); }
      break;
    }
    case 'bigMeteor': {
      const mid = centroid(ts, V3(0, 0, -2.4));
      camPush(mid.clone().add(V3(0, 1, 0)), 0.9, 0.8);
      await fxMeteor(mid.clone().add(V3(0, 0.8, 0)), { size: 1.7, dur: 0.8, from: V3(mid.x + 3.2, 6.2, mid.z - 3.4) });
      fxShock(mid, 0xff7a30, 6, { life: 0.7 }); camHit('ult', mid.clone().add(V3(0, 1, 0)));
      break;
    }
  }
}

// ---------------------------------------------------------------- 刺客
async function mvThrow(c: StageCtx, P: Plan) {
  const hero = c.hero, t = P.tA; if (t) hero.faceToward(t.home);
  const act = hero.throwKnife(0.5 / P.speed); await act.impact; cue('whoosh', 0.7);
  if (t) await fxProjectile(hero.bonePos('handL'), t.chest(), 'knife', { dur: 0.15 });
  if (P.last && t) lastStrike(t.chest());
}
/** where the body is drawn now (home, or away on a blink / dash) */
const posOf = (hero: BattleActor) => (hero.warp ?? hero.home).clone();
/** a vanish / reappear: shadow puff, the body hidden, moved (warp: home itself never moves), shown again. to = null → home */
async function blinkTo(hero: BattleActor, to: THREE.Vector3 | null, face: THREE.Vector3, gap = 0.1) {
  const from = posOf(hero), dest = (to ?? hero.home).clone();
  fxShadowPuff(from, hero.top); hero.body.visible = false; cue('whoosh', 0.8);
  const n = 3; for (let i = 1; i <= n; i++) { const p = from.clone().lerp(dest, i / (n + 1)); after(i * gap / (n + 1), () => fxAfterimage(p, hero.top, 0x6a3aa8, { life: 0.35 })); }
  await wait(gap);
  hero.warp = to ? dest : null; hero.faceFrom(face); hero.body.visible = true; fxShadowPuff(dest, hero.top);
}
function goHome(hero: BattleActor, face: THREE.Vector3, delay: number) {
  homing = (async () => { await wait(delay); if (!hero.warp) return; await blinkTo(hero, null, face, 0.08); })();
}
/** behind the target, seen from the hero — and off to one shoulder (toward the middle of the field), because straight behind it the
 *  body would hide the rogue from the battle camera */
function behind(hero: BattleActor, t: BattleActor) {
  const d = t.home.clone().sub(hero.home).setY(0).normalize(), s = sideOf(d); if (s.x * t.home.x > 0) s.negate();
  return t.home.clone().addScaledVector(d, t.width * 0.35 + 0.4).addScaledVector(s, t.width * 0.5 + 0.35);
}
async function mvBlink(c: StageCtx, P: Plan) {
  const hero = c.hero, t = P.tA; if (!t) return;
  const face = t.home.clone();
  hero.faceToward(t.home); const cr = hero.crouch(0.2 / P.speed); await cr.impact;
  await blinkTo(hero, behind(hero, t), t.home, 0.12 / P.speed);
  const exec = P.s.mark === 'cross';
  // 处决: the world drains of colour as the blade comes round; slow motion starts on the blow itself (the cross slash + numbers)
  if (exec) { anim(0.25, k => { GRADE.desat = 0.55 * k; }, undefined, { real: true }); cue('reveal', 1); }
  const act = hero.stab(0, P.speed * 1.1); cue('whoosh', 0.8);
  await act.impact;
  if (exec) { slowmo(0.5, 0.3); anim(0.7, k => { GRADE.desat = 0.55 * (1 - k); }, () => { GRADE.desat = 0; }, { real: true }); }
  camHit(P.s.cam, t.chest()); if (P.last) lastStrike(t.chest());
  goHome(hero, face, 0.3);
}
async function mvDash(c: StageCtx, P: Plan) {
  const hero = c.hero, ts = P.targets.length ? P.targets : P.tA ? [P.tA] : []; if (!ts.length) return;
  const face = ts[0].home.clone();
  hero.faceToward(ts[0].home); const cr = hero.crouch(0.18 / P.speed); await cr.impact;
  fxShadowPuff(hero.home, hero.top); cue('whoosh', 0.9);
  // a straight line through each target (in and out the far side), leaving afterimages; the first pass resolves the play
  const pass = async (from: THREE.Vector3, t: BattleActor) => {
    const d = t.home.clone().sub(from).setY(0).normalize(), to = t.home.clone().addScaledVector(d, t.width * 0.5 + 0.8), w = from.clone();
    hero.warp = w; hero.faceFrom(to); const dur = 0.16 / P.speed; let acc = 0;
    hero.stab(0, P.speed * 1.6);
    await animP(dur, k => { w.lerpVectors(from, to, ease.inOut(k)); acc++; if (acc % 2 === 0) fxAfterimage(w.clone(), hero.top, 0x5a2a98, { life: 0.4 }); });
    trailSeg(from.clone().add(V3(0, 0.9, 0)), to.clone().add(V3(0, 0.9, 0)), 0x8a50d8, 0.18, { life: 0.35, bright: 1.8 });
    return to;
  };
  let at = await pass(hero.home.clone(), ts[0]);
  camHit(P.s.cam, ts[0].chest()); if (P.last && ts.length === 1) lastStrike(ts[0].chest());
  const rest = ts.slice(1);
  homing = (async () => { for (const t of rest) { await wait(0.04); at = await pass(at, t); } await wait(0.2); await blinkTo(hero, null, face, 0.08); })();
}
async function mvDance(c: StageCtx, P: Plan) {
  const hero = c.hero, ts = P.targets.length ? P.targets : P.tA ? [P.tA] : []; if (!ts.length) return;
  const home = hero.home.clone(), face = (P.tA ?? ts[0]).home.clone();
  const side = (t: BattleActor, i: number) => { const d = t.home.clone().sub(home).setY(0).normalize(), s = sideOf(d).multiplyScalar(i % 2 ? 1 : -1); return t.home.clone().addScaledVector(s, t.width * 0.5 + 0.6).addScaledVector(d, -0.2); };
  const visit = async (t: BattleActor, i: number) => {
    await blinkTo(hero, side(t, i), t.home, 0.07); const a = hero.stab(0, 1.7); await a.impact;
    fxSlashArc(t.chest(), t.home.clone().sub(posOf(hero)), ELEM[P.s.hit], { r: 0.7, span: 1.6, vertical: i % 2 === 0, n: 14, life: 0.2 });
  };
  hero.faceToward(face); cue('whoosh', 0.9);
  await visit(ts[0], 0); camHit(P.s.cam, ts[0].chest());
  const rest = ts.slice(1);
  homing = (async () => { for (let i = 0; i < rest.length; i++) { await wait(0.03); await visit(rest[i], i + 1); } await wait(0.15); await blinkTo(hero, null, face, 0.08); })();
}
async function mvNova(c: StageCtx, P: Plan) {
  const hero = c.hero, ts = P.targets.length ? P.targets : P.tA ? [P.tA] : []; if (!ts.length) return;
  const face = (P.tA ?? ts[0]).home.clone(), mid = centroid(ts, V3(0, 0, -2.4));
  hero.faceToward(face); const cr = hero.crouch(0.22); await cr.impact;
  // a flurry: one cut on each enemy (fast, afterimages everywhere), then the hero lands in the middle and the shadow bursts
  for (let i = 0; i < ts.length; i++) { const t = ts[i]; await blinkTo(hero, behind(hero, t), t.home, 0.05); hero.stab(0, 2); fxSlashLine(t.chest().add(V3(-0.6, 0.6, 0)), t.chest().add(V3(0.6, -0.6, 0)), 0xb070ff, { n: 10 }); await wait(0.06); }
  await blinkTo(hero, mid.clone().add(V3(0, 0, 0.6)), mid.clone().add(V3(0, 0, -2)), 0.06);
  const a = hero.crouch(0.25); await a.impact;
  fxShock(mid, 0x8a50d8, 5, { life: 0.6 }); after(0.08, () => fxShock(mid, 0x2a1838, 3.5, { decal: false, dust: false }));
  for (const t of ts) { fxAfterimage(t.home, t.top, 0x3a1a68, { life: 0.6, w: 0.7 }); }
  camHit('ult', mid.clone().add(V3(0, 1, 0))); cue('crit', 1.3);
  goHome(hero, face, 0.45);
}
function lastStrike(at: THREE.Vector3) { slowmo(0.22, 0.35); flash(0.18, [0.9, 0.7, 1]); fxFlare(at, 0xe0a8ff, 2, 0.3); }

// ================================================================ the hits
/** the look of one hit (called by show2 impact() in place of its old fxImpact). Numbers, hurt, hit-stop and shake stay in show2. */
export function stageHit(e: Hit, a: BattleActor, p: THREE.Vector3, d?: FoeDisp) {
  const st = (e.source === 'play' || e.source === 'cleave') && cur ? cur : null, s = st?.s, elem: Elem = s?.hit ?? 'steel', col = ELEM[elem];
  const hero = st?.hero, dir = hero ? a.home.clone().sub(hero.root.position).setY(0).normalize() : V3(0, 0, -1), at = p.clone().add(V3(0, 0, 0.4));
  const many = (st?.n ?? 1) > 2 && e.aoe, power = Math.min(3, 0.6 + e.dmg / 22) * (many ? 0.8 : 1);
  // 顺劈 overflow: a stream of embers flies from the enemy that just fell to the next one, then it hits
  if (e.source === 'cleave' && st?.lastKill) cleaveStream(st.lastKill, p);
  fxImpact(at, e.aoe && elem === 'steel' ? 0xffc040 : col, power, { dir: V3(dir.x * 0.6, 0.1, -1).normalize() });
  switch (elem) {
    case 'blood': fxSparks(p, 0xc01010, 18, 5, { dir, life: 0.6, grav: 12, size: 0.1 }); fxGlow(p, 0xff2010, 1.6, 0.3, 2); break;
    case 'bash': fxFlare(p, 0xffe07a, 1.4, 0.25); break;
    case 'arcane': fxGlow(p, 0xc080ff, 1.8, 0.35, 2.2); fxSparks(p, 0xe0b0ff, 12, 4, { life: 0.4, grav: 2 }); break;
    case 'ice': fxChips(p, [0xd8f6ff, 0x9ae8ff, 0xffffff], 10, { dir, speed: 4, glow: 0.6, size: 0.1 }); fxSmoke(p, 0xc8e8f0, 3, { alpha: 0.3, s: 0.35 }); break;
    case 'thunder': for (let i = 0; i < 3; i++) fxBolt(p, p.clone().add(V3(R(-0.9, 0.9), R(-0.6, 0.8), R(-0.3, 0.5))), 0xfff07a, { seg: 3, width: 0.06, branch: false, life: 0.15 }); break;
    case 'fire': fxEmbers(p, 0xff7a30, 10, { r: 0.5 }); break;
    case 'shadow': fxSmoke(p, 0x2a1838, 4, { alpha: 0.5, s: 0.4, up: 0.8 }); fxSparks(p, 0xb070ff, 10, 4, { life: 0.4, grav: -1 }); break;
    case 'poison': fxSparks(p, 0x8af070, 12, 3, { life: 0.5, grav: 4 }); fxSmoke(p, 0x4a8a3a, 3, { alpha: 0.35, s: 0.3 }); break;
  }
  if (hero && e.source === 'play') {
    const mark = s?.mark ?? 'none', mc = elem === 'steel' ? 0xfff0c8 : col;
    if (mark === 'chop') fxSlashArc(p.clone().addScaledVector(dir, -0.2), dir, mc, { vertical: true, r: 0.95, span: 1.5, n: 18, dir: -1 });
    else if (mark === 'sweep') fxSlashArc(p.clone().addScaledVector(dir, -0.9), dir, mc, { r: 1.3, span: 2.0, n: 22, dir: 1 });
    else if (mark === 'stab') fxSlashLine(p.clone().addScaledVector(dir, -0.6).add(V3(0, 0.15, 0)), p.clone().addScaledVector(dir, 0.6), mc, { n: 10, size: 0.1 });
    else if (mark === 'cross') { const sd = sideOf(dir); fxSlashLine(p.clone().addScaledVector(sd, -0.9).add(V3(0, 0.9, 0)), p.clone().addScaledVector(sd, 0.9).add(V3(0, -0.7, 0)), 0xfff0f0, { n: 16, size: 0.16 }); after(0.08, () => fxSlashLine(p.clone().addScaledVector(sd, 0.9).add(V3(0, 0.9, 0)), p.clone().addScaledVector(sd, -0.9).add(V3(0, -0.7, 0)), 0xff3050, { n: 16, size: 0.16 })); if (e.killed) flash(0.3, [1, 0.85, 0.85]); }
  }
  // armour: plates fly off; this hit emptied the armour → it breaks
  if (e.absorbed > 0) fxArmorShards(p, dir, Math.min(14, 4 + e.absorbed), !!d && d.armor <= 0);
  // control applied by this play: the shell / stars appear with the hit (the plate catches up a moment later)
  if (st && e.source === 'play') { if (st.freeze.has(e.uid)) bodyFreeze(e.uid, a, 1.5); if (st.stun.has(e.uid)) bodyStun(e.uid, a, 1.5); }
  if (st && e.killed) st.lastKill = p.clone();
}
function cleaveStream(from: THREE.Vector3, to: THREE.Vector3) {
  const d = to.clone().sub(from), L = d.length(), T = 0.22;
  for (let i = 0; i < 26; i++) { const off = V3(R(-0.2, 0.2), R(-0.1, 0.3), R(-0.2, 0.2)); PADD.emit({ p: from.clone().add(off), v: d.clone().divideScalar(T).multiplyScalar(R(0.85, 1.05)), s0: R(0.08, 0.14), s1: 0.03, life: T * R(0.9, 1.1), c0: new THREE.Color(0xffe080), c1: new THREE.Color(0xff4020), bright: 2.8, tile: TILE.spark, stretch: 0.03, fadeIn: 0 }); }
  trailSeg(from, to, 0xff6a20, 0.16, { life: 0.3, bright: 2 }); fxFlare(from, 0xff9a40, 1.2, 0.2); void L;
}

// ================================================================ control states on the bodies
interface Body { shell?: ReturnType<typeof fxIceShell>; stars?: Hold; grace: number; frozenT: number }
const bodies = new Map<number, Body>();
let SRC: { foes: Map<number, BattleActor>; disp: Map<number, FoeDisp> } | null = null;
function bindBodies(foes: Map<number, BattleActor>, disp: Map<number, FoeDisp>) {
  if (SRC) { SRC.foes = foes; SRC.disp = disp; return; }
  SRC = { foes, disp }; onUpdate(dt => tickBodies(dt));
}
const hasSt = (d: FoeDisp | undefined, type: StatusV2) => !!d && !d.dying && !d.gone && d.statuses.some(s => s.type === type && s.value > 0);
function body(uid: number) { let b = bodies.get(uid); if (!b) { b = { grace: 0, frozenT: 0 }; bodies.set(uid, b); } return b; }
function bodyFreeze(uid: number, a: BattleActor, grace: number) {
  const b = body(uid); b.grace = Math.max(b.grace, grace); if (b.shell) return;
  b.shell = fxIceShell(a.root, Math.max(0.9, a.width * 0.95 + 0.15), Math.max(1.2, Math.min(4.5, a.top * 0.95))); b.frozenT = a.t; cue('shatter', 0.4);
}
function bodyStun(uid: number, a: BattleActor, grace: number) {
  const b = body(uid); b.grace = Math.max(b.grace, grace); if (b.stars) return;
  b.stars = fxStunStars(a.root, a.top + 0.25, 0.3 + a.width * 0.15);
}
function tickBodies(dt: number) {
  if (!SRC) return;
  for (const [uid, b] of bodies) {
    const a = SRC.foes.get(uid), d = SRC.disp.get(uid);
    if (!a || !a.root.parent || a.dead || !d || d.gone || d.dying) { b.shell?.shatter(); b.stars?.release(); bodies.delete(uid); continue; }
    b.grace = Math.max(0, b.grace - dt);
    if (b.shell && b.grace <= 0 && !hasSt(d, 'freeze')) { b.shell.shatter(); b.shell = undefined; cue('shatter', 0.6); }
    if (b.stars && b.grace <= 0 && !hasSt(d, 'stun')) { b.stars.release(); b.stars = undefined; }
    // frozen solid: the idle stops and the body takes an icy tint
    if (b.shell) { a.t = b.frozenT; if (!a.act) a.tint(0x6ac8ff, 0.22); }
    if (!b.shell && !b.stars) bodies.delete(uid);
  }
  for (const [uid, a] of SRC.foes) {
    if (bodies.has(uid) || !a.root.visible || a.dead) continue;
    const d = SRC.disp.get(uid);
    if (hasSt(d, 'freeze')) bodyFreeze(uid, a, 0);
    if (hasSt(d, 'stun')) bodyStun(uid, a, 0);
  }
}

// ================================================================ camera push (CAM.off: added to the shot by the frame loop)
const PUSH = { dir: V3(), amt: 0, t: 0, a: 0.14, h: 0.3, r: 0.45, on: false, bound: false };
/** push the camera along the view line toward `at` by amt metres, hold, ease back (real time: hit-stop never freezes it) */
export function camPush(at: THREE.Vector3, amt: number, hold = 0.3) {
  if (!PUSH.bound) { PUSH.bound = true; onLateUpdate((_dt, rdt) => tickPush(rdt)); }
  if (PUSH.on && PUSH.amt > amt && PUSH.t < PUSH.a + PUSH.h) return;   // a bigger push is still holding
  PUSH.dir.copy(at).sub(CAM.base).normalize(); PUSH.amt = amt; PUSH.t = 0; PUSH.h = hold; PUSH.on = true;
}
function tickPush(rdt: number) {
  if (!PUSH.on) return;
  PUSH.t += rdt; const t = PUSH.t, a = PUSH.a, h = PUSH.h, r = PUSH.r;
  if (t >= a + h + r) { PUSH.on = false; CAM.off.set(0, 0, 0); return; }
  const env = t < a ? ease.outCubic(t / a) : t < a + h ? 1 : 1 - ease.inOut((t - a - h) / r);
  CAM.off.copy(PUSH.dir).multiplyScalar(PUSH.amt * env);
}

// ================================================================ prepared for the beats outside the play (wire-up: fx_report.md)
/** 吟唱 (end the turn without casting): the staff raised, a small circle at the feet */
export function stageChantIdle(hero: BattleActor) { hero.chant(1.0); fxCircle(hero.home, 0x6ab8ff, 1.2, 1.0, { runes: 6, spin: 1 }); fxGather(hero.weapon(), 0x8ac8ff, { r: 1.4, n: 12, life: 0.4 }); }
/** 屏障: a guard / chant pose (never an attack) while the dome lights up */
export function stageBarrier(hero: BattleActor) { hero.chant(0.9); fxShock(hero.home, 0x45dacb, 1.6, { decal: false, dust: false }); fxGather(hero.chest(), 0x45dacb, { r: 1.6, n: 14, life: 0.35 }); }
/** 完防: the blow rings off the armour (a plate flash in front, no damage) */
export function stageGuardFlash(hero: BattleActor, from?: THREE.Vector3) { const f = from ? from.clone().sub(hero.home).setY(0).normalize() : hero.fwd(); fxPlateFlash(hero.chest().addScaledVector(f, 0.7), f); }
/** 斩杀再动 granted: a burst of red rage on the hero */
export function stageRage(hero: BattleActor) { rageFlare(hero); }

// ================================================================ debug / captures
export const STAGE = { last: '', count: 0 };
/** __dh.fxTest({ vals:[4,4,4,4], row:'w4_same', loose, target, foes:3, hp:200, stay:true, strike:2 }): set the dice and play a row */
async function fxTest(o: { vals: number[]; row?: string; loose?: 'chop' | 'guard'; target?: number; foes?: number; hp?: number; stay?: boolean; strike?: number }) {
  type AnyShow = { b: Battle2 | null; dice: Map<number, { topIdx: number; topTurns: number; setValue(v: number, t: number, n: number): void }>; act(a: unknown): boolean; selectUids(u: number[]): void; runEvents(e: Ev2[]): Promise<void>; idle(): boolean; syncLive(): void };
  const s = (dh.api.show2 as () => AnyShow)(), b = s.b;
  if (!b || !s.idle()) return 'not idle';
  if (o.stay) PREFS.autoEnd = false;
  const build = (b as unknown as { buildEnemy(id: string, r: string, sc: { hp: number; dmg: number }): Battle2['s']['enemies'][number] }).buildEnemy.bind(b);
  if (o.foes) while (b.alive().length < o.foes) { const m = build('forest_ghoul', 'normal', { hp: 1, dmg: 1 }); b.s.enemies.push(m); await s.runEvents([{ t: 'enemyEnter', uid: m.uid }]); }
  if (o.hp != null) { for (const e of b.alive()) { e.maxHp = Math.max(e.maxHp, o.hp); e.hp = o.hp; } s.syncLive(); }
  b.s.strikesUsed = Math.max(0, (o.strike ?? 1) - 1); b.s.maxStrikes = Math.max(b.s.maxStrikes, b.s.strikesUsed + 1);
  const fresh: Array<{ uid: number; kind: 'normal'; value: number; suit: 'none' }> = [];
  while (b.s.dice.length < o.vals.length) { const d = { uid: b.s.dieUid++, kind: 'normal' as const, face: { value: 1, suit: 'none' as const }, persist: 'turn' as const, source: 'base' as const, carried: 0 }; b.s.dice.push(d); fresh.push({ uid: d.uid, kind: 'normal', value: 1, suit: 'none' }); }
  if (fresh.length) await s.runEvents([{ t: 'roll', dice: fresh, reason: 'return', kept: [] }]);
  const uids = b.s.dice.slice(0, o.vals.length).map((d, i) => { d.face.value = o.vals[i]; const v = s.dice.get(d.uid); v?.setValue(o.vals[i], v.topIdx, v.topTurns); return d.uid; });
  const ref = o.row ? b.rows().find(r => r.def.id === o.row)?.ref ?? 'basic' : 'basic';
  s.selectUids(uids);
  return s.act({ k: 'play', ref, uids, target: o.target ?? b.target()?.uid, loose: o.loose });
}
/** __dh.fxSetup({ foes: 3, hp: 200 }): more ghouls on the field and everyone's HP set (before a series of fxTest calls) */
async function fxSetup(o: { foes?: number; hp?: number }) {
  const s = (dh.api.show2 as () => { b: Battle2 | null; runEvents(e: Ev2[]): Promise<void>; syncLive(): void })(), b = s.b; if (!b) return 'no battle';
  PREFS.autoEnd = false;
  const build = (b as unknown as { buildEnemy(id: string, r: string, sc: { hp: number; dmg: number }): Battle2['s']['enemies'][number] }).buildEnemy.bind(b);
  const add: Ev2[] = [];
  while (b.alive().length < (o.foes ?? 0)) { const m = build('forest_ghoul', 'normal', { hp: 1, dmg: 1 }); b.s.enemies.push(m); add.push({ t: 'enemyEnter', uid: m.uid }); }
  if (o.hp != null) for (const e of b.alive()) { e.maxHp = Math.max(e.maxHp, o.hp); e.hp = o.hp; }
  if (add.length) await s.runEvents(add);
  s.syncLive(); return b.alive().map(e => [e.uid, e.hp]);
}
/** __dh.fxStart('mage', 'elite'): a linear-slice run (no chapter map) straight into a fight, for skill captures */
function fxStart(cls: ClassId, node: 'normal' | 'elite' | 'boss' = 'normal', seed = 7) {
  const s = (dh.api.show2 as () => { startRun(r: Run2, log: string): void })(), run = new Run2({ seed, classId: cls, map: false } as ConstructorParameters<typeof Run2>[0]);   // map: only once the chapter map lands
  if (node !== 'normal') gotoNode(run, node);
  s.startRun(run, `fxStart ${cls} ${node}`);
  return true;
}
dh.add({ fxTest: (o: Parameters<typeof fxTest>[0]) => fxTest(o), fxSetup, fxStart, fxStage: () => ({ ...STAGE, blocks: blockCount() }) });
