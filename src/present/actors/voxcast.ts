// The original chunky-voxel cast (look/voxkit.ts): 嗜血狂战, 枯骨巫妖, 食尸鬼. Each is one statue authored in cells, split into parts
// that hang on joints; all motion is procedural (springs + keyed curves), so timing and hit frames stay under our control.
// Front is +z; the hero's weapon hand is −x. Public surface = actors/cast.ts.
import * as THREE from 'three';
import { Actor } from './actor';
import { Action, rot, mov, curve, snap } from './rig';
import { VoxChar } from '../look/voxkit';
import { V3, R } from '../engine/world';
import { PADD, TILE } from '../engine/particles';
import type { Cast } from './cast';

// shared palette
const DARK = 0x1a1220, WHITE = 0xfff6e8, GOLD = 0xffc640, GOLD_D = 0xc88a24, IRON = 0x8e909e, IRON_D = 0x5a5c6a, EDGE = 0xe4e8f0;
const LEATH = 0x7a4a2a, LEATH_D = 0x4a2c18, WOOD = 0x8a5a32, WOOD_D = 0x5e3a20, BONE = 0xeee2c4, BONE_D = 0xc4b48e;

/** common shell: bones from the voxel build, head/chest anchors in cells */
abstract class VActor extends Actor {
  constructor(protected s: number, build: VoxChar, o: { glow?: number; jitter?: number; self?: number } = {}) {
    super();
    const r = build.build({ glow: o.glow ?? 2.8, jitter: o.jitter ?? 0.05, self: o.self });
    this.body.add(r.root); this.bones = r.bones; this.finish(r.meshes);
  }
}

