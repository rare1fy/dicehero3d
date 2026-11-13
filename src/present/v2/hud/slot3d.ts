// One skill slot of the R5 skill bar, three layers (UX_V3 2b): the plate (octagon stone + rim + energy ring + tier rays + the icon's
// shadow on the face), the floating icon (its own top-level group in the UI layer so the perspective tilts it on its own and the
// lift shows parallax), and the front layer (tier lamps and the pattern badge in 3D; the tag capsule, value pill, target portrait and
// the tier-2 extra icon as crisp overlay panes). `big` (0..1) morphs a small slot into the play button.
import * as THREE from 'three';
import type { UiLayer } from '../../ui3d/layer';
import { lampMat, Spring, UiSparks } from '../../ui3d/vox';
import type { Overlay, Pane } from '../overlay';
import { glowRing, skillIcon, patternBadge, modelLook } from './models';
import { PixPlate } from './pixPlate';
import { lampRow } from './pixParts';
import { GRID, PAL } from '../../ui3d/pixelGrid';
import type { PixModel } from '../../ui3d/pixMesh';
import { pill, label, glyph, rr, type Glyph, type G } from './draw';
import { lerp, ease } from '../../engine/clock';
import { cue } from '../../../audio/cues';

export type SkillKind = 'basic' | 'same' | 'straight' | 'array';
export interface SlotDef { name: string; kind: SkillKind; tag: string; tagCol: string; /** tier-3 icon (升级版), if any */ up?: string; /** badge override ('handful' = 1–3 loose dice) */ badge?: string }
export interface SlotState { lit: boolean; tier: number; dead: boolean; ready: boolean; value?: number; targetKind?: string; targetId?: string; /** what the value is (damage = no mark) */ valKind?: 'dmg' | 'armor' | 'barrier' | 'heal'; all?: boolean; ultimate?: boolean; extra?: Glyph | null; /** rogue v4: this strike's combo bonus and whether it is the last strike */ combo?: { pct: number; last: boolean } | null }

const GOLD = 0xd8a040, GOLD2 = 0xffb02a, PALE = 0x8adcf0, IRON = 0x5a5866;
const TAG_COL: Record<string, string> = { 单体: '#f0e6d0', 控制: '#6ae0ff', 弹射: '#ffd84a', 爆发: '#ff9a40', 补骰: '#7ae07a', 防御: '#a8b8cc', 横扫: '#ffb050', 吸血: '#ff7a7a', 处决: '#ff6060', 群毒: '#8ae05a' };
export const tagColor = (t: string) => TAG_COL[t] || '#f0e6d0';

