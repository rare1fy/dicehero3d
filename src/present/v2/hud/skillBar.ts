// R5 skill bar (bottom right, UX_V3 §2–3 + the approved mockup): four octagon slots in one row. Selecting dice that make a pattern
// slides the matched slot to the thumb position and grows it into the play button (tier lamps, value pill, target portrait, energy
// ring; tier 2 / 3 change its form); the others shrink to the left. Two matches (warrior) = two medium buttons. No match = a grey
// dashed disc with the selected dice in miniature. Press + drag = aim: the button stays (pressed, orange ring), the voxel arc arrow
// follows the finger. Data in, taps out; no rules here.
import * as THREE from 'three';
import type { UiLayer } from '../../ui3d/layer';
import { UiSparks } from '../../ui3d/vox';
import type { Overlay, Pane } from '../overlay';
import { Slot3D, type SlotDef, type SlotState } from './slot3d';
import { AimArrow } from './arrow';
import { paintCells, textCellsW, textCellsH, labelFp, bigFp, cutMask, cutDist, PANEL, type PixPen } from '../../ui3d/pixDraw';
import { INK } from './pixIcons';
import { paintNumeralFace } from '../../dice/numFace';
import { cue } from '../../../audio/cues';

export type { SlotDef, SlotState };
export interface TipDef { title: string; lines: string[] }

