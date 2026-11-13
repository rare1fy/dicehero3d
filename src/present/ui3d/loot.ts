// 爆金币和经验 (progression.md §7.2 / 7.3): coins burst out of a world point in a cone, fall and bounce on the ground, lie there
// glinting for a beat ("a floor full of money"), then rise one by one and arc high over the dice toward the purse; the last stretch
// hands over to the UI layer (the purse in the top-left corner squashes on every coin, the number rolls up, the pitch climbs).
// Overkill adds a second, red-gold burst. Experience: cyan light points (no body, never land) drift into the hero, then into the
// class emblem next to the flask, whose bar fills.
import * as THREE from 'three';
import { scene, V3, R, TAU } from '../engine/world';
import { ease, lerp, after } from '../engine/clock';
import { PADD, TILE } from '../engine/particles';
import { UiLayer, uiToWorld, worldToUi } from './layer';
import { voxModel, iconCells, Spring, UiSparks, hexN } from './vox';
import { SUITS, CLASS_FACES, type ClassId } from './suitData';
import { cue } from '../../audio/cues';

const COIN_R = 0.24;
const COIN_ROWS = ['..####..', '.######.', '##o###o#', '##o##o##', '##oo####', '##o##o##', '.######.', '..####..'];

function coinMesh(n: number, gold: number, hi: number) {
  const g = voxModel(COIN_R * 2 / 8, set => iconCells(set, COIN_ROWS, 0, 0, 0, 2, ch => ({ c: ch === 'o' ? hi : gold })), { centre: [4, 4, 1] });
  let src: THREE.Mesh | null = null; g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !src) src = m; });
  const s = src as unknown as THREE.Mesh, geo = s.geometry.clone(); s.updateWorldMatrix(true, false);
  geo.applyMatrix4(s.matrixWorld.clone().premultiply(new THREE.Matrix4().makeTranslation(0, 0, 0)));
  const mat = (s.material as THREE.Material).clone() as THREE.MeshToonMaterial; mat.emissive = new THREE.Color(0x3a2400);
  const im = new THREE.InstancedMesh(geo, mat, n); im.count = 0; im.frustumCulled = false; im.castShadow = true;
  return im;
}

interface Coin { p: THREE.Vector3; v: THREE.Vector3; spin: number; ax: THREE.Vector3; ang: number; state: 'fly' | 'lie' | 'go' | 'ui'; t: number; delay: number; value: number; red: boolean; from: THREE.Vector3; mid: THREE.Vector3; bounces: number; ux: number; uy: number }
interface Mote { p: THREE.Vector3; from: THREE.Vector3; mid: THREE.Vector3; t: number; dur: number; delay: number; stage: 'hero' | 'ui'; ux: number; uy: number; amount: number }

export interface Purse { x: number; y: number }

