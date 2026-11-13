// Status animations on the bodies (UX_V3 §4: 「中毒冒绿泡、灼烧冒火、冻结冰壳、眩晕转星、虚弱发灰、易伤红裂纹」; user 11-14: 「再多补一些状态
// 动画」). Freeze (ice shell) and stun (orbiting stars) live in skillStage.ts; this module adds every other lasting state, for the
// enemies (their display statuses) and the hero (the display player): while a status is on, the body keeps showing it.
//   中毒  green bubbles rising off the body, a sick green tint that breathes
//   灼烧  small flames licking up from the lower body, sparks, an orange flicker
//   虚弱  grey drops falling off the shoulders, a dull grey tint
//   易伤  red-orange cracks flashing at random points of the body (a short spark cross)
//   狂暴  (hero) red embers streaming up, a red pulse
//   护甲  (hero) steel-blue glints climbing a ring at the feet
// Cheap: a handful of particles per second per body; nothing allocated per frame beyond the emits.
import * as THREE from 'three';
import { V3, R, TAU } from '../engine/world';
import { PADD, PALPHA, TILE } from '../engine/particles';
import { addBlock } from '../fx/blocks';
import type { BattleActor } from '../bestiary/battle';
import type { FoeDisp } from './hpDisplay';

interface PlayerLike { armor: number; barrier?: number; statuses: Array<{ type: string; value: number }> }
type Clock = Record<string, number>;
const clocks = new Map<BattleActor, Clock>();
const C = (h: number) => new THREE.Color(h);
const GREEN = C(0x8af070), GREEN_D = C(0x2a7a30), FIRE_Y = C(0xffe080), FIRE_R = C(0xff3a10), GREY = C(0xb8b0c8), RED = C(0xff6a3a), EMBER = C(0xff5a30), STEEL = C(0x9ad0ff);

/** every `period` s (jittered) → true; per body and per status */
function every(c: Clock, key: string, dt: number, period: number) {
  const t = (c[key] ?? R(0, period)) - dt;
  if (t > 0) { c[key] = t; return false; }
  c[key] = period * R(0.7, 1.3); return true;
}
/** a random point on the body's near side (feet at y = 0 of the root, up to `top`): the battle camera sits toward +z, and particles
 *  spawned inside the model are hidden by it (depth-tested) — so they start on the surface facing the lens */
function onBody(a: BattleActor, lo: number, hi: number, spread = 0.45) {
  const p = a.root.position, w = Math.max(0.5, a.width) * spread, W = Math.max(0.5, a.width);
  return V3(p.x + R(-w, w), p.y + a.top * R(lo, hi), p.z + W * R(0.35, 0.6));
}