export class SkillBar {
  slots: Slot3D[] = []; defs: SlotDef[] = []; tips: TipDef[] = []; on = false; W = 1280; H = 720; k = 1;
  arrow: AimArrow; private sparks: UiSparks; private disc: Pane; private tip: Pane; tipOn = -1;
  private selVals: number[] = []; private discK = 0; private t = 0; private litWas = '';
  /** the slot being aimed (pressed) */
  aiming = -1;
  constructor(private L: UiLayer, private ov: Overlay) {
    this.arrow = new AimArrow(L); this.sparks = new UiSparks(L.scene, 120);
    this.disc = ov.pane(9); this.tip = ov.pane(12);
  }
  /** R0 = the right edge of the HUD region, top = the safe-area top */
  R0 = 1280; top = 0;
  layout(W: number, H: number, k: number, R0 = W, top = 0) { this.W = W; this.H = H; this.k = k; this.R0 = R0; this.top = top; this.place(); }
  show(on: boolean) { this.on = on; if (!on) { this.tipOn = -1; this.arrow.a = null; this.aiming = -1; } for (const s of this.slots) s.tVis = on ? 1 : 0; }
  setSlots(defs: SlotDef[], tips: TipDef[] = []) {
    this.defs = defs; this.tips = tips;
    while (this.slots.length < defs.length) { const s = new Slot3D(this.L, this.ov, defs[this.slots.length], this.sparks); this.slots.push(s); }
    while (this.slots.length > defs.length) this.slots.pop()!.dispose();
    defs.forEach((d, i) => { this.slots[i].setDef(d); this.slots[i].set({ lit: false, tier: 0, dead: false, ready: false }); });
    this.tipOn = -1; this.place(true);
  }
  /** per-slot state + the selection (count and values, for the no-match disc) */
  set(states: SlotState[], selVals: number[]) {
    states.forEach((s, i) => this.slots[i]?.set(s)); this.selVals = selVals.slice(0, 6);
    const key = this.slots.map(s => (s.st.lit ? 1 : 0) + (s.tVis > 0.5 ? 2 : 0)).join('') + '|' + (selVals.length > 0 ? 1 : 0);
    if (key !== this.litWas) { this.litWas = key; this.place(); }
  }
  /** the layout targets for the current mode (ref coords × k, right-anchored) */
  private place(snap = false) {
    // UX_V3 §1b (phone hold): idle slots 84 wide, gap 10, outer edge ≥ 64 from the right; the play button at (right − 200, 548);
    // shrunk slots ≥ 56; the thumb disc where the button would be. R(x) = x reference px in from the right edge.
    const k = this.k, R = (x: number) => this.R0 - x * k, Y = (y: number) => this.top + y * k;
    // slots the stage hid (tVis = 0, e.g. the warrior's 劈砍 while unlit) take no room in the row
    const shown = this.slots.map((_, i) => i).filter(i => !this.on || this.slots[i].tVis > 0.5), n = shown.length;
    const lit = shown.filter(i => this.slots[i].st.lit), none = !lit.length && this.selVals.length > 0;
    if (!lit.length && !none) {   // the resting row
      shown.forEach((i, j) => { const s = this.slots[i]; s.tx = R(106 + (n - 1 - j) * 94); s.ty = Y(598); s.ts = 84 * k; s.tBig = 0; s.tDim = 0; });
    } else {
      const big = lit.length, rest = shown.filter(i => !lit.includes(i)), bs = big > 1 ? 124 : 170, step = 148;
      lit.forEach((i, j) => { const s = this.slots[i]; s.tx = R(200 + (big - 1 - j) * step); s.ty = Y(big > 1 ? 556 : 548); s.ts = bs * k; s.tBig = 1; s.tDim = 0; });
      const edge = none ? 200 + 80 : 200 + (big - 1) * step + bs * 0.58;   // the left edge of the button(s) / disc
      rest.forEach((i, j) => { const s = this.slots[i]; s.tx = R(edge + 10 + 29 + (rest.length - 1 - j) * 66); s.ty = Y(600); s.ts = 58 * k; s.tBig = 0; s.tDim = none ? 0.55 : 0.25; });
    }
    if (snap) for (const s of this.slots) { s.cx = s.tx; s.cy = s.ty; s.size = s.ts; s.big = s.tBig; }
  }
  /** index of the play button under (x, y) (−1 = none) */
  hitButton(x: number, y: number) { if (!this.on) return -1; return this.slots.findIndex(s => s.st.lit && s.big > 0.5 && s.hit(x, y)); }
  hitSlot(x: number, y: number) { if (!this.on) return -1; return this.slots.findIndex(s => s.hit(x, y)); }
  toggleTip(i: number) { this.tipOn = this.tipOn === i ? -1 : i; cue('click', 0.4); }
  /** aiming: the pressed button stays, the arrow follows (x, y); hot = over a target */
  aim(i: number, x: number, y: number, hot: boolean, blocked = false) {
    const s = this.slots[i]; if (!s) return; if (this.aiming !== i) { this.aiming = i; cue('tick', 0.4); }
    const p = s.top(); this.arrow.a = { x0: p.x, y0: p.y, x1: x, y1: y, hot, blocked }; s.aim = { x, y };
  }
  endAim() { if (this.aiming >= 0 && this.slots[this.aiming]) this.slots[this.aiming].aim = null; this.aiming = -1; this.arrow.a = null; }
  /** the play left the button: a burst of light from the icon toward (x, y) */
  release(i: number, x: number, y: number) {
    const s = this.slots[i]; if (!s) return; const p = s.iconPx();
    for (let j = 0; j < 6; j++) { const f = j / 6; this.sparks.emit(this.L.at(p.x + (x - p.x) * f, p.y + (y - p.y) * f, 2), new THREE.Vector3(0, 0, 0), this.L.px(10 - j), 0xffe0a0, 0.35); }
    this.sparks.burst(this.L.at(p.x, p.y, 3), 20, this.L.px(260), this.L.px(6), 0xffd070, { life: 0.4 });
  }
  /** a release on nothing: the button wobbles */
  bounce(i: number) { const s = this.slots[i]; if (s) s.press = 0.6; }
  btnPx(i: number) { const s = this.slots[i]; return s ? { x: s.cx, y: s.cy } : null; }