// ================================================================== 嗜血狂战
const H = { SKIN: 0xe8a878, SKIN_D: 0xc07c52, HAIR: 0xff5a1e, HAIR_D: 0xb8300e, HAIR_Y: 0xffc23a, BEARD: 0x8a3418, BEARD_D: 0x5e2010, PAINT: 0x2a3c8a, BLOOD: 0xc8141e, KILT: 0x4a3a6a, KILT_D: 0x30244a, PANTS: 0x5a4636, FUR: 0xe8dcc0, FUR_D: 0xb8a684 };
function heroModel(s: number) {
  const v = new VoxChar(s);
  v.bone('hips', 'root', 0, 3, 0).bone('spine', 'hips', 0, 4, 0).bone('chest', 'spine', 0, 5, 0).bone('neck', 'chest', 0, 9, 0).bone('head', 'neck', 0, 9, 0).bone('jaw', 'head', 0, 10, 1)
    .bone('hair', 'head', 0, 14, 0)
    .bone('shL', 'chest', 5.5, 8, 0.5).bone('armL', 'shL', 5.5, 8, 0.5).bone('foreL', 'armL', 5.5, 6, 0.5).bone('handL', 'foreL', 5.5, 4, 0.5)
    .bone('shR', 'chest', -5.5, 8, 0.5).bone('armR', 'shR', -5.5, 8, 0.5).bone('foreR', 'armR', -5.5, 6, 0.5).bone('handR', 'foreR', -5.5, 4, 0.5).bone('weapon', 'handR', -5.5, 3.5, 0.5)
    .bone('legL', 'hips', 2.5, 3, 0).bone('footL', 'legL', 2.5, 1, 0).bone('legR', 'hips', -2.5, 3, 0).bone('footR', 'legR', -2.5, 1, 0);
  // legs: trousers, fur-cuffed boots
  for (const sx of [1, -1]) {
    const x0 = sx > 0 ? 1 : -4, x1 = sx > 0 ? 3 : -2, L = sx > 0 ? 'L' : 'R';
    v.part('leg' + L).box(x0, 1, -1, x1, 2, 0, H.PANTS).box(x0, 2, -1, x1, 2, 0, H.FUR);
    v.part('foot' + L).box(x0, 0, -1, x1, 0, 1, LEATH_D);
  }
  // hips: kilt with a front flap, spine: belt with a gold buckle
  v.part('hips').box(-4, 3, -2, 3, 3, 1, H.KILT).box(-1, 1, 2, 0, 3, 2, H.KILT_D).box(-1, 1, -3, 0, 3, -3, H.KILT_D).paint(c => (c.x === -4 || c.x === 3) && c.y === 3 ? H.KILT_D : null, 'hips');
  v.part('spine').box(-4, 4, -2, 3, 4, 1, LEATH_D).box(-1, 4, 2, 0, 4, 2, GOLD);
  // chest: V-shaped torso, pec and ab lines, a strap across, a scar
  v.part('chest').box(-4, 5, -2, 3, 6, 1, H.SKIN).box(-5, 7, -2, 4, 8, 1, H.SKIN);
  v.paint(c => c.z === 1 && c.y === 7 && Math.abs(c.x + 0.5) > 1 && Math.abs(c.x + 0.5) < 4 ? H.SKIN_D : null, 'chest');
  v.paint(c => c.z === 1 && c.y === 5 && (c.x === -1 || c.x === 0) ? H.SKIN_D : null, 'chest');
  for (let i = 0; i <= 8; i++) { const x = 4 - i, y = 8 - Math.round((i * 3) / 8); v.part('chest').set(x, y, 1, LEATH); v.set(x, y, -2, LEATH); }
  v.set(-3, 6, 1, H.BLOOD).set(-2, 5, 1, H.BLOOD);
  // fur mantle on the left shoulder with a bone horn
  v.part('shL').box(4, 8, -2, 7, 9, 1, H.FUR).box(5, 9, -2, 7, 9, 1, H.FUR_D).set(6, 10, -1, BONE).set(6, 11, -1, BONE_D);
  v.part('shR').box(-8, 8, -1, -5, 8, 0, IRON_D).set(-7, 8, 1, IRON);
  // arms: thick, with iron bracers and big fists
  for (const sx of [1, -1]) {
    const x0 = sx > 0 ? 4 : -7, x1 = sx > 0 ? 6 : -5, L = sx > 0 ? 'L' : 'R';
    v.part('arm' + L).box(x0, 6, -1, x1, 7, 1, H.SKIN);
    v.part('fore' + L).box(x0, 4, -1, x1, 5, 1, H.SKIN).box(x0, 4, -1, x1, 4, 1, IRON_D).set(sx > 0 ? 5 : -6, 4, 2, IRON);
    v.part('hand' + L).box(x0, 2, -1, x1, 3, 1, H.SKIN).box(x0, 2, 1, x1, 2, 1, H.SKIN_D);
  }
  // head: big and square, shaved sides, two fierce eyes under angry brows, a woad stripe across them
  v.part('head').box(-4, 9, -2, 3, 13, 2, H.SKIN);
  v.paint(c => (c.y >= 12 && Math.abs(c.x + 0.5) > 2.5 && c.z < 2) ? H.SKIN_D : null, 'head');
  v.symBox(1, 11, 2, 2, 12, 2, WHITE).sym(1, 11, 2, DARK).symBox(1, 13, 2, 3, 13, 2, H.HAIR_D).sym(1, 12, 2, H.HAIR_D);
  v.sym(3, 11, 2, H.PAINT).sym(3, 12, 2, H.PAINT).sym(0, 12, 2, H.PAINT);
  v.box(-1, 11, 3, 0, 11, 3, H.SKIN_D);
  v.sym(4, 11, 0, H.SKIN).sym(4, 12, 0, H.SKIN).sym(4, 11, -1, H.SKIN_D);
  // jaw: a braided auburn beard around a grim mouth
  v.part('jaw').box(-3, 9, 2, 2, 10, 3, H.BEARD).box(-2, 7, 2, 1, 8, 3, H.BEARD).box(-1, 5, 3, 0, 6, 3, H.BEARD_D).set(-1, 6, 4, GOLD).set(0, 6, 4, GOLD)
    .box(-1, 10, 3, 0, 10, 3, DARK).symBox(3, 9, 1, 3, 10, 2, H.BEARD);
  // flame mohawk, hot at the tips
  v.part('hair').box(-1, 14, -2, 0, 15, 2, H.HAIR).box(-1, 16, -1, 0, 16, 1, H.HAIR_Y).box(-1, 15, 2, 0, 15, 2, H.HAIR_Y).box(-1, 10, -3, 0, 13, -3, H.HAIR_D);
  // the great cleaver-axe, haft through the right fist along +z, blade hanging below the haft
  v.part('weapon').line(-6, 3, -3, -6, 3, 12, WOOD).box(-6, 3, -1, -6, 3, 1, LEATH).set(-6, 3, -3, GOLD).set(-6, 3, -4, GOLD_D);
  v.box(-6, -3, 7, -6, 2, 12, IRON_D).box(-6, -3, 12, -6, 2, 12, EDGE).box(-6, -3, 7, -6, -3, 12, EDGE).box(-6, 4, 9, -6, 5, 10, IRON).set(-6, 6, 10, EDGE);
  v.box(-7, -1, 8, -7, 1, 10, IRON).box(-5, -1, 8, -5, 1, 10, IRON).set(-7, 0, 9, GOLD).set(-5, 0, 9, GOLD).set(-6, -2, 11, H.BLOOD).set(-6, -1, 11, H.BLOOD).set(-6, -2, 10, H.BLOOD);
  return v;
}

export class VHero extends VActor {
  readonly height = 2.25;
  aim = 0; breath = 1; running = false; private runK = 0;
  constructor() { super(0.14, heroModel(0.14)); }
  weapon() { return this.bones.weapon.localToWorld(V3(0, -3.5 * this.s, 10 * this.s)); }
  head() { return this.bones.head.localToWorld(V3(0, 7 * this.s, 0)); }
  chest() { return this.bones.chest.localToWorld(V3(0, 2 * this.s, 1.5 * this.s)); }
  attack(dist: number) { return this.play(new Action('attack', 0.95, 0.52, { dist })); }
  spin(dist: number) { return this.play(new Action('spin', 1.05, 0.55, { dist })); }
  toss() { return this.play(new Action('toss', 0.5, 0.45)); }
  hurt(power = 1) { this.hit(power); return this.play(new Action('hurt', 0.45, 0.1, { power })); }
  block() { return this.play(new Action('block', 0.6, 0.3)); }
  cheer() { return this.play(new Action('cheer', 1.6, 0.3)); }
  bleed() { return this.play(new Action('bleed', 0.65, 0.4)); }
  fall() { this.dead = true; return this.play(new Action('fall', 1.2, 0.6)); }
  setRunning(on: boolean) { this.running = on; }

