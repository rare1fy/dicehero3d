// Bestiary models on the battlefield: one actor class that speaks the show's actor interface (actors/cast.ts) — the hero's whirlwind,
// dice toss, block, blood price, cheer and fall; the lich's summon, shield, speech and collapse; the summons' lunge, shriek and death.
// Attack / cast / hurt / roar come from BActor; everything else is posed here.
import * as THREE from 'three';
import { BActor } from './bactor';
import { ROSTER } from './models';
import { CELL } from './kit';
import { Action, rot, mov, curve, snap } from '../actors/rig';
import { V3, R } from '../engine/world';
import { PADD, TILE } from '../engine/particles';
import type { Cast } from '../actors/cast';

const TIP: Record<string, [number, number]> = { warrior: [17, -3], boss_lich_forest: [29, 0] };

export class BattleActor extends BActor {
  aim = 0; breath = 1; robeFire = 0; walkK = 0; running = false; private runK = 0;
  constructor(id: string) { super(ROSTER.find(d => d.id === id)!); }
  weapon() {
    const t = TIP[this.def.id];
    if (t && this.bones.weapon) return this.bones.weapon.localToWorld(V3(0, t[1] * CELL, t[0] * CELL));
    return this.bones.handR ? this.bones.handR.localToWorld(V3(0, -2 * CELL, CELL)) : this.chest();
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
    if (this.def.id === 'warrior' && this.aim > 0 && !a) { rot(b.armR, -0.5 * this.aim, 0, 0); rot(b.weapon, -0.4 * this.aim, 0, 0); }
    // second phase: soul fire on the robe
    if (this.robeFire > 0) {
      for (const f of this.flashMats) f.base.setRGB(0.04 * this.robeFire, (0.28 + 0.1 * Math.sin(t * 11)) * this.robeFire, 0.14 * this.robeFire);
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
}

/** the battle cast from the bestiary: 嗜血狂战, 枯骨巫妖, 食尸鬼 */
export const bestiaryCast = (): Cast => ({ hero: () => new BattleActor('warrior'), lich: () => new BattleActor('boss_lich_forest'), ghoul: () => new BattleActor('forest_ghoul') });
