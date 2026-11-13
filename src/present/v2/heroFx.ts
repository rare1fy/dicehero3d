// 职业状态读演出快照，不能在敌方动作尚未播放时提前补满下一回合的刀鞘。
// Over the head (camera-facing voxel icons): mage = 3-cell chant ring, warrior = 5 blood drops (血怒), rogue = the scabbard (UX_V3 §8:
// one dagger per strike left this turn, drawn out right to left leaving dashed empty slots; the last one orange and blinking; none =
// all grey + 「刀尽」; never a 'full combo' glow)
// plus a shadow icon that flashes when the first strike grants the free reroll. On the body (pixel particles, rising straight up):
// mage star energy by chant turns, barrier = a voxel hemisphere, backlash = purple-black crack sparks; warrior fury flames by rage, a
// burning hand while a fury die is on the field. Tap the hero → a tips pane with the exact numbers.
import * as THREE from 'three';
import { scene, camera, V3, R } from '../engine/world';
import { PADD, PALPHA, TILE } from '../engine/particles';
import { voxModel } from '../ui3d/vox';
import { arcSlab } from './hud/models';
import { worldToUi } from '../ui3d/layer';
import type { BattleActor } from '../bestiary/battle';
import type { Battle2 } from '../../core/v2/battle2';
import type { ClassId } from '../../core/v2/types';
import { Overlay, Pane, panel, text, textW, PIX_H } from './overlay';
import { BarrierDome } from './barrierDome';

const CELL = 0.055;
const DROP = ['..#..', '.###.', '#####', '#####', '.###.'];
const DAGGER = ['..#..', '.###.', '.###.', '.###.', '.###.', '.###.', '#####', '..#..', '..#..', '.###.'];
const SHADOW = ['..###..', '.#####.', '.#o#o#.', '.#####.', '#######', '#######', '#.#.#.#'];
const RUNE = ['#####', '#ooo#', '#ooo#', '#ooo#', '#####'];

/** a pixel icon as a voxel slab (2 cells deep); ch '#' = main, 'o' = accent; glow = the cells light up (bloom) */
function iconModel(rows: string[], main: number, acc: number, glow: boolean) {
  const H = rows.length;
  return voxModel(CELL, set => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '.') return; for (let z = 0; z < 2; z++) set(i, H - 1 - j, z, ch === 'o' ? acc : main, glow ? 1 : 0); })), { glow: 1.25 });
}
interface Slot { on: THREE.Group; off: THREE.Group; g: THREE.Group; pop: number; was: boolean; last?: THREE.Group }
/** the dashed outline of a pixel icon (every other edge cell): an empty scabbard slot */
function dashModel(rows: string[], col: number) {
  const H = rows.length, on = (i: number, j: number) => rows[j]?.[i] === '#';
  return voxModel(CELL, set => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '#') return; const edge = !on(i - 1, j) || !on(i + 1, j) || !on(i, j - 1) || !on(i, j + 1); if (edge && (i + j) % 2 === 0) set(i, H - 1 - j, 0, col); })), { glow: 0 });
}
function wordSprite(t: string) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 48; const g = c.getContext('2d')!;
  g.font = '900 30px "Microsoft YaHei UI","Microsoft YaHei","PingFang SC",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 6; g.strokeStyle = 'rgba(8,6,14,0.9)'; g.strokeText(t, 64, 26); g.fillStyle = '#9a94a8'; g.fillText(t, 64, 26);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })); sp.scale.set(1.0, 0.375, 1); sp.renderOrder = 21; return sp;
}