  protected pose(dt: number) {
    const b = this.bones, t = this.t, a = this.act, k = a ? a.k : 0, n = a?.name;
    this.runK += ((this.running ? 1 : 0) - this.runK) * Math.min(1, dt * 8);
    const br = Math.sin(t * 2.4 * this.breath), low = this.lowHp, run = this.runK, ph = Math.sin(t * 11);
    // idle: a heavy, breathing stance with the cleaver on the right shoulder; run: pumping arms, big strides
    mov(b.hips, 0, br * 0.02 - low * 0.08 + Math.abs(ph) * 0.12 * run, 0); rot(b.hips, 0, Math.sin(t * 0.7) * 0.06 * (1 - run), 0);
    rot(b.spine, 0.05 + low * 0.25 + br * 0.03 + run * 0.25, 0, 0); rot(b.chest, br * 0.03, ph * 0.1 * run, 0);
    rot(b.neck, -0.05 - low * 0.12 - run * 0.15, Math.sin(t * 0.5) * 0.12 * (1 - run), 0); rot(b.head, Math.sin(t * 1.1) * 0.04, 0, Math.sin(t * 0.9) * 0.05);
    rot(b.jaw, 0.04 + low * 0.25 * (0.5 + 0.5 * Math.sin(t * 6)), 0, 0); rot(b.hair, Math.sin(t * 5) * 0.05 - run * 0.2, 0, 0);
    rot(b.shL, 0, 0, 0.12); rot(b.armL, 0.1 + br * 0.05 - ph * 0.9 * run, 0, 0.18); rot(b.foreL, -0.35 - run * 0.8, 0, 0);
    const aim = this.aim;
    rot(b.armR, -0.45 - aim * 0.5 + ph * 0.3 * run, 0, -0.12); rot(b.foreR, -1.45 + aim * 0.2, 0, 0); rot(b.weapon, -0.45 - aim * 0.6, 0, 0);
    rot(b.legL, ph * 0.85 * run, 0, 0.05); rot(b.legR, -ph * 0.85 * run, 0, -0.05); rot(b.footL, -Math.max(0, ph) * 0.4 * run, 0, 0); rot(b.footR, -Math.max(0, -ph) * 0.4 * run, 0, 0);
    this.off.set(0, 0, 0);
    if (!a) return;
    switch (n) {
      case 'attack': {   // wind-up (axe swung back over the head) → leap → overhead chop into the ground → recover
        const d = (a.data.dist as number) || 0;
        const wind = curve(k, [[0, 0], [0.3, 1], [0.46, 1], [0.54, 0], [1, 0]]), chop = snap(k, [[0, 0], [0.44, 0], [0.54, 1], [0.76, 1], [1, 0]]);
        this.off.z = curve(k, [[0, 0], [0.3, -0.2], [0.52, d], [0.74, d], [1, 0]]);
        this.off.y = curve(k, [[0, 0], [0.3, 0], [0.41, 0.6], [0.52, 0], [1, 0]]);
        rot(b.spine, -0.35 * wind + 0.32 * chop, 0, 0); rot(b.chest, -0.15 * wind + 0.12 * chop, 0.25 * wind, 0);
        rot(b.armR, -2.75 * wind + 0.15 * chop, 0, 0.15 * wind); rot(b.foreR, 0.75 * wind + 1.5 * chop, 0, 0); rot(b.weapon, 0.1 * wind + 1.35 * chop, 0, 0);
        rot(b.armL, -2.0 * wind - 0.6 * chop, 0, -0.1); rot(b.foreL, 0.2 * wind, 0, 0); rot(b.jaw, 0.45 * (wind + chop), 0, 0);
        rot(b.legL, -0.5 * chop + 0.25 * wind, 0, 0); rot(b.legR, 0.45 * chop - 0.25 * wind, 0, 0); mov(b.hips, 0, -0.1 * chop, 0);
        break;
      }
      case 'spin': {     // whirlwind: crouch, two full turns with the cleaver out at arm's length, plant
        const d = (a.data.dist as number) || 0, s2 = curve(k, [[0, 0], [0.22, 0], [0.78, 1], [1, 1]]), out = curve(k, [[0, 0], [0.18, 1], [0.85, 1], [1, 0]]);
        this.off.z = curve(k, [[0, 0], [0.25, -0.1], [0.6, d], [0.8, d], [1, 0]]);
        b.hips.rotation.y += s2 * Math.PI * 4;
        rot(b.armR, 0.4 * out, 0, -1.35 * out); rot(b.foreR, 1.45 * out, 0, 0); rot(b.weapon, 0.4 * out, -0.5 * out, 0);
        rot(b.armL, 0, 0, 1.2 * out); rot(b.spine, 0.25 * out, 0, 0); rot(b.jaw, 0.5 * out, 0, 0); mov(b.hips, 0, -0.18 * out, 0);
        rot(b.legL, -0.3 * out, 0, 0.25 * out); rot(b.legR, -0.3 * out, 0, -0.25 * out);
        break;
      }
      case 'toss': {     // underhand toss of the dice with the free hand
        const s = snap(k, [[0, 0], [0.35, -1], [0.5, 1], [1, 0]]);
        rot(b.armL, -1.5 * Math.max(0, s) + 0.7 * Math.max(0, -s), 0, 0.1); rot(b.spine, 0.15 * Math.max(0, s), -0.2 * s, 0);
        break;
      }
      case 'hurt': {
        const p = (a.data.power as number) || 1, s = snap(k, [[0, 0], [0.12, 1], [1, 0]]) * Math.min(1.5, p);
        rot(b.spine, -0.4 * s, 0, 0.1 * s); rot(b.neck, -0.3 * s, 0, 0); rot(b.jaw, 0.6 * s, 0, 0); rot(b.armL, -0.4 * s, 0, 0.5 * s); rot(b.hair, -0.3 * s, 0, 0); this.off.z = -0.35 * s;
        break;
      }
      case 'block': {   // haft raised across the body
        const s = curve(k, [[0, 0], [0.2, 1], [0.7, 1], [1, 0]]);
        rot(b.armR, -0.7 * s, 0.3 * s, 0.5 * s); rot(b.foreR, 0.2 * s, 0, 0); rot(b.weapon, 0.3 * s, 1.1 * s, 0); rot(b.armL, -1.2 * s, 0, -0.4 * s); rot(b.foreL, -0.9 * s, 0, 0);
        rot(b.spine, 0.2 * s, 0, 0); mov(b.hips, 0, -0.12 * s, 0);
        break;
      }
      case 'bleed': {   // drags the edge across his forearm to pay the blood price
        const s = curve(k, [[0, 0], [0.3, 1], [0.65, 1], [1, 0]]), drag = curve(k, [[0, 0], [0.35, 0], [0.6, 1], [1, 1]]);
        rot(b.armL, -1.3 * s, 0, -0.5 * s); rot(b.foreL, -0.6 * s, 0, 0); rot(b.armR, -0.4 * s, 0, 0.7 * s - 0.4 * drag * s); rot(b.weapon, 0.6 * s, 0.8 * s, 0);
        rot(b.jaw, 0.4 * s, 0, 0); rot(b.spine, 0.2 * s, 0, 0); rot(b.neck, 0.2 * s, 0, 0);
        break;
      }
      case 'cheer': {
        const s = curve(k, [[0, 0], [0.2, 1], [1, 1]]), j = Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k);
        this.off.y = j * 0.55; rot(b.armR, -2.9 * s, 0, -0.3 * s); rot(b.foreR, 1.3 * s, 0, 0); rot(b.weapon, 0.6 * s, 0, 0); rot(b.armL, -2.7 * s, 0, 0.4 * s); rot(b.jaw, 0.7 * s, 0, 0); rot(b.neck, -0.35 * s, 0, 0);
        break;
      }
      case 'fall': {
        const s = curve(k, [[0, 0], [0.6, 1], [1, 1]]);
        rot(b.hips, -1.35 * s, 0, 0.2 * s); mov(b.hips, 0, -0.35 * s, -0.3 * s); rot(b.armR, -0.6 * s, 0, -0.9 * s); rot(b.armL, -0.4 * s, 0, 0.9 * s); rot(b.jaw, 0.5 * s, 0, 0); rot(b.legL, 0.6 * s, 0, 0);
        break;
      }
    }
  }
}