export class Slot3D {
  root = new THREE.Group(); iconG = new THREE.Group(); pp: PixPlate; private fx = new THREE.Group(); private lampsPix: PixModel; private icon: THREE.Object3D; private iconUp: THREE.Object3D | null = null;
  private shadow: THREE.Mesh; private ring: THREE.Mesh; private outer: THREE.Mesh; private rays = new THREE.Group(); private halo: THREE.Mesh;
  private lampBar = new THREE.Group(); private lamps: THREE.Mesh[] = []; private lampOn: THREE.MeshBasicMaterial; private lampOff: THREE.MeshBasicMaterial; private badge: THREE.Object3D;
  tag: Pane; val: Pane; tgt: Pane; ext: Pane; cmb: Pane;
  /** current / target px pose and morph */
  cx = 0; cy = 0; size = 80; tx = 0; ty = 0; ts = 80; big = 0; tBig = 0; dim = 0; tDim = 0; vis = 0; tVis = 1;
  st: SlotState = { lit: false, tier: 0, dead: false, ready: false }; press = 0; aimK = 0; k = 1;
  private lift = 4; private shownTier = 0; private bump = new Spring(500, 18); private popT = 1; private flashT = 0; private t = Math.random() * 6; private wave = 1;
  constructor(private L: UiLayer, private ov: Overlay, public def: SlotDef, private sparks: UiSparks) {
    // R6: the pixel plate (28 cells idle, 20 shrunk, 66×56 the play button, 48×40 two buttons side by side); root unit = 1 CSS px
    this.pp = new PixPlate([[28, 28], [20, 20], [66, 56], [48, 40]], { rim: PAL.iron, face: PAL.face }); this.root.add(this.pp.root, this.fx);
    this.lampsPix = lampRow(3, 3, 1); this.pp.root.add(this.lampsPix);
    this.halo = glowRing(0xffc040, 0.9, 1.22, 8, Math.PI * 2, Math.PI / 8); this.halo.position.z = -0.1; this.fx.add(this.halo);
    this.ring = glowRing(0x40e0ff, 1.12, 1.24, 72); this.ring.rotation.x = -1.18; this.ring.position.set(0, -0.32, 0); this.fx.add(this.ring);
    this.outer = glowRing(0xffa030, 1.28, 1.34, 8, Math.PI * 2, Math.PI / 8); this.outer.position.z = -0.05; this.fx.add(this.outer);
    for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALE).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); const a = i * Math.PI / 4; sp.position.set(Math.cos(a) * 1.18, Math.sin(a) * 1.18, -0.1); sp.rotation.z = a - Math.PI / 2; this.rays.add(sp); }
    this.fx.add(this.rays);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false })); this.shadow.position.z = 0.33; this.fx.add(this.shadow);
    // lamps: a dark bar on the top edge with three lamps
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.12), new THREE.MeshToonMaterial({ color: 0x14121c })); this.lampBar.add(bar);
    this.lampOn = lampMat(0x6ae8ff, 2.2); this.lampOff = new THREE.MeshBasicMaterial({ color: 0x3a3a48, toneMapped: false });
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 12).rotateX(Math.PI / 2), this.lampOff); l.position.set((i - 1) * 0.19, 0, 0.08); this.lampBar.add(l); this.lamps.push(l); }
    this.lampBar.position.set(0, 0.3, 0.36); this.fx.add(this.lampBar);
    this.badge = patternBadge(def.badge || def.kind); this.badge.scale.multiplyScalar(0.3); this.fx.add(this.badge);
    this.icon = skillIcon(def.name); this.iconG.add(this.icon);
    L.scene.add(this.root, this.iconG);
    this.tag = ov.pane(9, true); this.val = ov.pane(15, true); this.tgt = ov.pane(15, true); this.ext = ov.pane(15, true); this.cmb = ov.pane(15, true);
  }
  setDef(def: SlotDef) {
    if (def.name === this.def.name && def.kind === this.def.kind && def.up === this.def.up && def.badge === this.def.badge) { this.def = def; return; }
    this.def = def; this.iconG.remove(this.icon); this.icon = skillIcon(def.name); this.iconG.add(this.icon);
    if (this.iconUp) { this.iconG.remove(this.iconUp); this.iconUp = null; }
    this.fx.remove(this.badge); this.badge = patternBadge(def.badge || def.kind); this.badge.scale.multiplyScalar(0.3); this.fx.add(this.badge); this.tag.key = '';
  }
  set(s: SlotState) {
    const was = this.st; this.st = s;
    if (s.lit && !was.lit) { this.popT = 0; this.shownTier = 0; }
    if (s.lit && s.tier !== this.shownTier) {
      const up = s.tier > this.shownTier; this.shownTier = s.tier;
      if (up) { this.bump.kick(9); this.flashT = 1; cue('tick', 0.5 + s.tier * 0.15, 1 + s.tier * 0.2); if (s.tier >= 3) { this.wave = 0; cue('reveal', 1.2); this.sparks.burst(this.L.at(this.cx, this.cy, 4), 26, this.L.px(320), this.L.px(6), PALE, { life: 0.5 }); } }
    }
  }
  /** hit area ≥ 88 reference px (UX_V3 §1b) even when the slot looks small */
  hit(x: number, y: number) { const r = Math.max(44 * this.k, this.size * (this.big > 0.5 ? 0.62 : 0.55)); return this.vis > 0.5 && Math.abs(x - this.cx) < r * (1 + this.big * 0.15) && Math.abs(y - this.cy) < r; }
  /** where the drag arrow starts (top of the button) */
  top() { return { x: this.cx, y: this.cy - this.size * 0.4 }; }
  iconPx() { return this.L.toPx(this.iconG.position); }

  update(dt: number) {
    this.t += dt; const L = this.L, k = 1 - Math.exp(-dt * 14), s = this.st;
    this.cx = lerp(this.cx, this.tx, k); this.cy = lerp(this.cy, this.ty, k); this.size = lerp(this.size, this.ts, k);
    this.big = lerp(this.big, this.tBig, 1 - Math.exp(-dt * 12)); this.dim = lerp(this.dim, this.tDim, k); this.vis = lerp(this.vis, this.tVis, k);
    this.popT = Math.min(1, this.popT + dt / 0.3); this.flashT = Math.max(0, this.flashT - dt * 3); this.wave = Math.min(1, this.wave + dt / 0.5);
    const B = this.big, tier = s.lit ? Math.max(1, s.tier) : 0, bp = this.bump.step(0, dt), on = this.vis > 0.02;
    this.root.visible = this.iconG.visible = on;
    // plate pose: a little wider when it is the play button; pressed while aiming
    // R6: root unit = 1 CSS px; the pixel plate in art pixels (front face at z = 0), the older radius-1 extras in fx
    L.at(this.cx, this.cy, 0, this.root.position); this.root.scale.setScalar(L.px(1));
    const sc = this.size / 2 * (1 + bp * 0.012) * Math.max(0.01, this.vis), uc = GRID.uc;
    this.fx.scale.set(sc * (1 + B * 0.16), sc * (1.04 - B * 0.06), sc); this.fx.position.z = -0.34 * sc;
    this.pp.root.scale.setScalar(uc); this.pp.pressK = Math.min(1, this.press);
    const pv = this.pp.use(sc * 2 * (1 + B * 0.16) / uc, sc * 2 * (1.04 - B * 0.06) / uc);
    // rim / face by state (Figma 附录 A: 可用 = gold rim; dead = grey)
    this.pp.setRim(s.dead ? PAL.dead : B > 0.5 ? (tier >= 3 ? PAL.pale : tier === 2 ? PAL.goldHot : PAL.gold) : s.ready ? PAL.gold : PAL.iron);
    this.pp.dim(1 - this.dim * 0.45, B > 0.5 ? 1 + B * (0.12 + 0.1 * Math.sin(this.t * 4) + this.flashT * 0.5) : 1);
    this.pp.glowK = B * (0.55 + 0.2 * Math.sin(this.t * 3) + this.flashT * 0.5); this.pp.glowCol.setHex(tier >= 3 ? 0x80e0ff : 0xffb040);
    this.pp.outerK = B > 0.05 && tier >= 2 ? B * (0.5 + 0.3 * Math.sin(this.t * 6)) + this.flashT * 0.4 : 0; this.pp.outerCol.setHex(tier >= 3 ? 0x9ae8ff : 0xffa030);
    this.pp.update(); this.halo.visible = false; this.outer.visible = false;
    // pixel lamps on the top edge (big only): lit = tier
    this.lampsPix.visible = B > 0.3; this.lampsPix.position.set(0, pv.H / 2 - 1, 1); this.lampsPix.scale.setScalar(Math.max(0.01, B) * (1 + B * 0.6));
    for (let i = 0; i < 3; i++) this.lampsPix.setPal(1 + i, i < tier ? (tier >= 3 ? PAL.pale : PAL.cyan) : PAL.dead, i < tier ? 2.2 : 1);
    this.ring.visible = B > 0.05; this.ring.rotation.z = this.t * 0.8; (this.ring.material as THREE.MeshBasicMaterial).opacity = B * (0.65 + 0.2 * Math.sin(this.t * 5)) + this.aimK * 0.3;
    (this.ring.material as THREE.MeshBasicMaterial).color.setHex(this.aimK > 0.5 ? 0xff8a30 : 0x40e0ff);
    this.rays.visible = B > 0.05 && tier >= 3; this.rays.rotation.z = this.t * 0.4; this.rays.scale.setScalar(0.9 + 0.1 * Math.sin(this.t * 7) + (1 - this.wave) * 0.6);
    for (const r of this.rays.children) ((r as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = B * (0.8 - (1 - this.wave) * 0.3);
    // lamps (big only) and the badge (bottom edge when small, bottom-left corner when big; never scaled up)
    this.lampBar.visible = false;
    this.lamps.forEach((l, i) => { l.material = i < tier ? this.lampOn : this.lampOff; });
    const bs = 0.44 / (1 + B * 0.6); this.badge.scale.setScalar(bs); this.badge.position.set(lerp(0, -0.6, B), lerp(-0.8, -0.36, B), 0.42);
    // the floating icon: lift by state (dim 4 / ready 7 / tier 12 / 16 / 22 px), bob, spin on activation, tier-3 upgrade
    const liftT = s.dead || this.dim > 0.5 ? 4 : s.lit ? [12, 12, 16, 22][Math.min(3, tier)] : s.ready ? 7 : 5;
    this.lift = lerp(this.lift, liftT, k);
    const pop = this.popT < 1 ? Math.sin(this.popT * Math.PI) * 16 : 0, bob = Math.sin(this.t * Math.PI) * 2;
    const isz = Math.min(B > 0.5 ? 74*this.k : Infinity, this.size * lerp(0.56, 0.62, B) * (s.lit ? [1, 1.06, 1.12, 1.2][Math.min(3, tier)] : 1) * Math.max(0.01, this.vis) * (s.dead ? 0.8 : 1 - this.dim * 0.12));
    const ix = this.cx, iy = this.cy - lerp(this.lift * 0.4, this.size * 0.27, B) - (this.lift * 0.6 + pop + bob)*this.k;
    // in front of the plate face (front ≈ 0.17 × size) by the lift: the perspective shows the gap
    L.at(ix, iy, 0, this.iconG.position); this.iconG.position.z = L.px(isz * 0.16 + this.lift * 0.8 * this.k);
    const want = tier >= 3 && B > 0.5 && this.def.up ? 1 : 0;
    if (want && !this.iconUp) { this.iconUp = skillIcon(this.def.up!); this.iconG.add(this.iconUp); }
    this.icon.visible = !(want && this.iconUp); if (this.iconUp) this.iconUp.visible = !!want;
    const gl = s.dead ? 0.25 : s.lit ? [1.2, 1.2, 1.5, 1.9][Math.min(3, tier)] : s.ready ? 0.9 : 0.6, dm = s.dead ? 0.75 : this.dim * 0.6;
    modelLook(this.icon, gl, dm); if (this.iconUp) modelLook(this.iconUp, gl, dm); modelLook(this.badge, 1, s.dead ? 0.6 : this.dim * 0.4);
    this.iconG.scale.setScalar(L.px(isz));
    const spin = this.popT < 1 ? ease.inOut(this.popT) * Math.PI * 2 : 0;
    this.iconG.rotation.set(-0.15 + this.aimK * -0.25, Math.sin(this.t * 0.6) * 0.25 + spin, tier >= 3 && B > 0.5 ? 0.12 : 0);
    if(B>0.5) { // 根据实际模型包围盒限制最高点，三档冰晶也不会侵入结束按钮。
      this.iconG.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(this.iconG), top = L.toPx(new THREE.Vector3(this.iconG.position.x,box.max.y,box.max.z));
      const floor = this.cy-78*this.k; if(top.y<floor) this.iconG.position.y-=L.px(floor-top.y);
    }
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - B) * Math.max(0.15, 1 - this.lift / 30); this.shadow.scale.setScalar(Math.max(0.3, 1 - this.lift / 40));
    // the front layer (crisp panes)
    this.paintFront(B, tier);
  }
  private paintFront(B: number, tier: number) {
    const ov = this.ov, s = this.st, on = this.vis > 0.3;
    // tag capsule under the small slot
    const tw = 18 + this.def.tag.length * 17, th = 26;
    this.tag.paint(['g', this.def.tag, s.dead, this.dim > 0.5].join('|'), tw, th, (g: G, k) => { const c = tagColor(this.def.tag); pill(g, 1, 1, tw - 2, th - 2, k, { rim: s.dead ? 'rgba(120,110,130,0.4)' : c + 'aa', r: 9 }); label(g, this.def.tag, tw / 2, th / 2, 15, k, { col: s.dead ? '#8a8292' : c }); });
    this.tag.at(this.cx - tw / 2, this.cy + this.size * 0.55 + 3 + th * (this.k - 1) / 2); this.tag.scale = this.k; this.tag.alpha = on ? (1 - B) * (1 - this.dim * 0.4) * this.vis : 0; this.tag.visible = this.tag.alpha > 0.02;
    // value pill (big)
    const v = s.value != null && s.value > 0 ? String(s.value) : '', mk = s.valKind && s.valKind !== 'dmg' ? s.valKind : null, vw = 34 + v.length * 22 + (mk ? 26 : 0), vh = 46;
    const MK = { armor: ['shield', '#4a9aff'], barrier: ['ring', '#5ae0ff'], heal: ['heart', '#ff5a6a'] } as const;
    this.val.paint(['v', v, tier, mk].join('|'), vw, vh, (g: G, k) => { pill(g, 2, 2, vw - 4, vh - 4, k, { rim: 'rgba(255,230,170,0.55)', r: 16, rimW: 2 }); if (mk) glyph(g, MK[mk][0], 24, vh / 2, 26, k, MK[mk][1]); label(g, v, vw / 2 + (mk ? 12 : 0), vh / 2 + 1, 34, k, { grad: ['#ffffff', '#ffe6a8'] }); });
    this.val.at(this.cx - vw / 2, this.cy - vh / 2 + this.size * 0.13); this.val.scale = this.k * (0.85 + 0.15 * B) * (1 + this.bump.x * 0.01); this.val.alpha = v && on ? Math.max(0, B * 2 - 1) : 0; this.val.visible = this.val.alpha > 0.02;
    // target portrait (bottom right): one enemy, or a crowd when it hits all
    const n = s.all ? 3 : 1, pw = 44 + (n - 1) * 16, ph = 44;
    this.tgt.paint(['t', n, s.targetKind, s.targetId].join('|'), pw, ph, (g: G, k) => { for (let i = n - 1; i >= 0; i--) { foeHead(g, 22 + i * 16, 22, 19, k); if(!s.all) { const ic: Glyph = s.targetKind==='guardian'?'shield':s.targetKind==='caster'?'star':'skull'; glyph(g,ic,22,24,23,k,s.targetKind==='guardian'?'#7abfff':'#e4d7b8'); } } });
    this.tgt.at(this.cx + this.size * 0.42 - pw / 2 - (n - 1) * 8, this.cy + this.size * 0.12 - ph / 2); this.tgt.scale = this.k; this.tgt.alpha = on ? Math.max(0, B * 2 - 1) : 0; this.tgt.visible = this.tgt.alpha > 0.02;
    // tier-2 extra effect (e.g. 冻结) hung on the right edge
    const ex = s.extra && tier >= 2 ? s.extra : null;
    this.ext.paint(['x', ex].join('|'), 36, 36, (g: G, k) => { if (!ex) return; g.beginPath(); g.arc(18 * k, 18 * k, 16 * k, 0, Math.PI * 2); g.fillStyle = 'rgba(14,12,24,0.85)'; g.fill(); g.lineWidth = 2 * k; g.strokeStyle = '#ffb040'; g.stroke(); glyph(g, ex, 18, 18, 22, k, '#9ae8ff'); });
    // rogue v4: the combo dagger plaque hung on the button's upper left (orange 「末刀」 on the last strike)
    const cb = s.combo && (s.combo.pct > 0 || s.combo.last) ? s.combo : null, ct = cb ? (cb.last ? `末刀 +${cb.pct}%` : `+${cb.pct}%`) : '', cw = 40 + ct.length * 13, chh = 30;
    this.cmb.paint(['c', ct, cb?.last].join('|'), cw, chh, (g: G, k) => { if (!cb) return; const col = cb.last ? '#ff9a30' : '#d8b0ff'; pill(g, 1, 1, cw - 2, chh - 2, k, { rim: col, r: 8, rimW: 2 }); glyph(g, 'sword', 17, chh / 2, 20, k, col); label(g, ct, 30 + (cw - 34) / 2, chh / 2, 15, k, { col }); });
    this.cmb.scale = this.k; this.cmb.at(this.cx - this.size * 0.5 - cw / 2, this.cy - this.size * 0.42 - chh / 2); this.cmb.alpha = cb && on ? Math.max(0, B * 2 - 1) * (cb.last ? 0.75 + 0.25 * Math.sin(this.t * 8) : 1) : 0; this.cmb.visible = this.cmb.alpha > 0.02;
    this.ext.at(this.cx + this.size * 0.66 - 18, this.cy - this.size * 0.22 - 18); this.ext.scale = this.k; this.ext.alpha = ex && on ? Math.max(0, B * 2 - 1) : 0; this.ext.visible = this.ext.alpha > 0.02;
  }
  hideAll() { this.tVis = 0; }
  dispose() { this.L.scene.remove(this.root, this.iconG); this.pp.dispose(); for (const p of [this.tag, this.val, this.tgt, this.ext, this.cmb]) this.ov.drop(p); }
}