function poison(a: BattleActor, c: Clock, dt: number) {
  if (every(c, 'po', dt, 0.11)) PALPHA.emit({ p: onBody(a, 0.3, 0.85), v: V3(R(-0.15, 0.15), R(0.6, 1.1), R(-0.05, 0.05)), s0: R(0.14, 0.22), s1: R(0.2, 0.3), life: R(0.8, 1.2), c0: GREEN, c1: GREEN_D, alpha: 0.95, tile: TILE.ring, drag: 0.4 });
  if (every(c, 'pc', dt, 0.3)) { const q = onBody(a, 0.25, 0.7); addBlock(q, { v: V3(R(-0.1, 0.1), R(0.5, 0.8), 0), size: R(0.08, 0.13), col: 0x7ae05a, bright: 1.7, life: R(0.6, 0.9), grow: 0.1, shrink: 0.3, spin: 2 }); }
  if (every(c, 'pd', dt, 0.5)) PADD.emit({ p: onBody(a, 0.5, 0.8, 0.3), v: V3(0, R(-1.4, -0.9), 0), s0: 0.1, s1: 0.05, life: 0.5, c0: GREEN, bright: 2, tile: TILE.streak, stretch: 0.2 });
  if (!a.act) a.tint(0x5aff3a, 0.2 + 0.1 * Math.sin(performance.now() / 260));
}
function burn(a: BattleActor, c: Clock, dt: number) {
  if (every(c, 'bu', dt, 0.035)) PADD.emit({ p: onBody(a, 0.0, 0.5, 0.45), v: V3(R(-0.2, 0.2), R(1.4, 2.6), 0), s0: R(0.24, 0.4), s1: 0.03, life: R(0.35, 0.55), c0: FIRE_Y, c1: FIRE_R, bright: 2.6, tile: TILE.glow, drag: 1.2, fadeIn: 0.04 });
  if (every(c, 'bc', dt, 0.12)) { const q = onBody(a, 0.0, 0.4, 0.45); addBlock(q, { v: V3(R(-0.15, 0.15), R(1.2, 2.0), 0), size: R(0.09, 0.15), col: Math.random() < 0.5 ? 0xffb030 : 0xff5a1a, bright: 2.2, life: R(0.35, 0.55), grow: 0.05, shrink: 0.4, drag: 0.6 }); }
  if (every(c, 'bs', dt, 0.18)) PADD.emit({ p: onBody(a, 0.3, 0.7), v: V3(R(-0.5, 0.5), R(1.5, 2.6), R(-0.3, 0.3)), s0: 0.05, s1: 0.02, life: R(0.5, 0.8), c0: FIRE_Y, c1: FIRE_R, bright: 2.4, tile: TILE.spark, grav: 1.5 });
  if (!a.act) a.tint(0xff7a20, 0.22 + 0.12 * Math.abs(Math.sin(performance.now() / 90)));
}
function weak(a: BattleActor, c: Clock, dt: number) {
  if (every(c, 'we', dt, 0.18)) PADD.emit({ p: onBody(a, 0.65, 0.95, 0.4), v: V3(0, R(-1.4, -0.8), 0), s0: 0.13, s1: 0.06, life: 0.6, c0: GREY, bright: 1.6, tile: TILE.streak, stretch: 0.3 });
  if (!a.act) a.tint(0x6a6478, 0.38);
}
function vulnerable(a: BattleActor, c: Clock, dt: number) {
  if (!a.act) a.tint(0xff4a2a, 0.12 + 0.1 * Math.abs(Math.sin(performance.now() / 300)));
  if (!every(c, 'vu', dt, 0.32)) return;
  const p = onBody(a, 0.3, 0.85, 0.35);
  for (let i = 0; i < 4; i++) { const ang = i * TAU / 4 + R(-0.2, 0.2); PADD.emit({ p: p.clone(), v: V3(Math.cos(ang) * 1.6, Math.sin(ang) * 1.6, 0), s0: 0.12, s1: 0.03, life: 0.26, c0: RED, bright: 2.6, tile: TILE.streak, stretch: 0.2, drag: 4 }); }
  PADD.emit({ p, s0: 0.42, s1: 0.06, life: 0.2, c0: RED, bright: 2.4, tile: TILE.flare });
}
function berserk(a: BattleActor, c: Clock, dt: number) {
  if (every(c, 'be', dt, 0.025)) PADD.emit({ p: onBody(a, 0.0, 0.95, 0.55), v: V3(R(-0.25, 0.25), R(1.0, 2.0), R(-0.1, 0.1)), s0: R(0.09, 0.15), s1: 0.01, life: R(0.5, 0.9), c0: EMBER, bright: 2.2, tile: TILE.spark, drag: 0.6 });
  if (!a.act) a.tint(0xff2a1a, 0.16 + 0.12 * Math.abs(Math.sin(performance.now() / 180)));
}
function armor(a: BattleActor, c: Clock, dt: number) {
  if (!every(c, 'ar', dt, 0.22)) return;
  const p = a.root.position, r = Math.max(0.5, a.width) * 0.55, ang = R(0, TAU);
  PADD.emit({ p: V3(p.x + Math.cos(ang) * r, p.y + 0.08, p.z + Math.sin(ang) * r * 0.6), v: V3(0, R(1.0, 1.6), 0), s0: 0.1, s1: 0.03, life: 0.55, c0: STEEL, bright: 2.4, tile: TILE.streak, stretch: 0.26 });
}

const LOOK: Record<string, (a: BattleActor, c: Clock, dt: number) => void> = { poison, burn, weak, vulnerable, berserk };

/** call every frame while a battle is up: foes with their display statuses, the hero with the display player */
export function tickStatusAuras(dt: number, foes: Map<number, BattleActor>, disp: Map<number, FoeDisp>, hero: BattleActor | null, pd: PlayerLike | null, on: boolean) {
  if (!on) { clocks.clear(); return; }
  const seen = new Set<BattleActor>();
  for (const [uid, a] of foes) {
    const d = disp.get(uid); if (!d || d.dying || d.gone || a.dead || !a.root.visible) continue;
    seen.add(a); const c = clocks.get(a) ?? {}; clocks.set(a, c);
    for (const s of d.statuses) if (s.value > 0 && LOOK[s.type]) LOOK[s.type](a, c, dt);
  }
  if (hero && pd && hero.root.visible && !hero.dead) {
    seen.add(hero); const c = clocks.get(hero) ?? {}; clocks.set(hero, c);
    for (const s of pd.statuses) if (s.value > 0 && LOOK[s.type]) LOOK[s.type](hero, c, dt);
    if (pd.armor > 0) armor(hero, c, dt);
  }
  for (const a of [...clocks.keys()]) if (!seen.has(a)) clocks.delete(a);
}