// ================================================================== 枯骨巫妖
const L = { ROBE: 0x5a2488, ROBE_D: 0x36145c, ROBE_DD: 0x220c3a, METAL: 0x3a3448, SOUL: 0x5affa0, SOUL_D: 0x1ec870 };
function lichModel(s: number) {
  const v = new VoxChar(s);
  v.bone('float', 'root', 0, 2, 0).bone('robe', 'float', 0, 2, 0).bone('hem', 'robe', 0, 2, 0).bone('spine', 'float', 0, 12, 0).bone('chest', 'spine', 0, 12, 0)
    .bone('neck', 'chest', 0, 17, 0).bone('head', 'neck', 0, 18, 0).bone('jaw', 'head', 0, 18, 1)
    .bone('shL', 'chest', 5.5, 15, 0).bone('armL', 'shL', 5.5, 14, 0).bone('foreL', 'armL', 5.5, 11, 0).bone('handL', 'foreL', 5.5, 8, 0)
    .bone('shR', 'chest', -5.5, 15, 0).bone('armR', 'shR', -5.5, 14, 0).bone('foreR', 'armR', -5.5, 11, 0).bone('handR', 'foreR', -5.5, 8, 0).bone('staff', 'handR', -5.5, 7, 0.5);
  // robe: a flared octagonal bell, gold trim above a ragged hem, a gold stole down the front
  const W = [6, 6, 6, 5, 5, 5, 4, 4, 4, 4];
  v.part('robe');
  for (let y = 2; y <= 11; y++) { const w = W[y - 2], d = w - 1; for (let x = -w; x < w; x++) for (let z = -d; z < d; z++) if (Math.abs(x + 0.5) + Math.abs(z + 0.5) <= w + d - 2.5) v.set(x, y, z, L.ROBE); }
  v.paint(c => c.y === 3 ? GOLD : (c.x === -1 || c.x === 0) && c.z >= 2 && c.y >= 4 ? GOLD_D : (c.y <= 5 && c.z < -2) ? L.ROBE_D : null, 'robe');
  v.part('hem');
  for (let x = -6; x < 6; x++) for (let z = -5; z < 5; z++) if (Math.abs(x + 0.5) + Math.abs(z + 0.5) <= 8.5 && Math.abs(x + 0.5) + Math.abs(z + 0.5) > 5 && ((x * 7 + z * 3) & 3) !== 0) v.set(x, 1, z, L.ROBE_D);
  // chest: robe top opening on a ribcage, a tall spiked collar, gold clasp
  v.part('chest').box(-4, 12, -3, 3, 16, 2, L.ROBE).box(-2, 13, 2, 1, 15, 2, DARK).box(-2, 13, 2, 1, 13, 2, BONE).box(-2, 15, 2, 1, 15, 2, BONE).box(-1, 13, 2, 0, 15, 2, BONE_D)
    .box(-4, 16, -3, 3, 18, -3, L.ROBE_D).box(-5, 16, -3, -5, 18, 0, L.ROBE_D).box(4, 16, -3, 4, 18, 0, L.ROBE_D)
    .set(-5, 19, -2, L.ROBE_DD).set(4, 19, -2, L.ROBE_DD).set(-3, 19, -3, L.ROBE_DD).set(2, 19, -3, L.ROBE_DD).set(-1, 20, -3, L.ROBE_DD).set(0, 20, -3, L.ROBE_DD)
    .box(-1, 16, 2, 0, 16, 2, GOLD).box(-4, 12, 2, 3, 12, 2, GOLD_D);
  // spiked pauldrons
  for (const sx of [1, -1]) {
    const x0 = sx > 0 ? 4 : -7, x1 = sx > 0 ? 6 : -5;
    v.part(sx > 0 ? 'shL' : 'shR').box(x0, 14, -2, x1, 16, 1, L.METAL).box(x0, 14, -2, x1, 14, 1, GOLD_D).set(sx > 0 ? 5 : -6, 17, -1, BONE).set(sx > 0 ? 5 : -6, 18, -1, BONE_D).set(sx > 0 ? 6 : -7, 17, 0, BONE_D);
    // arms: hanging sleeves flaring at the cuff, bony clawed hands
    v.part(sx > 0 ? 'armL' : 'armR').box(x0, 11, -2, x1, 13, 1, L.ROBE);
    v.part(sx > 0 ? 'foreL' : 'foreR').box(x0, 8, -2, x1, 10, 1, L.ROBE).box(sx > 0 ? x1 + 1 : x0 - 1, 8, -2, sx > 0 ? x1 + 1 : x0 - 1, 9, 1, L.ROBE_D).box(x0, 8, -2, x1, 8, 1, GOLD_D);
    v.part(sx > 0 ? 'handL' : 'handR').box(x0, 6, -1, x1, 7, 0, BONE).set(x0, 5, -1, BONE_D).set(x1, 5, -1, BONE_D).set(x0, 5, 0, BONE_D).set(x1, 5, 0, BONE_D);
  }
  // head: hood, a big skull with two soul-fire eyes, brow ridge and cheekbones, a bone-and-gold crown with a soul gem
  v.part('head').box(-5, 18, -3, 4, 24, 1, L.ROBE_D).box(-4, 18, -2, 3, 23, 3, BONE);
  v.symBox(1, 20, 3, 2, 21, 3, L.SOUL, 1).symBox(1, 22, 3, 3, 22, 3, BONE_D).sym(3, 19, 3, BONE_D).box(-1, 19, 3, 0, 20, 3, DARK).sym(0, 20, 3, BONE_D);
  for (let x = -4; x <= 3; x++) v.set(x, 18, 3, (x & 1) ? DARK : BONE);
  v.paint(c => c.z === 2 && c.y === 23 ? BONE_D : null, 'head');
  v.box(-4, 25, -2, 3, 25, 2, GOLD).box(-3, 25, -1, 2, 25, 1, null).sym(3, 26, 2, GOLD).sym(3, 26, -2, GOLD).sym(1, 26, 2, GOLD_D)
    .box(-1, 26, 2, 0, 27, 2, GOLD).box(-1, 25, 3, 0, 25, 3, L.SOUL, 1);
  // jaw
  v.part('jaw').box(-3, 16, 0, 2, 17, 3, BONE).box(-3, 16, 3, 2, 16, 3, BONE_D);
  for (let x = -3; x <= 2; x++) v.set(x, 17, 3, (x & 1) ? DARK : BONE);
  // staff: a dark haft through the right hand, a bone cage around the soul gem
  v.part('staff').line(-6, 0, 0, -6, 21, 0, WOOD_D).box(-6, 9, 0, -6, 9, 0, GOLD).box(-6, 15, 0, -6, 15, 0, GOLD).set(-6, -1, 0, BONE);
  v.box(-7, 22, -1, -5, 24, 1, L.SOUL, 1).set(-6, 23, 0, 0xd8ffe8, 1);
  for (const [x, z] of [[-8, -2], [-4, -2], [-8, 2], [-4, 2]]) v.box(x, 21, z, x, 25, z, BONE);
  v.box(-8, 26, -2, -4, 26, 2, BONE_D).box(-7, 26, -1, -5, 26, 1, null).set(-6, 27, 0, BONE);
  return v;
}