export class HeroFx {
  private head = new THREE.Group(); private dome = new BarrierDome(); private shownState: Battle2['s'] | null = null;
  private sets: Record<ClassId, Slot[]> = { warrior: [], mage: [], rogue: [] };
  private shadow: THREE.Group; private shadowT = 0; private lastStrikes = 0; private t = 0;
  private acc = { star: 0, crack: 0, rage: 0, hand: 0 };
  private tip: Pane; tipOn = false; private cls: ClassId = 'warrior';
  private orbit = new THREE.Group(); private orbitMat!: THREE.MeshBasicMaterial; private spent: THREE.Sprite;
  constructor(private ov: Overlay) {
    scene.add(this.head);
    const mk = (rows: string[], on: [number, number], off: [number, number], x: number, y = 0): Slot => {
      const g = new THREE.Group(), a = iconModel(rows, on[0], on[1], true), b = iconModel(rows, off[0], off[1], false);
      g.add(a, b); g.position.set(x, y, 0); this.head.add(g); return { on: a, off: b, g, pop: 0, was: false };
    };
    for (let i = 0; i < 5; i++) this.sets.warrior.push(mk(DROP, [0xff2a20, 0xff9a80], [0x2a1416, 0x3a1a1c], (i - 2) * 6.5 * CELL));
    // R5: the mage's chant ring = an arch of three thick arcs over the head (mockup), lit cyan per filled cell
    const arcOn = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x40e0ff).multiplyScalar(1.6), toneMapped: false }), arcOff = new THREE.MeshBasicMaterial({ color: 0x3a4658, transparent: true, opacity: 0.85, toneMapped: false });
    for (let i = 0; i < 3; i++) {
      const a1 = (160 - i * 50) * Math.PI / 180, a0 = a1 - 40 * Math.PI / 180, g = new THREE.Group();
      const on = new THREE.Group(), off = new THREE.Group(); on.add(arcSlab(0.5, 0.62, a0, a1, 0.08, arcOn)); off.add(arcSlab(0.5, 0.62, a0, a1, 0.08, arcOff));
      g.add(on, off); g.position.set(0, -0.35, 0); this.head.add(g); this.sets.mage.push({ on, off, g, pop: 0, was: false });
    }
    // R5: a dotted cyan orbit round the mage's body (mockup)
    const om = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x40e0ff).multiplyScalar(1.5), transparent: true, toneMapped: false });
    for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), om); this.orbit.add(m); }
    this.orbitMat = om; this.orbit.visible = false; scene.add(this.orbit);
    // the rogue's scabbard: up to 6 slots (5 strikes + the 无尽连斩 awakening slot)
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group(), on = iconModel(DAGGER, 0xd8c8ff, 0x8a50d8, true), off = dashModel(DAGGER, 0x5a5468), last = iconModel(DAGGER, 0xff9a30, 0xffe0a0, true);
      g.add(on, off, last); this.head.add(g); this.sets.rogue.push({ on, off, g, pop: 0, was: false, last });
    }
    this.spent = wordSprite('刀尽'); this.spent.position.set(0, -0.42, 0); this.spent.visible = false; this.head.add(this.spent);
    this.shadow = iconModel(SHADOW, 0x5a30a0, 0xffd0ff, true); this.shadow.position.set(0, 9 * CELL, 0); this.shadow.visible = false; this.head.add(this.shadow);
    scene.add(this.dome.root);
    this.tip = ov.pane(12); this.tip.visible = false;
  }

  /** call every frame; hero / b null (or not in battle) hides everything */
  update(dt: number, hero: BattleActor | null, b: Battle2 | null, cls: ClassId, on: boolean, shown: Battle2['s'] | null = null) {
    this.t += dt; this.cls = cls;
    const live = on && !!hero && !!b && hero.root.visible && !hero.dead;
    this.head.visible = live; this.dome.root.visible = live; if (!live) this.orbit.visible = false;
    if (!live) { this.tip.visible = false; this.tipOn = false; return; }
    const s = shown ?? b!.s, p = s.player, h = hero!; this.shownState = s;
    // ---- over the head
    const top = h.root.position.clone().add(V3(0, h.top + 0.85, 0));
    this.head.position.copy(top); this.head.quaternion.copy(camera.quaternion);
    // R5: the mage's orbit (brighter with the chant ring)
    this.orbit.visible = cls === 'mage';
    if (cls === 'mage') {
      const k = 0.35 + 0.22 * s.chantRing, base = h.root.position, rw = Math.max(0.8, h.width * 0.85);
      this.orbit.children.forEach((m, i) => { const a = this.t * 0.9 + (i / 18) * Math.PI * 2; m.position.set(base.x + Math.cos(a) * rw, base.y + 0.75 + Math.sin(a * 2 + this.t) * 0.06, base.z + Math.sin(a) * rw * 0.8); m.scale.setScalar(0.7 + 0.5 * Math.sin(a * 3 + this.t * 4) ** 2); });
      this.orbitMat.opacity = Math.min(1, k);
    }
    for (const c of Object.keys(this.sets) as ClassId[]) for (const sl of this.sets[c]) sl.g.visible = c === cls;
    const lit: boolean[] = cls === 'warrior' ? this.sets.warrior.map((_, i) => i < p.rage) : cls === 'mage' ? this.sets.mage.map((_, i) => i < s.chantRing) : [];
    // rogue: the scabbard = strikes left this turn (drawn out right to left, never refilled mid-turn)
    let rogueLeft = 0, rogueN = 0;
    if (cls === 'rogue') { rogueN = Math.max(1, Math.min(6, s.maxStrikes)); rogueLeft = Math.max(0, s.maxStrikes - s.strikesUsed); this.sets.rogue.forEach((_, i) => { lit[i] = i < rogueLeft; }); }
    this.spent.visible = cls === 'rogue' && rogueLeft === 0;
    this.sets[cls].forEach((sl, i) => {
      const o = !!lit[i]; if (o && !sl.was) sl.pop = 1; sl.was = o;
      sl.on.visible = o; sl.off.visible = !o; sl.pop = Math.max(0, sl.pop - dt * 3);
      if (cls === 'rogue') {   // the last dagger: orange, blinking; slots past the strike cap hidden
        const lastOne = o && rogueLeft === 1 && i === 0; sl.on.visible = o && !lastOne; if (sl.last) sl.last.visible = lastOne && Math.sin(this.t * 9) > -0.4;
        sl.g.visible = i < rogueN; sl.g.position.x = (i - (rogueN - 1) / 2) * 6.5 * CELL; sl.g.scale.setScalar(1); sl.g.position.y = 0; return;
      }
      const bob = cls === 'mage' && o ? Math.sin(this.t * 2 + i) * 0.4 * CELL : 0;
      if (cls === 'mage') { sl.g.scale.setScalar(1 + sl.pop * 0.25); sl.g.position.y = -0.35 + sl.pop * 0.08; void bob; }
      else { sl.g.scale.setScalar(1 + sl.pop * 0.6); sl.g.position.y = bob + sl.pop * 2 * CELL; }
    });
    // rogue: the first strike's free reroll → the shadow icon flashes (blinks for 1.2 s)
    if (cls === 'rogue') { if (s.strikesUsed === 1 && this.lastStrikes === 0) this.shadowT = 1.4; this.lastStrikes = s.strikesUsed; }
    this.shadowT = Math.max(0, this.shadowT - dt);
    this.shadow.visible = cls === 'rogue' && this.shadowT > 0 && Math.floor(this.shadowT * 8) % 2 === 0;
    this.shadow.scale.setScalar(1 + Math.max(0, this.shadowT - 1.1) * 2);
    // ---- the body
    const base = h.root.position, w = Math.max(0.6, Math.min(1.6, h.width)), ht = Math.max(1, h.height);
    const around = (k = 1) => base.clone().add(V3(R(-0.5, 0.5) * w * k, R(0.1, 0.9) * ht, R(-0.5, 0.5) * w * k));
    this.dome.update(dt, h, p.barrier, s.dice.length+s.carry.length);
    const emit = (key: keyof HeroFx['acc'], rate: number, fn: () => void) => { this.acc[key] += rate * dt; let n = 0; while (this.acc[key] >= 1 && n++ < 12) { this.acc[key] -= 1; fn(); } if (rate <= 0) this.acc[key] = 0; };
    if (cls === 'mage') {
      const k = s.chantRing + (s.overcharge || 0) * 0.7;
      emit('star', k > 0 ? 5 + 9 * k : 0, () => PADD.emit({ p: around(), v: V3(0, R(0.5, 1.1) * (1 + k * 0.2), 0), c0: new THREE.Color(0xe8f4ff), c1: new THREE.Color(0x4a8aff), bright: 2 + k * 0.4, s0: 0.06 + 0.015 * k, s1: 0.01, life: R(0.6, 1.1), tile: TILE.pixel }));
      const bl = p.backlash || 0;
      emit('crack', bl > 0 ? 3 + 4 * bl : 0, () => {
        const q = around(0.8), vert = Math.random() < 0.5;
        PADD.emit({ p: q, c0: new THREE.Color(0xe080ff), c1: new THREE.Color(0x401060), bright: 2.2, s0: 0.16, s1: 0.1, life: R(0.18, 0.3), tile: TILE.streak, rot: vert ? Math.PI / 2 : 0 });
        PALPHA.emit({ p: q.clone().add(V3(0, 0.02, 0)), v: V3(0, R(0.2, 0.5), 0), c0: new THREE.Color(0x1a0824), alpha: 0.8, s0: 0.07, s1: 0.03, life: R(0.4, 0.7), tile: TILE.pixel });
      });
    } else this.acc.star = this.acc.crack = 0;
    if (cls === 'warrior') {
      const rg = p.rage || 0;
      emit('rage', rg > 0 ? 6 + 9 * rg : 0, () => PADD.emit({ p: around(0.9).setY(base.y + R(0.05, 0.7) * ht), v: V3(0, R(0.8, 1.6) * (1 + rg * 0.15), 0), c0: new THREE.Color(0xffc060), c1: new THREE.Color(0xc01010), bright: 2.4, s0: 0.07 + 0.025 * rg, s1: 0.015, life: R(0.35, 0.6) * (1 + rg * 0.1), tile: TILE.pixel }));
      const fury = s.dice.some(d => d.kind === 'furyDie') || s.carry.some(d => d.kind === 'furyDie');
      emit('hand', fury ? 26 : 0, () => { const hp = h.bonePos('handR'); PADD.emit({ p: hp.add(V3(R(-0.08, 0.08), R(-0.05, 0.1), R(-0.08, 0.08))), v: V3(0, R(0.9, 1.6), 0), c0: new THREE.Color(0xfff0a0), c1: new THREE.Color(0xff3a08), bright: 2.8, s0: 0.09, s1: 0.02, life: R(0.25, 0.45), tile: TILE.pixel }); });
    } else this.acc.rage = this.acc.hand = 0;
    // ---- tips
    if (this.tipOn) this.drawTip(h, b!); else this.tip.visible = false;
  }

  /** tap test: on the hero (or its head icons) toggles the tips pane; any other tap closes it (returns false so the tap goes on) */
  pointer(x: number, y: number, hero: BattleActor | null) {
    if (!hero || !this.head.visible) return false;
    const c = worldToUi(hero.chest()), t = worldToUi(this.head.position), r = Math.max(40, Math.abs(c.y - t.y) * 0.45);
    const hit = (Math.abs(x - c.x) < r && y > t.y - 24 && y < c.y + r);
    if (hit) { this.tipOn = !this.tipOn; return true; }
    if (this.tipOn) this.tipOn = false;
    return false;
  }

  private lines(b: Battle2): Array<[string, string]> {
    const s = this.shownState ?? b.s, p = s.player, out: Array<[string, string]> = [[`生命 ${p.hp}/${p.maxHp}${p.armor ? `  护甲 ${p.armor}` : ''}`, '#ffb0a0']];
    if (this.cls === 'warrior') {
      out.push([`血怒 ${p.rage}/5（头顶血滴）`, '#ff8a7a'], ['卖血重投攒血怒，身上怒焰随层数变大', '#d8c0b8']);
      if (s.overflow > 0) out.push([`溢出 ${s.overflow} 颗 · 本回合加伤`, '#ffb070']);
      else if (s.phase === 'player') { const nd = b.nextDice(); if (nd.overflow > 0) out.push([`下回合溢出 ${nd.overflow}`, '#ffb070']); }
      if (s.dice.some(d => d.kind === 'furyDie')) out.push(['怒火骰在场（手上冒火）', '#ffa050']);
    } else if (this.cls === 'mage') {
      out.push([`吟唱 ${s.chantRing}/3${s.overcharge ? ` 过充 ${s.overcharge}` : ''}（头顶环）`, '#8ac8ff']);
      out.push(['不出手结束回合 = 吟唱，星光更盛', '#c0d0e8']);
      if (p.barrier) out.push([`屏障 ${p.barrier}（淡光罩）`, '#9ad8ff']);
      if (p.backlash) out.push([`反噬 ${p.backlash} 层（紫黑裂纹）`, '#d090ff']);
      const risk = s.phase === 'player' ? b.chantRisk() : 0; if (risk) out.push([`再吟唱一回合 多受 ${risk}`, '#d090ff']);
    } else {
      const left = Math.max(0,s.maxStrikes-s.strikesUsed);
      out.push([`本回合剩 ${left}/${s.maxStrikes} 刀（头顶匕首）`, '#e0a8ff'], ['第一刀后白送一次重投（影子闪一下）', '#c8b8e0']);
      if (s.freeRerollsLeft) out.push([`免费重投 ×${s.freeRerollsLeft}`, '#8ad8ff']);
      const sh = s.dice.filter(x => x.kind === 'shadowDie').length; if (sh) out.push([`暗影残骰 ${sh}`, '#c890ff']);
      if (s.knifeMark) out.push([`飞刀标记：${s.knifeMark.shape === 'straight' ? '顺子' : '同点'}`, '#ffd0ff']);
    }
    return out;
  }
  private drawTip(h: BattleActor, b: Battle2) {
    const ov = this.ov, d = ov.dpr, sz = Math.max(1, Math.round(ov.fp * d)), ls = this.lines(b);
    const lh = PIX_H * sz / d + 4, w = Math.max(...ls.map(l => textW(l[0], sz) / d)) + 20, ht = ls.length * lh + 14;
    this.tip.paint('hfx|' + ls.map(l => l[0]).join('|') + d, w, ht, g => { panel(g, 0, 0, w * d, ht * d, 2 * d, { body: '#140e18', rim: '#c8a060', line: '#07050a', hi: '#221a28' }); ls.forEach((l, i) => text(g, l[0], 10 * d, (7 + i * lh) * d, sz, l[1])); });
    const c = worldToUi(h.head());
    this.tip.at(Math.max(8, Math.min(ov.w - w - 8, c.x + 50)), Math.max(8, Math.min(ov.h - ht - 8, c.y - ht / 2))); this.tip.visible = true;
  }
}