/** a small beast head (red eyes, ears) for the target portrait */
function foeHead(g: G, cx: number, cy: number, r: number, k: number) {
  g.save(); g.beginPath(); g.arc(cx * k, cy * k, r * k, 0, Math.PI * 2); g.fillStyle = 'rgba(16,12,24,0.9)'; g.fill(); g.lineWidth = 1.6 * k; g.strokeStyle = '#ff5a4a'; g.stroke();
  g.fillStyle = '#6a5a86'; g.beginPath(); g.moveTo((cx - r * 0.62) * k, (cy - r * 0.2) * k); g.lineTo((cx - r * 0.42) * k, (cy - r * 0.78) * k); g.lineTo((cx - r * 0.1) * k, (cy - r * 0.36) * k);
  g.lineTo((cx + r * 0.1) * k, (cy - r * 0.36) * k); g.lineTo((cx + r * 0.42) * k, (cy - r * 0.78) * k); g.lineTo((cx + r * 0.62) * k, (cy - r * 0.2) * k); g.lineTo((cx + r * 0.4) * k, (cy + r * 0.56) * k); g.lineTo((cx - r * 0.4) * k, (cy + r * 0.56) * k); g.closePath(); g.fill();
  g.fillStyle = '#ff3a2a'; g.shadowColor = '#ff2a1a'; g.shadowBlur = 4 * k; rr(g, (cx - r * 0.36) * k, (cy - r * 0.06) * k, r * 0.24 * k, r * 0.16 * k, 1); g.fill(); rr(g, (cx + r * 0.12) * k, (cy - r * 0.06) * k, r * 0.24 * k, r * 0.16 * k, 1); g.fill();
  g.restore();
}