export class VLich extends VActor {
  readonly height = 3.6;
  robeFire = 0; wisps: THREE.Mesh[] = [];
  constructor() {
    super(0.145, lichModel(0.145), { glow: 2.2, self: 0.2 });
    const wm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7affc0).multiplyScalar(2.6), toneMapped: false });
    for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), wm); this.root.add(w); this.wisps.push(w); }
  }
  weapon() { return this.bones.staff.localToWorld(V3(-0.5 * this.s, 16.5 * this.s, 0)); }
  head() { return this.bones.head.localToWorld(V3(0, 8 * this.s, 0)); }
  chest() { return this.bones.chest.localToWorld(V3(0, 2.5 * this.s, 2 * this.s)); }
  cast() { return this.play(new Action('cast', 0.9, 0.55)); }
  summon() { return this.play(new Action('summon', 1.1, 0.55)); }
  shield() { return this.play(new Action('shield', 0.8, 0.45)); }
  hurt(power = 1) { this.hit(power); return this.play(new Action('hurt', 0.5, 0.1, { power })); }
  roar() { return this.play(new Action('roar', 1.6, 0.35)); }
  talk(dur = 1.6) { return this.play(new Action('talk', dur, 0.5)); }
  collapse() { this.dead = true; return this.play(new Action('collapse', 2.2, 0.5)); }

  protected pose(dt: number) {
    const b = this.bones, t = this.t, a = this.act, k = a ? a.k : 0, n = a?.name, low = this.lowHp;
    const hover = Math.sin(t * 1.3) * 0.12;
    mov(b.float, 0, 0.3 + hover, 0); rot(b.robe, Math.sin(t * 1.3 + 1) * 0.03, 0, Math.sin(t * 0.9) * 0.025); rot(b.hem, 0, Math.sin(t * 0.8) * 0.12, 0);
    rot(b.spine, 0.05 + low * 0.12 + Math.sin(t * 1.3) * 0.03, Math.sin(t * 0.5) * 0.06, 0); rot(b.neck, -0.05, Math.sin(t * 0.6) * 0.15, 0); rot(b.jaw, 0.06 + Math.max(0, Math.sin(t * 0.7) - 0.95) * 4, 0, 0);
    rot(b.shL, 0, 0, 0.15); rot(b.armL, -0.3 + Math.sin(t * 1.1) * 0.08, 0, 0.3); rot(b.foreL, -0.9 + Math.sin(t * 1.7) * 0.1, 0, 0); rot(b.handL, 0.2 + Math.sin(t * 3) * 0.1, 0, 0);
    rot(b.shR, 0, 0, -0.15); rot(b.armR, -0.15, 0, -0.25); rot(b.foreR, -0.85, 0, 0); rot(b.staff, 0.95, 0, 0.25);
    this.off.set(0, 0, 0);
    for (const f of this.flashMats) f.base.setRGB(0.04 * this.robeFire, (0.3 + 0.1 * Math.sin(t * 11)) * this.robeFire, 0.15 * this.robeFire);
    this.wisps.forEach((w, i) => { const ang = t * (0.8 + i * 0.15) + (i / this.wisps.length) * Math.PI * 2, r = 1.7 + Math.sin(t + i) * 0.2; w.position.set(Math.cos(ang) * r, 2.0 + Math.sin(t * 1.7 + i * 2) * 0.6 + hover, Math.sin(ang) * r); w.rotation.set(t * 2 + i, t * 3, 0); w.visible = !this.dead; });
    if (this.robeFire > 0.05 && !this.dead && Math.random() < dt * 30 * this.robeFire) {
      const p = this.chest().add(V3(R(-0.8, 0.8), R(-1.8, 0.4), R(-0.6, 0.6)));
      PADD.emit({ p, v: V3(R(-0.2, 0.2), R(1, 2.2), R(-0.2, 0.2)), s0: 0.16, s1: 0.02, life: R(0.4, 0.8), c0: new THREE.Color(0xc0ffd8), c1: new THREE.Color(0x2aff8a), bright: 2.6, tile: TILE.pixel });
    }
    if (!a) return;
    switch (n) {
      case 'cast': {   // staff raised high, gem flares, thrust forward on release
        const up = curve(k, [[0, 0], [0.45, 1], [0.6, 0.7], [1, 0]]), thrust = snap(k, [[0, 0], [0.5, 0], [0.6, 1], [1, 0]]);
        rot(b.armR, -1.5 * up - 0.5 * thrust, 0, -0.3 * up); rot(b.foreR, 0.5 * up, 0, 0); rot(b.staff, -0.4 * up + 0.5 * thrust, 0, 0);
        rot(b.armL, -1.2 * up, 0, 0.5 * up); rot(b.handL, -0.6 * up, 0, 0); rot(b.spine, -0.15 * up + 0.2 * thrust, 0, 0); rot(b.jaw, 0.4 * thrust, 0, 0);
        mov(b.float, 0, up * 0.25, 0);
        break;
      }
      case 'summon': {
        const up = curve(k, [[0, 0], [0.5, 1], [0.7, 1], [1, 0]]);
        rot(b.armL, -2.4 * up, 0, 0.4 * up); rot(b.foreL, 0.6 * up, 0, 0); rot(b.armR, -1.9 * up, 0, -0.4 * up); rot(b.spine, -0.3 * up, 0, 0); rot(b.jaw, 0.5 * up, 0, 0); mov(b.float, 0, up * 0.5, 0);
        break;
      }
      case 'shield': {
        const s = curve(k, [[0, 0], [0.4, 1], [0.8, 1], [1, 0]]);
        rot(b.armL, -1.3 * s, 0.6 * s, -0.6 * s); rot(b.armR, -0.8 * s, -0.5 * s, 0.6 * s); rot(b.spine, 0.2 * s, 0, 0); mov(b.float, 0, -0.15 * s, 0);
        break;
      }
      case 'hurt': {
        const p = Math.min(1.6, (a.data.power as number) || 1), s = snap(k, [[0, 0], [0.12, 1], [1, 0]]) * p;
        rot(b.spine, -0.3 * s, 0, 0.12 * s); rot(b.neck, -0.35 * s, 0, 0); rot(b.jaw, 0.5 * s, 0, 0); this.off.z = -0.3 * s;
        break;
      }
      case 'roar': {   // rears back, arms flung wide, jaw agape
        const s = curve(k, [[0, 0], [0.3, 1], [0.8, 1], [1, 0.4]]), sh = Math.sin(k * 60) * 0.03 * s;
        rot(b.spine, -0.4 * s, sh, 0); rot(b.neck, -0.5 * s, 0, 0); rot(b.jaw, 0.9 * s, 0, 0); rot(b.armL, -1.6 * s, 0, 1.0 * s); rot(b.armR, -1.3 * s, 0, -1.0 * s); mov(b.float, 0, 0.5 * s, 0);
        break;
      }
      case 'talk': rot(b.jaw, Math.max(0, Math.sin(k * 40)) * 0.35, 0, 0); rot(b.handL, Math.sin(k * 8) * 0.2, 0, 0); rot(b.armL, -0.4 * Math.sin(k * Math.PI), 0, 0); break;
      case 'collapse': {
        const s = curve(k, [[0, 0], [0.3, 0.3], [1, 1]]);
        rot(b.spine, 0.6 * s, 0, 0.2 * s); rot(b.neck, 0.5 * s, 0, 0); rot(b.jaw, 0.6, 0, 0); mov(b.float, 0, -0.9 * s, 0); rot(b.armL, 0.6 * s, 0, -0.4 * s); rot(b.armR, 0.4 * s, 0, 0.5 * s);
        break;
      }
    }
  }
}