export class Loot {
  gold = 0; shownGold = 0; xp = 0; xpMax = 30; shownXp = 0; level = 1;
  /** purse and emblem positions (CSS px), set by the layout */
  purse: Purse = { x: 70, y: 60 }; emblem = { x: 230, y: 640 };
  /** R5: purse size (px); the class emblem + xp bar and the pixel digits are off (the HUD draws the gold number) */
  bagPx = 54; showEmblem = false; visible = true;
  /** where experience goes in the world first (the hero's chest), updated by the caller */
  heroAt: () => THREE.Vector3 = () => V3(-2, 1.2, 3);
  onGold: (gold: number) => void = () => {}; onLevel: (lv: number) => void = () => {};
  private coins: Coin[] = []; private motes: Mote[] = []; private im: THREE.InstancedMesh; private imRed: THREE.InstancedMesh;
  private bag: THREE.Group; private bagSq = new Spring(380, 12); private emb: THREE.Group; private embSq = new Spring(300, 12); private bar: THREE.Mesh[] = [];
  private sparks: UiSparks; private uiCoin: THREE.InstancedMesh; private chime = 0; private chimeT = 0; private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion();
  constructor(private L: UiLayer, private cls: ClassId = 'warrior') {
    this.im = coinMesh(80, 0xffc640, 0xfff0a0); this.imRed = coinMesh(40, 0xe86a2a, 0xffc890); scene.add(this.im, this.imRed);
    this.uiCoin = coinMesh(80, 0xffc640, 0xfff0a0); this.uiCoin.castShadow = false; L.scene.add(this.uiCoin);
    this.sparks = new UiSparks(L.scene, 120);
    // the purse: a voxel money bag with a gold coin badge
    this.bag = voxModel(1, set => {
      const LEATH = 0x8a5a32, LEATH_D = 0x5e3a20, ROPE = 0xd8b070, GOLD = 0xffc640;
      for (let y = 0; y < 12; y++) { const r = y < 8 ? [4, 5, 6, 6, 6, 6, 5, 4][y] : y === 8 ? 2 : y === 9 ? 2 : 3; for (let x = -r; x < r; x++) for (let z = -Math.min(r, 4); z < Math.min(r, 4); z++) set(x, y, z, y === 8 || y === 9 ? ROPE : (x + y) % 5 === 0 ? LEATH_D : LEATH); }
      for (let x = -2; x < 2; x++) for (let y = 3; y < 6; y++) set(x, y, 4, GOLD, 1);
      set(-1, 6, 4, GOLD, 1); set(0, 6, 4, GOLD, 1); set(-1, 2, 4, GOLD, 1); set(0, 2, 4, GOLD, 1);
    }, { centre: [0, 6, 0] });
    L.scene.add(this.bag);
    this.emb = new THREE.Group(); this.setClass(cls);
    for (let i = 0; i < 10; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x1a2a30, toneMapped: false })); L.scene.add(b); this.bar.push(b); }
  }
  /** rebuild the class emblem (the class's signature suit icon on a stone octagon) */
  setClass(cls: ClassId) {
    this.cls = cls; this.L.scene.remove(this.emb);
    const S = SUITS[CLASS_FACES[cls][5]];
    this.emb = voxModel(1, set => {
      for (let x = -7; x < 7; x++) for (let y = -7; y < 7; y++) if (Math.abs(x + 0.5) + Math.abs(y + 0.5) < 10.5) { set(x, y, -1, 0x3a3444); set(x, y, 0, Math.abs(x + 0.5) + Math.abs(y + 0.5) > 9 ? 0x8a8296 : 0x5a5266); }
      iconCells(set, S.icon, -5, -5, 1, 1, ch => (ch === 'd' ? { c: hexN(S.dark) } : ch === 'o' ? { c: hexN(S.accent || S.light), g: 1 } : { c: hexN(S.col) }));
    }, { centre: [0, 0, 0] });
    this.L.scene.add(this.emb);
  }

  /** an enemy died at `at` (world, chest height): `gold` coins worth (shown as coins of 1 / 5), `overkill` extra (red-gold), `xp` points */
  burst(at: THREE.Vector3, gold: number, xp: number, overkill = 0) {
    const coins = splitCoins(gold).slice(0, 16), red = splitCoins(overkill).slice(0, 10);
    const spawn = (value: number, isRed: boolean, i: number, n: number, delay: number) => {
      const a = (i / Math.max(1, n)) * TAU + R(-0.3, 0.3), sp = R(1.4, 2.6);
      const c: Coin = { p: at.clone(), v: V3(Math.cos(a) * sp, R(4.5, 6.5), Math.sin(a) * sp * 0.7 + 0.6), spin: R(8, 16), ax: V3(R(-1, 1), R(-0.2, 0.2), R(-1, 1)).normalize(), ang: R(0, 6), state: 'fly', t: 0, delay, value, red: isRed, from: V3(), mid: V3(), bounces: 0, ux: 0, uy: 0 };
      this.coins.push(c);
    };
    coins.forEach((v, i) => spawn(v, false, i, coins.length, 0));
    red.forEach((v, i) => spawn(v, true, i, red.length, 0.16));
    for (let i = 0; i < 18; i++) PADD.emit({ p: at.clone(), v: V3(R(-3, 3), R(1, 5), R(-3, 3)), s0: 0.12, s1: 0.02, life: R(0.3, 0.6), c0: new THREE.Color(0xfff0a0), c1: new THREE.Color(0xff9a20), bright: 2.4, tile: TILE.spark, grav: 6 });
    cue('coin', 0.8);
    // experience motes
    const nm = Math.min(12, Math.max(3, Math.round(xp / 2))), per = xp / nm;
    for (let i = 0; i < nm; i++) {
      const p = at.clone().add(V3(R(-0.4, 0.4), R(0, 0.6), R(-0.3, 0.3)));
      this.motes.push({ p: p.clone(), from: p.clone(), mid: V3(), t: 0, dur: R(0.7, 1.0), delay: 0.5 + i * 0.05, stage: 'hero', ux: 0, uy: 0, amount: per });
    }
  }
  /** add gold without a burst (rewards, relics): coins appear at the purse */
  addGold(n: number) { this.gold += n; this.bagSq.kick(16); cue('coin', 0.6); this.onGold(this.gold); }

  update(dt: number, time: number) {
    const L = this.L;
    // purse target in the world: the camera ray under the purse px, 4 units in
    const tgt = uiToWorld(this.purse.x, this.purse.y, 40, COIN_R * 2, 4).pos;
    let n = 0, nr = 0, nu = 0;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (c.delay > 0) { c.delay -= dt; continue; }
      c.t += dt;
      if (c.state === 'fly') {
        c.v.y -= 22 * dt; c.p.addScaledVector(c.v, dt); c.ang += c.spin * dt;
        if (c.p.y < COIN_R && c.v.y < 0) {
          c.p.y = COIN_R; c.bounces++;
          if (c.bounces === 1 || Math.random() < 0.6) { this.chimeT -= 1; if (this.chimeT <= 0) { cue('coin', 0.35); this.chimeT = 2; } }
          if (c.bounces >= 3 || Math.abs(c.v.y) < 1.2) { c.state = 'lie'; c.t = 0; c.v.set(0, 0, 0); }
          else { c.v.y = -c.v.y * 0.42; c.v.x *= 0.6; c.v.z *= 0.6; c.spin *= 0.5; }
        }
      } else if (c.state === 'lie') {
        c.ang += dt * 2.2; c.p.y = COIN_R;
        if (Math.random() < dt * 1.5) PADD.emit({ p: c.p.clone().add(V3(0, 0.12, 0)), s0: 0.14, s1: 0, life: 0.25, c0: new THREE.Color(0xffffff), bright: 2.2, tile: TILE.flare });
        const order = this.coins.filter(o => o.state === 'lie').indexOf(c);
        if (c.t > 0.55 + Math.max(0, order) * 0.04) { c.state = 'go'; c.t = 0; c.from.copy(c.p); c.mid.copy(c.p).lerp(tgt, 0.45); c.mid.y = Math.max(c.p.y, tgt.y) + 2.4; }
      } else if (c.state === 'go') {
        const k = Math.min(1, c.t / 0.62), e = ease.inCubic(k) * 0.7 + k * 0.3, a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, cc = e * e;
        c.p.set(c.from.x * a + c.mid.x * b + tgt.x * cc, c.from.y * a + c.mid.y * b + tgt.y * cc, c.from.z * a + c.mid.z * b + tgt.z * cc); c.ang += dt * 14;
        if (Math.random() < 0.6) PADD.emit({ p: c.p.clone(), s0: 0.08, s1: 0, life: 0.2, c0: new THREE.Color(c.red ? 0xff8a40 : 0xffe080), bright: 2, tile: TILE.pixel });
        if (k >= 0.8) { const sp = worldToUi(c.p); c.state = 'ui'; c.t = 0; c.ux = sp.x; c.uy = sp.y; }   // hand over to the UI layer
      } else {
        const k = Math.min(1, c.t / 0.12); c.ux = lerp(c.ux, this.purse.x, k); c.uy = lerp(c.uy, this.purse.y, k);
        if (k >= 1) {
          this.coins.splice(i, 1); this.gold += c.value; this.onGold(this.gold); this.bagSq.kick(c.value > 1 ? 14 : 8);
          this.chime = Math.min(1.6, this.chime + 0.06); cue('count', 0.4 + this.chime * 0.4, 1 + this.chime);
          this.sparks.burst(L.at(this.purse.x, this.purse.y - 10, 3), 4, L.px(120), L.px(4), c.red ? 0xff8a40 : 0xffd060, { life: 0.3 });
          if (!this.coins.some(o => o.state !== 'fly' || o.delay > 0) && !this.coins.length) { cue('coin', 1); after(0.05, () => { this.chime = 0; }); }
          continue;
        }
        const P = L.at(c.ux, c.uy, 2); this.q.setFromAxisAngle(c.ax, c.ang); this.m4.compose(P, this.q, V3(1, 1, 1).multiplyScalar(L.px(16) / (COIN_R * 2))); this.uiCoin.setMatrixAt(nu++, this.m4);
        continue;
      }
      this.q.setFromAxisAngle(c.ax, c.ang); this.m4.compose(c.p, this.q, V3(1, 1, 1));
      if (c.red) this.imRed.setMatrixAt(nr++, this.m4); else this.im.setMatrixAt(n++, this.m4);
    }
    this.im.count = n; this.imRed.count = nr; this.uiCoin.count = nu;
    this.im.instanceMatrix.needsUpdate = this.imRed.instanceMatrix.needsUpdate = this.uiCoin.instanceMatrix.needsUpdate = true;
    // experience motes
    const hero = this.heroAt();
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i]; if (m.delay > 0) { m.delay -= dt; PADD.emit({ p: m.p.clone(), s0: 0.1, s1: 0.04, life: 0.1, c0: new THREE.Color(0x7affff), bright: 2.2, tile: TILE.glow }); continue; }
      m.t += dt;
      if (m.stage === 'hero') {
        if (m.t === dt) { m.mid.copy(m.from).lerp(hero, 0.5); m.mid.y += 1.6 + R(-0.4, 0.6); m.mid.x += R(-1, 1); }
        const k = Math.min(1, m.t / m.dur), e = ease.inOut(k), a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e;
        m.p.set(m.from.x * a + m.mid.x * b + hero.x * c, m.from.y * a + m.mid.y * b + hero.y * c, m.from.z * a + m.mid.z * b + hero.z * c);
        PADD.emit({ p: m.p.clone(), s0: 0.16, s1: 0.03, life: 0.28, c0: new THREE.Color(0xc0ffff), c1: new THREE.Color(0x20c0d0), bright: 2.6, tile: TILE.glow });
        if (k >= 1) { const sp = worldToUi(m.p); m.stage = 'ui'; m.t = 0; m.ux = sp.x; m.uy = sp.y; PADD.emit({ p: m.p.clone(), s0: 0.5, s1: 0.1, life: 0.3, c0: new THREE.Color(0x7affff), bright: 2, tile: TILE.glow }); }
      } else {
        const k = Math.min(1, m.t / 0.45), e = ease.inCubic(k), x = lerp(m.ux, this.emblem.x, e), y = lerp(m.uy, this.emblem.y, e) - Math.sin(k * Math.PI) * 50;
        this.sparks.emit(L.at(x, y, 3), V3(), L.px(7), 0x5affff, 0.18);
        if (k >= 1) { this.motes.splice(i, 1); this.xp += m.amount; this.embSq.kick(8); cue('tick', 0.3); if (this.xp >= this.xpMax) { this.xp -= this.xpMax; this.level++; this.xpMax = Math.round(this.xpMax * 1.5); this.embSq.kick(30); this.sparks.burst(L.at(this.emblem.x, this.emblem.y, 3), 30, L.px(300), L.px(6), 0x7affff, { life: 0.6 }); cue('win', 0.5); this.onLevel(this.level); } }
      }
    }
    // purse + emblem + bar
    const sq = this.bagSq.step(0, dt);
    L.at(this.purse.x, this.purse.y, 0, this.bag.position); const bs = L.px(this.bagPx) / 12; this.bag.scale.set(bs * (1 + sq * 0.015), bs * (1 - sq * 0.02), bs);
    this.bag.rotation.set(-0.15, 0.5 + Math.sin(time * 0.8) * 0.15, Math.sin(time * 1.3) * 0.04);
    const es = this.embSq.step(0, dt); L.at(this.emblem.x, this.emblem.y, 0, this.emb.position); this.emb.scale.setScalar(L.px(48) / 14 * (1 + es * 0.012)); this.emb.rotation.set(-0.1, 0.35, 0);
    this.shownGold += (this.gold - this.shownGold) * Math.min(1, dt * 10); if (Math.abs(this.gold - this.shownGold) < 0.5) this.shownGold = this.gold;
    this.shownXp += (this.xp - this.shownXp) * Math.min(1, dt * 6);
    const f = this.shownXp / this.xpMax;
    this.bar.forEach((b, i) => { L.at(this.emblem.x - 36 + i * 8, this.emblem.y + 36, 0, b.position); b.scale.set(L.px(6), L.px(6), L.px(4)); (b.material as THREE.MeshBasicMaterial).color.setHex(i < Math.floor(f * 10 + 0.001) ? 0x5affff : 0x1a2a30).multiplyScalar(i < Math.floor(f * 10 + 0.001) ? 1.5 : 1); });
    this.sparks.update(dt);
    this.bag.visible = this.visible; this.emb.visible = this.showEmblem && this.visible; for (const b of this.bar) b.visible = this.showEmblem && this.visible;
    if (this.showEmblem) { L.text.set('loot.gold', { text: String(Math.round(this.shownGold)), x: this.purse.x + 34, y: this.purse.y + 4, cell: 4, color: '#ffe08a', align: 'left' }); L.text.set('loot.lv', { text: String(this.level), x: this.emblem.x + 30, y: this.emblem.y - 26, cell: 3, color: '#bfffff', align: 'left' }); }
    else { L.text.hide('loot.gold'); L.text.hide('loot.lv'); }
  }
}

/** gold → coin values (5s first, then 1s); the drawn coins are what you get */
export function splitCoins(n: number) { const out: number[] = []; let r = Math.max(0, Math.round(n)); while (r >= 5 && out.length < 6) { out.push(5); r -= 5; } while (r > 0) { out.push(1); r--; } return out; }