  update(dt: number) {
    this.t += dt;
    for (const [i, s] of this.slots.entries()) {
      s.press += ((this.aiming === i ? 1 : 0) - s.press) * Math.min(1, dt * 14); s.aimK += ((this.aiming === i ? 1 : 0) - s.aimK) * Math.min(1, dt * 10);
      s.k = this.k; s.update(dt);
    }
    this.arrow.update(dt); this.sparks.update(dt);
    // the no-match disc at the thumb position: grey dashed ring + the selected dice in miniature
    const none = this.on && !this.slots.some(s => s.st.lit) && this.selVals.length > 0;
    this.discK += ((none ? 1 : 0) - this.discK) * Math.min(1, dt * 12);
    const vals = this.selVals.join(','), dc = 50;
    paintCells(this.disc, 'd' + vals, dc, dc, pen => drawDisc(pen, dc, this.selVals));
    this.disc.at(Math.round(this.R0 - 200 * this.k - this.disc.w / 2), Math.round(this.top + 548 * this.k - this.disc.h / 2)); this.disc.scale = 1;
    this.disc.alpha = this.discK; this.disc.visible = this.discK > 0.02;
    this.drawTip();
  }
  private drawTip() {
    const i = this.tipOn, td = this.tips[i], s = this.slots[i];
    if (!this.on || !td || !s) { this.tip.visible = false; return; }
    const fp = labelFp(), bf = Math.max(fp, bigFp() >> 1), lh = textCellsH(fp) + 1, w = Math.max(textCellsW(td.title, bf), ...td.lines.map(l => textCellsW(l, fp))) + 8, h = textCellsH(bf) + 8 + td.lines.length * lh;
    paintCells(this.tip, 'tip2' + i + td.title + td.lines.join('|') + fp, w + 1, h + 1, pen => {
      const P = PANEL.tip; pen.panel(0, 0, w, h, P, 2);
      pen.text(td.title, 4, 3, { col: P.title, fp: bf });
      pen.rect(4, 4 + textCellsH(bf), w - 8, 1, P.edge!);   // a 1u rule under the title
      td.lines.forEach((l, j) => pen.text(l, 4, 6 + textCellsH(bf) + j * lh, { col: P.text, fp }));
    });
    const tw = this.tip.w, th = this.tip.h;
    // right edge a little left of the slot's centre: clear of the end-turn button and its label above the thumb column
    this.tip.at(Math.round(Math.max(8, s.cx - tw - s.size * 0.1)), Math.round(Math.max(8, s.cy - s.size * 0.6 - th - 10))); this.tip.visible = true;
  }
}

/** the no-match disc (art cells): a grey dashed octagon ring (1-cell dashes on the grid) + the selected dice as numeral faces */
function drawDisc(pen: PixPen, dc: number, vals: number[]) {
  const cut = Math.round(dc * 0.29), inner = cutMask(dc - 4, dc - 4, cut - 1), ring = cutDist(dc, dc, cut);
  pen.fill(2, 2, dc - 4, dc - 4, inner, 'rgba(20,18,28,0.55)');
  pen.fill(0, 0, dc, dc, (x, y) => { const d = ring(x, y); return d >= 1 && d <= 2 && Math.floor((x + y) / 4) % 2 === 0; }, 'rgba(190,186,200,0.75)');
  const n = vals.length, T = n > 4 ? 10 : 12, cols = n > 3 ? 3 : n, rows = Math.ceil(n / cols), gap = 2;
  vals.forEach((v, i) => {
    const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols);
    const x = Math.round(dc / 2 + (c - inRow / 2) * (T + gap) + gap / 2), y = Math.round(dc / 2 + (r - rows / 2) * (T + gap) + gap / 2);
    pen.rect(x + 1, y + 1, T, T, 'rgba(0,0,0,0.5)');
    paintNumeralFace(pen.g, (pen.ox + x) * pen.u, (pen.oy + y) * pen.u, T, Math.max(1, Math.min(6, v)), { px: pen.u, tone: 'dim', scale: 1 });
  });
}
