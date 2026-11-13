// Enemy spell looks (fx5 audit §4: 「首领法术改走 stageFoeSpell（骸骨之矛 = 骨刺直射，亡灵风暴 = 天降）」; user 11-14: 「再多补一些…技能特效」).
// Picked by the action's description; anything unnamed keeps a coloured orb, now by kind: poison green, curse violet, weak grey,
// vulnerable red, plain spell green. Resolves at the impact (the hit numbers come from the engine events after it).
import * as THREE from 'three';
import { V3, R, TAU } from '../engine/world';
import { animP, ease, shake } from '../engine/clock';
import { PADD, PALPHA, TILE } from '../engine/particles';
import { ringFx, lightPulse } from '../engine/prims';
import { addBlock, release, fling, type Blk } from './blocks';
import { fxGlow, fxSparks, fxSmoke, fxFlare, fxImpact, trailSeg } from './fx';
import { cue } from '../../audio/cues';

const C = (h: number) => new THREE.Color(h);
const BONE = 0xe8e0c8, BONE_D = 0x9a9078, SOUL = 0x6aff9a, CURSE = 0xb070ff;

/** a bone spear: a long bone block (shaft + head) shot straight at the hero, a soul-green trail; splinters on impact */
async function boneSpear(from: THREE.Vector3, to: THREE.Vector3) {
  const d = to.clone().sub(from), dn = d.clone().normalize(), yaw = Math.atan2(dn.x, dn.z), pitch = -Math.asin(Math.max(-1, Math.min(1, dn.y)));
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  fxGlow(from, SOUL, 1.4, 0.3, 2); cue('whoosh', 0.8);
  const parts: Blk[] = [addBlock(from, { size: [0.1, 0.1, 0.9], col: BONE, bright: 1, glow: false, hold: true, grow: 0.05 }), addBlock(from, { size: [0.18, 0.18, 0.24], col: BONE_D, bright: 1, glow: false, hold: true, grow: 0.05 })];
  for (const p of parts) p.q.copy(q);
  let last = from.clone();
  await animP(0.22, k => {
    const p = from.clone().addScaledVector(d, k);
    parts[0].p.copy(p); parts[1].p.copy(p).addScaledVector(dn, 0.42);
    trailSeg(last, p, SOUL, 0.14, { life: 0.25, bright: 2.4, spark: 0.4 }); last = p;
  });
  for (const p of parts) fling(p, V3(R(-2, 2), R(2, 4), R(-2, 2)), { grav: 16, life: 0.6, spin: 12 });
  for (let i = 0; i < 6; i++) addBlock(to.clone(), { v: V3(R(-3, 3), R(1, 4), R(-3, 3)), size: R(0.05, 0.1), col: BONE, glow: false, life: 0.6, grav: 14, spin: 10, floor: 0.05 });
  fxImpact(to, SOUL, 1.2, { dir: dn }); shake(0.25);
}
/** an undead storm: soul wisps swirl up above the hero, then crash down in a ring of green fire */
async function undeadStorm(caster: THREE.Vector3, at: THREE.Vector3) {
  const sky = V3(at.x, at.y + 3.2, at.z);
  fxGlow(caster, SOUL, 2, 0.5, 2.4); cue('magic', 0.9);
  ringFx(V3(at.x, 0.05, at.z), { color: SOUL, radius: 1.8, r0: 0.4, life: 0.8, width: 0.14, fill: 0.2, bright: 1.6 });
  await animP(0.5, k => {
    for (let i = 0; i < 3; i++) { const a = k * TAU * 2 + i * TAU / 3, r = 1.4 * (1 - k * 0.5); PADD.emit({ p: V3(sky.x + Math.cos(a) * r, sky.y + R(-0.2, 0.2), sky.z + Math.sin(a) * r * 0.6), s0: 0.3, s1: 0.05, life: 0.3, c0: C(0xd0ffe0), c1: C(SOUL), bright: 2.6, tile: TILE.glow }); }
  });
  // the fall: six soul shards drop onto the hero in quick succession
  for (let i = 0; i < 6; i++) {
    const p0 = sky.clone().add(V3(R(-1, 1), 0, R(-0.6, 0.6))), p1 = at.clone().add(V3(R(-0.5, 0.5), -0.6, R(-0.3, 0.3)));
    const b = addBlock(p0, { size: [0.14, 0.4, 0.14], col: SOUL, bright: 2, hold: true, grow: 0.03 });
    void animP(0.16, k => { b.p.copy(p0).lerp(p1, ease.inCubic(k)); }).then(() => { release(b, 0.05); fxSparks(p1, SOUL, 6, 3, { life: 0.3 }); });
    await animP(0.05, () => {});
  }
  await animP(0.12, () => {});
  fxFlare(at, 0xc0ffd0, 2.2, 0.25); lightPulse(at.clone().add(V3(0, 0.5, 0.6)), SOUL, 3, 0.4, 8);
  for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; PADD.emit({ p: V3(at.x, 0.1, at.z), v: V3(Math.cos(a) * R(2.5, 4), R(0.4, 1.6), Math.sin(a) * R(2.5, 4)), s0: 0.3, s1: 0.04, life: R(0.3, 0.5), c0: C(0xe0ffe8), c1: C(SOUL), bright: 2.6, tile: TILE.glow, drag: 2 }); }
  fxSmoke(V3(at.x, 0.1, at.z), 0x1e3a2a, 6, { r: 0.6, s: 0.5, alpha: 0.5, up: 1.0 }); shake(0.4);
}
/** a coloured orb with a voxel core and a sparkling trail (poison / curse / weak / vulnerable / plain spells) */
async function orb(from: THREE.Vector3, to: THREE.Vector3, col: number, arc = 1.6) {
  const core = addBlock(from, { size: 0.2, col, bright: 2, hold: true, grow: 0.06, spin: 8 }), mid = from.clone().lerp(to, 0.5).add(V3(0, arc, 0));
  let last = from.clone(); cue('magic', 0.6);
  await animP(0.42, k => {
    const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k, p = V3(from.x * a + mid.x * b + to.x * c, from.y * a + mid.y * b + to.y * c, from.z * a + mid.z * b + to.z * c);
    core.p.copy(p); trailSeg(last, p, col, 0.16, { life: 0.3, bright: 2.2, spark: 0.5 }); last = p;
    if (Math.random() < 0.5) PALPHA.emit({ p: p.clone(), v: V3(R(-0.2, 0.2), R(-0.4, 0.1), R(-0.2, 0.2)), s0: 0.1, s1: 0.16, life: 0.5, c0: C(col), alpha: 0.7, tile: TILE.ring });
  });
  release(core, 0.05); fxImpact(to, col, 0.9, { ground: false, stop: false });
}

