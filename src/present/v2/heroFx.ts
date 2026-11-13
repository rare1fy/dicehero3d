// fx4: the class state shown on the hero model instead of HUD text (SHOW3 #16). Read from the live Battle2 state every frame.
// Over the head (camera-facing voxel icons): mage = 3-cell chant ring, warrior = 5 blood drops (血怒), rogue = 2 daggers (strikes left)
// plus a shadow icon that flashes when the first strike grants the free reroll. On the body (pixel particles, rising straight up):
// mage star energy by chant turns, barrier = a pale box shell, backlash = purple-black crack sparks; warrior fury flames by rage, a
// burning hand while a fury die is on the field. Tap the hero → a tips pane with the exact numbers.
import * as THREE from 'three';
import { scene, camera, V3, R } from '../engine/world';
import { PADD, PALPHA, TILE } from '../engine/particles';
import { voxModel } from '../ui3d/vox';
import { worldToUi } from '../ui3d/layer';
import type { BattleActor } from '../bestiary/battle';
import type { Battle2 } from '../../core/v2/battle2';
import type { ClassId } from '../../core/v2/types';
import { Overlay, Pane, panel, text, textW, PIX_H } from './overlay';

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
interface Slot { on: THREE.Group; off: THREE.Group; g: THREE.Group; pop: number; was: boolean }

export class HeroFx {
  private head = new THREE.Group(); private shell: THREE.Mesh; private shellMat: THREE.MeshBasicMaterial; private edge: THREE.LineSegments; private edgeMat: THREE.LineBasicMaterial;
  private sets: Record<ClassId, Slot[]> = { warrior: [], mage: [], rogue: [] };
  private shadow: THREE.Group; private shadowT = 0; private lastStrikes = 0; private barrierK = 0; private t = 0;
  private acc = { star: 0, crack: 0, rage: 0, hand: 0 };
  private tip: Pane; tipOn = false; private cls: ClassId = 'warrior';
  constructor(private ov: Overlay) {
    scene.add(this.head);
    const mk = (rows: string[], on: [number, number], off: [number, number], x: number, y = 0): Slot => {
      const g = new THREE.Group(), a = iconModel(rows, on[0], on[1], true), b = iconModel(rows, off[0], off[1], false);
      g.add(a, b); g.position.set(x, y, 0); this.head.add(g); return { on: a, off: b, g, pop: 0, was: false };
    };
    for (let i = 0; i < 5; i++) this.sets.warrior.push(mk(DROP, [0xff2a20, 0xff9a80], [0x2a1416, 0x3a1a1c], (i - 2) * 6.5 * CELL));
    for (let i = 0; i < 3; i++) this.sets.mage.push(mk(RUNE, [0x6aa8ff, 0xe0f4ff], [0x1a2238, 0x262e48], (i - 1) * 6.5 * CELL, i === 1 ? 1.5 * CELL : 0));
    for (let i = 0; i < 2; i++) this.sets.rogue.push(mk(DAGGER, [0xb8a0e8, 0x8a50d8], [0x242030, 0x1a1622], (i - 0.5) * 7 * CELL));
    this.shadow = iconModel(SHADOW, 0x5a30a0, 0xffd0ff, true); this.shadow.position.set(0, 9 * CELL, 0); this.shadow.visible = false; this.head.add(this.shadow);
    // the barrier: a pale box shell with crisp edges (axis-aligned, no curves)
    this.shellMat = new THREE.MeshBasicMaterial({ color: 0x6ab8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    this.shell = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.shellMat); this.shell.renderOrder = 5;
    this.edgeMat = new THREE.LineBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), this.edgeMat); this.shell.add(this.edge);
    scene.add(this.shell);
    this.tip = ov.pane(12); this.tip.visible = false;
  }

  /** call every frame; hero / b null (or not in battle) hides everything */
  update(dt: number, hero: BattleActor | null, b: Battle2 | null, cls: ClassId, on: boolean) {
    this.t += dt; this.cls = cls;
    const live = on && !!hero && !!b && hero.root.visible && !hero.dead;
    this.head.visible = live; this.shell.visible = live;
    if (!live) { this.tip.visible = false; this.tipOn = false; return; }
    const s = b!.s, p = s.player, h = hero!;
    // ---- over the head
    const top = h.root.position.clone().add(V3(0, h.top + 0.85, 0));
    this.head.position.copy(top); this.head.quaternion.copy(camera.quaternion);
    for (const c of Object.keys(this.sets) as ClassId[]) for (const sl of this.sets[c]) sl.g.visible = c === cls;
    const lit: boolean[] = cls === 'warrior' ? this.sets.warrior.map((_, i) => i < p.rage) : cls === 'mage' ? this.sets.mage.map((_, i) => i < s.chantRing) : [];
    // rogue: daggers = strikes left this turn (max 2 shown); the used one goes dark
    if (cls === 'rogue') { const left = s.phase === 'player' ? Math.max(0, s.maxStrikes - s.strikesUsed) : s.maxStrikes; this.sets.rogue.forEach((_, i) => { lit[i] = i < Math.min(2, left); }); }
    this.sets[cls].forEach((sl, i) => {
      const o = !!lit[i]; if (o && !sl.was) sl.pop = 1; sl.was = o;
      sl.on.visible = o; sl.off.visible = !o; sl.pop = Math.max(0, sl.pop - dt * 3);
      const bob = cls === 'mage' && o ? Math.sin(this.t * 2 + i) * 0.4 * CELL : 0;
      sl.g.scale.setScalar(1 + sl.pop * 0.6); sl.g.position.y = (cls === 'mage' && i === 1 ? 1.5 * CELL : 0) + bob + sl.pop * 2 * CELL;
    });
    // rogue: the first strike's free reroll → the shadow icon flashes (blinks for 1.2 s)
    if (cls === 'rogue') { if (s.strikesUsed === 1 && this.lastStrikes === 0) this.shadowT = 1.4; this.lastStrikes = s.strikesUsed; }
    this.shadowT = Math.max(0, this.shadowT - dt);
    this.shadow.visible = cls === 'rogue' && this.shadowT > 0 && Math.floor(this.shadowT * 8) % 2 === 0;
    this.shadow.scale.setScalar(1 + Math.max(0, this.shadowT - 1.1) * 2);
    // ---- the body
    const base = h.root.position, w = Math.max(0.6, Math.min(1.6, h.width)), ht = Math.max(1, h.height);
    const around = (k = 1) => base.clone().add(V3(R(-0.5, 0.5) * w * k, R(0.1, 0.9) * ht, R(-0.5, 0.5) * w * k));
    // barrier shell
    this.barrierK += ((p.barrier > 0 ? 1 : 0) - this.barrierK) * Math.min(1, dt * 6);
    this.shell.position.copy(base).add(V3(0, ht * 0.55, 0)); this.shell.scale.set(w + 0.5, ht + 0.5, w + 0.5);
    this.shell.quaternion.setFromAxisAngle(V3(0, 1, 0), h.root.rotation.y);
    const pulse = 0.85 + 0.15 * Math.sin(this.t * 3);
    this.shellMat.opacity = 0.06 * this.barrierK * pulse; this.edgeMat.opacity = 0.28 * this.barrierK * pulse; this.shell.visible = this.barrierK > 0.02;
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
    const s = b.s, p = s.player, out: Array<[string, string]> = [[`生命 ${p.hp}/${p.maxHp}${p.armor ? `  护甲 ${p.armor}` : ''}`, '#ffb0a0']];
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
      const left = s.phase === 'player' ? b.strikesLeft() : s.maxStrikes;
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