// ================================================================== 食尸鬼
const G = { HIDE: 0x7c9a52, HIDE_D: 0x4c6236, RAG: 0x4a3a32, CLAW: 0x201a1e, GUM: 0x8a2030, TOOTH: 0xeee2c0, EYE: 0xff3a20 };
function ghoulModel(s: number, variant: number) {
  const v = new VoxChar(s), hide = variant ? 0x8e9a6e : G.HIDE, hideD = variant ? 0x5c6646 : G.HIDE_D;
  v.bone('hips', 'root', 0, 5, 0).bone('spine', 'hips', 0, 7, 0).bone('chest', 'spine', 0, 9, 0).bone('neck', 'chest', 0, 12, 0).bone('head', 'neck', 0, 12, 1).bone('jaw', 'head', 0, 12, 2)
    .bone('shL', 'chest', 5, 11, 0).bone('armL', 'shL', 5, 11, 0).bone('foreL', 'armL', 5, 8, 0).bone('handL', 'foreL', 5, 5, 0)
    .bone('shR', 'chest', -5, 11, 0).bone('armR', 'shR', -5, 11, 0).bone('foreR', 'armR', -5, 8, 0).bone('handR', 'foreR', -5, 5, 0)
    .bone('legL', 'hips', 2, 5, 0).bone('shinL', 'legL', 2, 3, 0).bone('footL', 'shinL', 2, 1, 0).bone('legR', 'hips', -2, 5, 0).bone('shinR', 'legR', -2, 3, 0).bone('footR', 'shinR', -2, 1, 0);
  for (const sx of [1, -1]) {
    const x0 = sx > 0 ? 1 : -3, x1 = sx > 0 ? 2 : -2, Lr = sx > 0 ? 'L' : 'R';
    v.part('leg' + Lr).box(x0, 3, -1, x1, 4, 0, hide);
    v.part('shin' + Lr).box(x0, 1, -1, x1, 2, 0, hideD);
    v.part('foot' + Lr).box(x0, 0, -1, x1, 0, 1, hideD).set(x0, 0, 2, G.CLAW).set(x1, 0, 2, G.CLAW);
    // long arms ending in black claws
    const a0 = sx > 0 ? 4 : -6, a1 = sx > 0 ? 5 : -5;
    v.part('arm' + Lr).box(a0, 8, -1, a1, 10, 0, hide);
    v.part('fore' + Lr).box(a0, 5, -1, a1, 7, 0, hideD);
    v.part('hand' + Lr).box(a0, 3, -1, a1, 4, 1, hide).set(a0, 2, 1, G.CLAW).set(a1, 2, 1, G.CLAW).set(a0, 1, 1, G.CLAW).set(a1, 2, -1, G.CLAW);
  }
  v.part('hips').box(-3, 5, -2, 2, 6, 1, hideD).box(-3, 6, -2, 2, 6, 1, G.RAG).box(-1, 3, 2, 0, 5, 2, G.RAG).box(-1, 4, -3, 0, 5, -3, G.RAG);
  v.part('spine').box(-3, 7, -2, 2, 8, 1, hide).set(-1, 7, -3, hideD).set(0, 8, -3, hideD);
  v.part('chest').box(-4, 9, -2, 3, 11, 1, hide).paint(c => c.z === 1 && (c.y === 9 || c.y === 11) && Math.abs(c.x + 0.5) > 0.6 ? hideD : null, 'chest');
  v.set(-1, 10, -3, hideD).set(0, 11, -3, hideD).set(-1, 12, -2, hideD);
  v.part('neck').box(-1, 12, -1, 0, 12, 0, hideD);
  // head: big, thrust forward, glowing eyes under a heavy brow, pointed ears, upper fangs
  v.part('head').box(-3, 13, -1, 2, 16, 3, hide).box(-3, 16, -1, 2, 16, 3, hideD);
  v.symBox(1, 14, 3, 2, 14, 3, G.EYE, 1).symBox(1, 15, 3, 3, 15, 4, hideD).box(-1, 14, 4, 0, 14, 4, hideD).box(-1, 13, 4, 0, 13, 4, hideD);
  v.symBox(3, 15, 0, 4, 15, 1, hide).sym(5, 16, 0, hide);
  for (let x = -3; x <= 2; x++) v.set(x, 13, 3, (x & 1) ? G.TOOTH : G.GUM);
  // jaw: hanging open, lower fangs
  v.part('jaw').box(-2, 11, 1, 1, 12, 3, hideD).box(-2, 12, 3, 1, 12, 3, G.GUM).sym(1, 12, 3, G.TOOTH).sym(0, 12, 4, G.TOOTH);
  return v;
}

