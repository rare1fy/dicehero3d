// Bestiary models on the battlefield: one actor class that speaks the show's actor interface (actors/cast.ts) — the hero's whirlwind,
// dice toss, block, blood price, cheer and fall; the lich's summon, shield, speech and collapse; the summons' lunge, shriek and death.
// Attack / cast / hurt / roar come from BActor; everything else is posed here.
import * as THREE from 'three';
import { BActor } from './bactor';
import { ROSTER, type ModelDef } from './models';
import { CELL } from './kit';
import { Action, rot, mov, curve, snap, type Bone } from '../actors/rig';
import { V3, R } from '../engine/world';
import { PADD, TILE } from '../engine/particles';
import type { Cast } from '../actors/cast';
import { isGripHero } from './heroPose';

const TIP: Record<string, [number, number]> = { warrior: [17, -3], boss_lich_forest: [29, 0], lego_warrior: [9, -3], lego_lich: [19, 0], fig_warrior: [19, -3], fig_lich: [29, 0] };

export class BattleActor extends BActor {
  aim = 0; breath = 1; robeFire = 0; walkK = 0; running = false; private runK = 0;
  constructor(id: string | ModelDef) { super(typeof id === 'string' ? ROSTER.find(d => d.id === id)! : id); }
  weapon() {
    if (isGripHero(this.def.id)) return super.weapon();
    const t = TIP[this.def.id];
    if (t && this.bones.weapon) return this.bones.weapon.localToWorld(V3(0, t[1] * this.cy, t[0] * this.cx));
    return this.bones.handR ? this.bones.handR.localToWorld(V3(0, -2 * this.cy, this.cx)) : this.chest();
  }
  // hero
  spin(dist: number) { return this.play(new Action('spin', 1.05, 0.55, { dist })); }
  toss() { return this.play(new Action('toss', 0.5, 0.45)); }
  block() { return this.play(new Action('block', 0.6, 0.3)); }
  cheer() { return this.play(new Action('cheer', 1.6, 0.3)); }
  bleed() { return this.play(new Action('bleed', 0.65, 0.4)); }
  fall() { this.dead = true; return this.play(new Action('fall', 1.2, 0.6)); }
  setRunning(on: boolean) { this.running = on; }
  // lich
  summon() { return this.play(new Action('summon', 1.1, 0.55)); }
  shield() { return this.play(new Action('shield', 0.8, 0.45)); }
  talk(dur = 1.6) { return this.play(new Action('talk', Math.max(1.2, dur), 0.5)); }
  collapse() { this.dead = true; return this.play(new Action('collapse', 2.2, 0.5)); }
  // fx5 (FX_BRIEF): skill moves of the three heroes, posed in poseMove() on top of the shared grip stance (heroPose.ts untouched).
  // Defensive skills only ever use guard / chant; nothing here changes the feel of the existing actions.
  /** 铁壁 / 血战 guard: the axe raised crosswise overhead → a stomp into a deep braced stance (impact = the stomp) → held → back */
  guard(dur = 1.15, from = 0) { return this.play(new Action('guard', dur, 0.36, { from })); }
  /** 魔导 charge (释放 wind-up, 吟唱, 屏障): staff raised high, rising onto the toes, held (impact = fully raised) */
  chant(dur = 0.9, big = false) { return this.play(new Action('chant', dur, 0.3, { big })); }
  /** 释放: the same charge, held, then the staff is thrust at the enemy in one piece (impact = the thrust) */
  release(dur = 1.3, big = false) { return this.play(new Action('chant', dur, 0.77, { big, burst: true })); }
  /** a quick cast (小咒): the grip stance's raise-and-thrust, faster than cast() */
  quickCast(dur = 0.6) { return this.play(new Action('cast', dur, 0.6)); }
  /** 顺劈斩: wound up to the right, a horizontal sweep across (impact = mid-swing) */
  sweep(dist: number, dur = 0.95) { return this.play(new Action('sweep', dur, 0.5, { dist })); }
  /** 盾冲: head down, haft across the chest, charge into the target (impact = contact) */
  bash(dist: number, dur = 0.9) { return this.play(new Action('bash', dur, 0.48, { dist })); }
  /** 血战 终极: crouch, leap, axe overhead, slam down (impact = landing) */
  leap(dist: number, dur = 1.5) { return this.play(new Action('leap', dur, 0.56, { dist })); }
  /** 袖箭: the left hand cocks back and flicks a knife (impact = release) */
  throwKnife(dur = 0.5) { return this.play(new Action('throw', dur, 0.47)); }
  /** the rogue's double stab, faster with every strike of a combo (speed ≥ 1) */
  stab(dist: number, speed = 1) { return this.play(new Action('attack', 0.9 / Math.max(0.5, speed), 0.5, { dist })); }
  /** a short crouch (anticipation before a blink / dash; impact = lowest point) */
  crouch(dur = 0.22) { return this.play(new Action('crouch', dur, 0.8)); }
  // summons
  lunge(dist: number) { return this.attack(dist); }
  shriek() { return this.roar(); }
  dispose() { this.root.parent?.remove(this.root); }