/** the look of an enemy's spell (desc = the action's description) */
export async function foeSpell(desc: string | undefined, kind: string, caster: THREE.Vector3, at: THREE.Vector3, ground: THREE.Vector3) {
  const t = desc || '';
  if (/骸骨|骨矛|骨刺/.test(t)) return boneSpear(caster, at);
  if (/亡灵风暴|风暴|亡灵/.test(t)) return undeadStorm(caster, ground.clone().setY(at.y));
  if (/毒/.test(t)) return orb(caster, at, 0x7aff4a);
  if (/虚弱/.test(t)) return orb(caster, at, 0xb8b0c8);
  if (/易伤|碎裂/.test(t)) return orb(caster, at, 0xff6a3a);
  if (kind === 'curse' || /诅咒/.test(t)) return orb(caster, at, CURSE);
  return orb(caster, at, kind === 'attack' ? SOUL : CURSE);
}

/** 反噬 (mage backlash) gained: violet-black cracks burst on the hero's chest and a dark violet shock at the feet */
export function backlashBurst(chest: THREE.Vector3, feet: THREE.Vector3, stacks: number) {
  const k = Math.min(1.6, 0.6 + stacks * 0.25);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + R(-0.3, 0.3); PADD.emit({ p: chest.clone(), v: V3(Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0.4), s0: 0.12 * k, s1: 0.02, life: 0.28, c0: C(0xe0a0ff), c1: C(0x4a1a6a), bright: 2.6, tile: TILE.streak, stretch: 0.22, drag: 5 }); }
  for (let i = 0; i < 4; i++) addBlock(chest.clone().add(V3(R(-0.3, 0.3), R(-0.3, 0.3), 0.3)), { v: V3(R(-1.5, 1.5), R(0.5, 2), R(0.2, 1)), size: R(0.06, 0.11), col: 0x2a0a3a, glow: false, life: 0.6, grav: 10, spin: 8, floor: 0.05 });
  fxGlow(chest, 0x9a40ff, 1.6 * k, 0.35, 2.2);
  ringFx(V3(feet.x, 0.05, feet.z), { color: 0x8a3aff, radius: 1.1 * k + 0.4, r0: 0.3, life: 0.4, width: 0.14, fill: 0.15, bright: 1.6 });
  cue('curse', 0.4 + stacks * 0.1);
}