export class VGhoul extends VActor {
  readonly height = 1.7;
  walkK = 0;
  constructor(variant = 0) { super(0.125, ghoulModel(0.125, variant), { glow: 2.6 }); }
  weapon() { return this.bones.handR.localToWorld(V3(0, -3 * this.s, 1 * this.s)); }
  head() { return this.bones.head.localToWorld(V3(0, 5 * this.s, 1 * this.s)); }
  chest() { return this.bones.chest.localToWorld(V3(0, 1.5 * this.s, 1 * this.s)); }
  lunge(dist: number) { return this.play(new Action('lunge', 0.75, 0.48, { dist })); }
  hurt(power = 1) { this.hit(power); return this.play(new Action('hurt', 0.45, 0.1, { power })); }
  shriek() { return this.play(new Action('shriek', 0.9, 0.4)); }
  dispose() { this.root.parent?.remove(this.root); }

  protected pose(dt: number) {
    const b = this.bones, t = this.t, a = this.act, k = a ? a.k : 0, n = a?.name;
    const sway = Math.sin(t * 2.8), w = this.walkK, hop = Math.abs(Math.sin(t * 9)) * w;
    // idle: crouched and twitchy, arms dangling; lurching hops when moving
    mov(b.hips, 0, -0.1 + hop * 0.16 + sway * 0.02, 0);
    rot(b.spine, 0.3 + sway * 0.04 + w * 0.2, Math.sin(t * 1.3) * 0.1, 0); rot(b.chest, 0.3, 0, Math.sin(t * 2.1) * 0.05); rot(b.neck, -0.45, Math.sin(t * 3.3) * 0.25, 0);
    rot(b.head, -0.15 + Math.sin(t * 7) * 0.05, 0, Math.sin(t * 2.6) * 0.15); rot(b.jaw, 0.2 + Math.max(0, Math.sin(t * 2.2)) * 0.25, 0, 0);
    rot(b.armL, 0.35 + Math.sin(t * 2.8 + 1) * 0.15 - w * Math.sin(t * 9) * 0.4, 0, 0.12); rot(b.foreL, -0.35, 0, 0);
    rot(b.armR, 0.35 + Math.sin(t * 2.8 + 2) * 0.15 + w * Math.sin(t * 9) * 0.4, 0, -0.12); rot(b.foreR, -0.35, 0, 0);
    rot(b.legL, -0.5 + w * Math.sin(t * 9) * 0.4, 0, 0.08); rot(b.shinL, 0.85, 0, 0); rot(b.footL, -0.35, 0, 0);
    rot(b.legR, -0.5 - w * Math.sin(t * 9) * 0.4, 0, -0.08); rot(b.shinR, 0.85, 0, 0); rot(b.footR, -0.35, 0, 0);
    this.off.set(0, 0, 0);
    if (!a) return;
    switch (n) {
      case 'lunge': {   // coil, spring at the hero, double claw swipe, scuttle back
        const d = (a.data.dist as number) || 0, coil = curve(k, [[0, 0], [0.3, 1], [0.42, 0], [1, 0]]), swipe = snap(k, [[0, 0], [0.4, 0], [0.5, 1], [0.7, 1], [1, 0]]);
        this.off.z = curve(k, [[0, 0], [0.3, -0.25], [0.48, d], [0.72, d], [1, 0]]); this.off.y = curve(k, [[0, 0], [0.32, 0], [0.4, 0.6], [0.48, 0], [1, 0]]);
        mov(b.hips, 0, -0.18 * coil, 0); rot(b.spine, 0.3 * coil - 0.2 * swipe, 0, 0); rot(b.jaw, 0.7 * (coil + swipe), 0, 0);
        rot(b.armR, -2.2 * coil + 2.4 * swipe, 0, -0.4 * swipe); rot(b.armL, -1.8 * coil + 1.7 * swipe, 0, 0.4 * swipe); rot(b.foreR, -0.6 * coil, 0, 0);
        break;
      }
      case 'hurt': { const p = Math.min(1.5, (a.data.power as number) || 1), s = snap(k, [[0, 0], [0.12, 1], [1, 0]]) * p; rot(b.spine, -0.5 * s, 0, 0.2 * s); rot(b.neck, -0.4 * s, 0, 0); rot(b.jaw, 0.6 * s, 0, 0); this.off.z = -0.4 * s; break; }
      case 'shriek': { const s = curve(k, [[0, 0], [0.3, 1], [0.8, 1], [1, 0]]); rot(b.neck, -0.7 * s, 0, 0); rot(b.jaw, 0.9 * s, 0, 0); rot(b.armL, -1.0 * s, 0, 0.8 * s); rot(b.armR, -1.0 * s, 0, -0.8 * s); break; }
    }
  }
}

export const voxelCast = (): Cast => ({ hero: () => new VHero(), lich: () => new VLich(), ghoul: (n: number) => new VGhoul(n % 2) });