  protected pose(dt: number) {
    super.pose(dt);
    const b = this.bones, t = this.t, a = this.act, k = a ? a.k : 0, n = a?.name;
    // running (intro) and the summons' lurching walk
    this.runK += ((this.running ? 1 : 0) - this.runK) * Math.min(1, dt * 8);
    const run = Math.max(this.runK, this.walkK * 0.7), ph = Math.sin(t * 11);
    if (run > 0.01 && (!a || n === 'talk')) {
      mov(b.hips, 0, Math.abs(ph) * 0.1 * run, 0); rot(b.spine, 0.22 * run, 0, 0); rot(b.legL, ph * 0.8 * run, 0, 0); rot(b.legR, -ph * 0.8 * run, 0, 0);
      rot(b.armL, -ph * 0.7 * run, 0, 0); rot(b.hat, -0.15 * run, 0, 0);
    }
    if (this.lowHp > 0) { rot(b.spine, 0.2 * this.lowHp, 0, 0); mov(b.hips, 0, -0.05 * this.lowHp, 0); }
    if (this.def.id === 'warrior' && this.aim > 0 && !a) { rot(b.armR, -0.2 * this.aim, 0, 0); rot(b.handR, 0.1 * this.aim, 0, 0); }
    // 三职业所有动作由共同的握持架势驱动，避免再叠加旧版肩肘和武器旋转。
    if (isGripHero(this.def.id)) { if (a && MOVES.has(n!)) this.poseMove(n!, k, a); this.applyWarp(); return; }
    // second phase: soul fire on the robe
    if (this.robeFire > 0) {
      for (const f of this.flashMats) { const k2 = this.robeFire * ((f.m as THREE.MeshStandardMaterial).isMeshStandardMaterial ? 0.3 : 1); f.base.setRGB(0.04 * k2, (0.28 + 0.1 * Math.sin(t * 11)) * k2, 0.14 * k2); }   // plastic takes a much lighter tint
      if (!this.dead && Math.random() < dt * 30 * this.robeFire) PADD.emit({ p: this.chest().add(V3(R(-0.7, 0.7), R(-1.2, 0.5), R(-0.5, 0.5))), v: V3(R(-0.2, 0.2), R(1, 2.2), R(-0.2, 0.2)), s0: 0.14, s1: 0.02, life: R(0.4, 0.8), c0: new THREE.Color(0xc0ffd8), c1: new THREE.Color(0x2aff8a), bright: 2.6, tile: TILE.glow });
    }
    if (!a) return;
    switch (n) {
      case 'spin': {   // whirlwind: two full turns with the weapon out at arm's length
        const d = (a.data.dist as number) || 0, s2 = curve(k, [[0, 0], [0.22, 0], [0.78, 1], [1, 1]]), out = curve(k, [[0, 0], [0.18, 1], [0.85, 1], [1, 0]]);
        this.off.z = curve(k, [[0, 0], [0.25, -0.1], [0.6, d], [0.8, d], [1, 0]]); b.hips.rotation.y += s2 * Math.PI * 4;
        rot(b.armR, 0.4 * out, 0, -1.35 * out); rot(b.foreR, 1.45 * out, 0, 0); rot(b.weapon, 0.4 * out, -0.5 * out, 0); rot(b.armL, 0, 0, 1.2 * out); mov(b.hips, 0, -0.15 * out, 0);
        break;
      }
      case 'toss': { const s = snap(k, [[0, 0], [0.35, -1], [0.5, 1], [1, 0]]); rot(b.armL, -1.5 * Math.max(0, s) + 0.7 * Math.max(0, -s), 0, 0.1); rot(b.spine, 0.15 * Math.max(0, s), -0.2 * s, 0); break; }
      case 'block': { const s = curve(k, [[0, 0], [0.2, 1], [0.7, 1], [1, 0]]); rot(b.armR, -0.7 * s, 0.3 * s, 0.5 * s); rot(b.weapon, 0.3 * s, 1.1 * s, 0); rot(b.armL, -1.2 * s, 0, -0.4 * s); rot(b.foreL, -0.9 * s, 0, 0); mov(b.hips, 0, -0.1 * s, 0); break; }
      case 'bleed': { const s = curve(k, [[0, 0], [0.3, 1], [0.65, 1], [1, 0]]); rot(b.armL, -1.3 * s, 0, -0.5 * s); rot(b.foreL, -0.6 * s, 0, 0); rot(b.armR, -0.4 * s, 0, 0.6 * s); rot(b.weapon, 0.6 * s, 0.8 * s, 0); rot(b.jaw, 0.4 * s, 0, 0); break; }
      case 'cheer': { const s = curve(k, [[0, 0], [0.2, 1], [1, 1]]), j = Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k); this.off.y += j * 0.5; rot(b.armR, -2.9 * s, 0, -0.3 * s); rot(b.foreR, 1.3 * s, 0, 0); rot(b.armL, -2.7 * s, 0, 0.4 * s); rot(b.jaw, 0.7 * s, 0, 0); break; }
      case 'fall': { const s = curve(k, [[0, 0], [0.6, 1], [1, 1]]); rot(b.hips, -1.35 * s, 0, 0.2 * s); mov(b.hips, 0, -0.3 * s, -0.3 * s); rot(b.armR, -0.6 * s, 0, -0.9 * s); rot(b.armL, -0.4 * s, 0, 0.9 * s); break; }
      case 'summon': { const up = curve(k, [[0, 0], [0.5, 1], [0.7, 1], [1, 0]]); rot(b.armL, -2.4 * up, 0, 0.4 * up); rot(b.armR, -1.9 * up, 0, -0.4 * up); rot(b.spine, -0.3 * up, 0, 0); rot(b.jaw, 0.5 * up, 0, 0); this.off.y += up * 0.4; break; }
      case 'shield': { const s = curve(k, [[0, 0], [0.4, 1], [0.8, 1], [1, 0]]); rot(b.armL, -1.3 * s, 0.6 * s, -0.6 * s); rot(b.armR, -0.8 * s, -0.5 * s, 0.6 * s); rot(b.spine, 0.2 * s, 0, 0); this.off.y -= 0.15 * s; break; }
      case 'talk': rot(b.jaw, Math.max(0, Math.sin(k * 40)) * 0.35, 0, 0); rot(b.armL, -0.4 * Math.sin(k * Math.PI), 0, 0); break;
      case 'collapse': { const s = curve(k, [[0, 0], [0.3, 0.3], [1, 1]]); rot(b.spine, 0.6 * s, 0, 0.2 * s); rot(b.neck, 0.5 * s, 0, 0); rot(b.jaw, 0.6, 0, 0); this.off.y -= 0.9 * s; rot(b.armL, 0.6 * s, 0, -0.4 * s); rot(b.armR, 0.4 * s, 0, 0.5 * s); break; }
    }
  }

  /** fx5: where the body is drawn while it is away from home (blink / dash), in world space; null = at home. `home` itself never
   *  moves, so the camera framing and everything anchored on home stay put while the rogue flickers round the battlefield. */
  warp: THREE.Vector3 | null = null;
  private applyWarp() {
    if (!this.warp) return;
    const f = this.fwd(), dx = this.warp.x - this.home.x, dz = this.warp.z - this.home.z;
    this.off.z += dx * f.x + dz * f.z; this.off.x += dx * f.z - dz * f.x;
  }
  /** turn to face p from wherever the body is drawn (home or warp) */
  faceFrom(p: THREE.Vector3) { const o = this.warp ?? this.home; this.yaw = Math.atan2(p.x - o.x, p.z - o.z); }

  /** fx5: the hero skill moves (see guard() …). Runs after poseHero(): adds to its stance, then re-aims the weapon with the wrist.
   *  Bone frame: +z forward, +x = the hero's left; armR/armL x < 0 raises the arm forward; wrist elevation 0 = weapon level forward,
   *  π/2 = straight up; yaw > 0 turns the weapon toward the hero's left (across the body for the right hand). */
  private poseMove(n: string, k: number, a: Action) {
    const b = this.bones, mage = this.def.id === 'mage', el0 = mage ? 1.62 : Math.PI / 4, yaw0 = mage ? -0.04 : -0.12, D = (a.data.dist as number | undefined) ?? 0.7;
    // a deeper stance without sliding the feet: thigh forward a, shin back 2a, foot a (hips drop ≈ 0.3 m per rad at this stance)
    const bend = (d: number) => { rot(b.legL, -d, 0, 0); rot(b.shinL, 2 * d, 0, 0); rot(b.footL, -d, 0, 0); rot(b.legR, -d * 0.8, 0, 0); rot(b.shinR, 1.6 * d, 0, 0); rot(b.footR, -d * 0.8, 0, 0); mov(b.hips, 0, -0.3 * d, 0); };
    switch (n) {
      case 'guard': {   // 铁壁: never steps toward the enemy
        const s = curve(k, [[0, 0], [0.22, 1], [0.84, 1], [1, 0]]);
        const hi = curve(k, [[0, 0], [0.2, 1], [0.32, 0], [1, 0]]), lo = curve(k, [[0, 0], [0.22, 0], [0.34, 1], [0.84, 1], [1, 0]]);
        const st = snap(k, [[0, 0], [0.3, 0], [0.37, 1], [0.6, 0.7], [0.84, 0.7], [1, 0]]), hop = curve(k, [[0, 0], [0.16, 0], [0.26, 1], [0.34, 0], [1, 0]]);
        // from > 0: the guard starts out where a blow left the body (血战: 斩 then 挡) and hops back home while raising the axe
        const back = (a.data.from as number) || 0, ret = back ? curve(k, [[0, 0], [0.26, 1]]) : 1;
        this.off.y += 0.16 * hop + (back ? 0.25 * Math.sin(Math.PI * ret) : 0); this.off.z = back * (1 - ret) - 0.1 * st;
        bend(0.55 * st);
        rot(b.spine, 0.16 * st - 0.14 * hi, 0, 0); rot(b.neck, -0.12 * st + 0.08 * hi, 0, 0);
        // the hold stays high (a horizontal bar just over the helm): from the battle camera, behind and above, it reads at once
        rot(b.armR, -2.6 * hi - 2.05 * lo, 0, -0.3 * s); rot(b.foreR, 0.95 * hi + 0.75 * lo, 0, 0);
        rot(b.armL, -2.6 * hi - 2.05 * lo, 0, 0.35 * s); rot(b.foreL, 0.95 * hi + 0.7 * lo, 0, 0);
        wrist(b, 'R', lerp(el0, 0.02, s), lerp(yaw0, 1.52, s));
        break;
      }
      case 'chant': {   // staff high, free hand open, rising a little: charge / chant / barrier; burst = 释放 (thrust at the end)
        const burst = !!a.data.burst, m = a.data.big ? 1.25 : 1;
        const s = burst ? curve(k, [[0, 0], [0.28, 1], [0.72, 1], [0.8, 0.35], [1, 0]]) : curve(k, [[0, 0], [0.3, 1], [0.86, 1], [1, 0]]);
        const th = burst ? snap(k, [[0, 0], [0.71, 0], [0.79, 1], [0.9, 1], [1, 0]]) : 0;
        this.off.y += (0.1 + (a.data.big ? 0.14 : 0)) * s + Math.sin(this.t * 7) * 0.025 * s;
        rot(b.spine, -0.14 * s * m + 0.16 * th, 0, 0); rot(b.neck, -0.16 * s * m, 0, 0);
        rot(b.armR, -1.2 * s * m - 0.9 * th, 0, -0.12 * s); rot(b.foreR, 0.65 * s + 0.7 * th, 0, 0);
        rot(b.armL, -1.05 * s - 0.6 * th, 0, 0.5 * s); rot(b.foreL, 0.35 * s + 0.4 * th, 0, 0);
        if (th > 0) bend(0.25 * th);
        wrist(b, 'R', lerp(mage ? el0 : lerp(el0, 1.45, s), 0.55, th), yaw0);   // the staff stays upright while lifted, then points at the enemy
        break;
      }
      case 'sweep': {   // 顺劈斩: wind to the right, sweep across to the left
        const wind = curve(k, [[0, 0], [0.34, 1], [0.44, 0], [1, 0]]), sw = snap(k, [[0, 0], [0.4, 0], [0.56, 1], [0.8, 1], [1, 0]]);
        const w = Math.max(wind, sw);
        this.off.z = curve(k, [[0, 0], [0.34, -0.12], [0.52, D], [0.8, D], [1, 0]]);
        rot(b.spine, 0.12 * sw, -0.32 * wind + 0.32 * sw, 0); rot(b.chest, 0, -0.14 * wind + 0.14 * sw, 0);
        rot(b.armR, -1.05 * w, 0, -0.55 * wind + 0.15 * sw); rot(b.foreR, 0.75 * w, 0, 0);
        rot(b.armL, -0.9 * w, 0, 0.2 * sw); rot(b.foreL, 0.5 * w, 0, 0);
        rot(b.legL, -0.3 * sw, 0, 0); rot(b.legR, 0.22 * sw, 0, 0);
        wrist(b, 'R', lerp(el0, 0.28, w), lerp(yaw0, -1.9 * wind + 1.35 * sw, w));
        break;
      }
      case 'bash': {   // 盾冲: haft across the chest, head down, charge
        const lean = curve(k, [[0, 0], [0.22, 1], [0.66, 1], [1, 0]]), run = curve(k, [[0, 0], [0.22, 0], [0.28, 1], [0.46, 1], [0.5, 0], [1, 0]]);
        this.off.z = curve(k, [[0, 0], [0.24, -0.25], [0.48, D], [0.62, D - 0.35], [1, 0]]);
        this.off.y += Math.abs(Math.sin(k * 44)) * 0.08 * run;
        rot(b.spine, 0.5 * lean, -0.2 * lean, 0); rot(b.neck, -0.35 * lean, 0, 0);
        rot(b.armR, -1.15 * lean, 0, -0.1 * lean); rot(b.foreR, 0.35 * lean, 0, 0);
        rot(b.armL, -1.15 * lean, 0, 0.1 * lean); rot(b.foreL, 0.35 * lean, 0, 0);
        rot(b.legL, -0.8 * Math.sin(k * 44) * run, 0, 0); rot(b.legR, 0.8 * Math.sin(k * 44) * run, 0, 0);
        wrist(b, 'R', lerp(el0, 0.12, lean), lerp(yaw0, 1.45, lean));
        break;
      }
      case 'leap': {   // 血战 终极: crouch, jump, axe back over the head, slam
        const cr = curve(k, [[0, 0], [0.1, 1], [0.17, 0], [0.55, 0], [0.62, 1], [0.84, 0.7], [1, 0]]);
        this.off.z = curve(k, [[0, 0], [0.12, -0.1], [0.56, D], [0.84, D], [1, 0]]);
        this.off.y += curve(k, [[0, 0], [0.13, 0], [0.36, 2.2], [0.5, 1.4], [0.56, 0], [1, 0]]);
        const up = curve(k, [[0, 0], [0.14, 0], [0.3, 1], [0.5, 1], [0.56, 0], [1, 0]]), slam = snap(k, [[0, 0], [0.5, 0], [0.57, 1], [0.84, 1], [1, 0]]);
        bend(0.6 * cr);
        rot(b.spine, -0.3 * up + 0.45 * slam, 0, 0);
        rot(b.armR, -2.6 * up - 1.0 * slam, 0, 0); rot(b.foreR, 0.9 * up + 0.6 * slam, 0, 0);
        rot(b.armL, -2.5 * up - 1.0 * slam, 0, 0); rot(b.foreL, 0.9 * up + 0.5 * slam, 0, 0);
        wrist(b, 'R', el0 + (2.3 - el0) * up + (-0.45 - el0) * slam * (1 - up), yaw0);
        break;
      }
      case 'throw': {   // 袖箭: left hand cocks back, flicks forward
        const cock = curve(k, [[0, 0], [0.34, 1], [0.46, 0], [1, 0]]), fl = snap(k, [[0, 0], [0.4, 0], [0.52, 1], [0.72, 1], [1, 0]]);
        rot(b.spine, 0, 0.35 * cock - 0.3 * fl, 0);
        rot(b.armL, 0.5 * cock - 1.3 * fl, 0, 0.35 * cock); rot(b.foreL, -0.9 * cock + 0.95 * fl, 0, 0);
        wrist(b, 'L', Math.PI / 4 + (1.3 - Math.PI / 4) * cock + (0.05 - Math.PI / 4) * fl, 0.16);
        break;
      }
      case 'crouch': {
        const s = curve(k, [[0, 0], [0.8, 1], [1, 1]]);
        bend(0.5 * s); rot(b.spine, 0.25 * s, 0, 0);
        break;
      }
    }
  }
}

const MOVES = new Set(['guard', 'chant', 'sweep', 'bash', 'leap', 'throw', 'crouch']);
const lerp = (x: number, y: number, k: number) => x + (y - x) * k;
const _pq = new THREE.Quaternion(), _tq = new THREE.Quaternion(), _te = new THREE.Euler();
/** the weapon's direction through the wrist (same constraint as heroPose.ts: the fist never leaves the grip) */
function wrist(b: Record<string, Bone>, side: 'R' | 'L', elevation: number, yaw = 0, roll = 0) {
  const hand = b[`hand${side}`]; if (!hand) return;
  _pq.identity();
  for (let p = hand.parent; p && p !== b.root; p = p.parent) _pq.premultiply(p.quaternion);
  _tq.setFromEuler(_te.set(-elevation, yaw, roll, 'YXZ'));
  hand.quaternion.copy(_pq.invert().multiply(_tq));
}

/** the battle cast from the bestiary: 嗜血狂战, 枯骨巫妖, 食尸鬼 */
export const bestiaryCast = (): Cast => ({ hero: () => new BattleActor('warrior'), lich: () => new BattleActor('boss_lich_forest'), ghoul: () => new BattleActor('forest_ghoul') });
