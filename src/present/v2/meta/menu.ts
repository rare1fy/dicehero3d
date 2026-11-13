// Console-style menu kit (title, pause, settings, confirm…): a vertical list with one focused item, driven by touch, mouse,
// keyboard (↑↓←→ / Enter / Esc) and gamepad (D-pad or left stick / A / B; Start is pause, handled by the caller). Drawn with the
// overlay's pixel panels and the Fusion Pixel font (overlay.ts / pix.ts): notched stone panels, 1-cell rims, gold only on the focus.
// Runs on real time (performance.now), so it animates while the game clock is frozen by the pause.
import * as THREE from 'three';
import { type Overlay, type Pane, panel, text, textW, PIX_H } from '../overlay';
import { cue } from '../../../audio/cues';

export type MenuItem =
  | { kind: 'btn'; id: string; label: string; sub?: string; on: () => void; enabled?: boolean; danger?: boolean }
  | { kind: 'opt'; id: string; label: string; values: string[]; get: () => number; set: (i: number) => void }
  | { kind: 'head'; label: string };
export interface MenuOpts {
  title: string; subtitle?: string; items: MenuItem[];
  /** Esc / B / the back row */
  onBack?: () => void;
  /** 'center' (pause, confirm), 'side' (settings: a wide scrolling sheet), 'title' (logo top-left, list in a left column) */
  layout?: 'center' | 'side' | 'title';
  /** background dim (0 = see-through, for the title over the 3D scene) */
  dim?: number;
  /** extra lines under the list (credits, key help, confirm text) */
  notes?: string[];
}
export type MenuKey = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back';

const GOLD = '#ffd890', BODY = 'rgba(18,12,24,0.92)', RIM = '#6a5a7a', RIM_F = '#e8b060';
interface Row { p: Pane; i: number; x: number; y: number; w: number; h: number }

export class Menu {
  on = false; private o: MenuOpts | null = null; private f = 0; private t = 0; private last = 0;
  private panes: Pane[] = []; private rows: Row[] = []; private heads: Array<{ p: Pane; y: number }> = [];
  private dim: THREE.Mesh; private hover = -1; private padPrev: Record<string, boolean> = {}; private padRep = 0;
  /** scrolling sheet: list viewport (CSS px) and offset */
  private view = { top: 0, bot: 0, off: 0 };
  constructor(private ov: Overlay) {
    this.dim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x05030a, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false }));
    this.dim.renderOrder = 80; this.dim.visible = false; ov.scene.add(this.dim);
  }
  open(o: MenuOpts, focus?: string) {
    this.close(); this.o = o; this.on = true; this.t = 0; this.view.off = 0;
    const first = o.items.findIndex((_, i) => this.selectableIn(o, i));
    const want = focus ? o.items.findIndex(it => it.kind !== 'head' && it.id === focus) : -1;
    this.f = want >= 0 ? want : Math.max(0, first);
    this.build();
  }
  close() { for (const p of this.panes) this.ov.drop(p); this.panes = []; this.rows = []; this.heads = []; this.on = false; this.o = null; this.dim.visible = false; }
  /** rebuild after a resize */
  refresh() { if (this.o) this.build(); }

  private sizes() {
    const fp = this.ov.fp, o = this.o!;
    const s1 = Math.max(1, Math.round(fp)), s2 = Math.max(2, Math.round(fp * (o.layout === 'side' ? 1.25 : 1.5)));
    const sLogo = Math.max(3, Math.round(fp * (o.layout === 'title' ? 5 : 2.4)));
    return { s1, s2, sLogo };
  }
  private rowH(it: MenuItem) {
    const { s1, s2 } = this.sizes();
    if (it.kind === 'head') return it.label ? PIX_H * s1 + 14 : 8;
    const sub = it.kind === 'btn' && it.sub ? PIX_H * s1 + 6 : 0;
    return Math.round(PIX_H * s2 + sub + (this.o!.layout === 'side' ? 16 : 22));
  }
  private build() {
    const o = this.o!, ov = this.ov, W = ov.w, H = ov.h, k = ov.dpr;
    for (const p of this.panes) ov.drop(p); this.panes = []; this.rows = []; this.heads = [];
    const dimA = o.dim ?? 0.62; this.dim.visible = dimA > 0; (this.dim.material as THREE.MeshBasicMaterial).opacity = dimA;
    this.dim.scale.set(W, H, 1); this.dim.position.set(W / 2, -H / 2, 0);
    const { s1, sLogo } = this.sizes(), lay = o.layout ?? 'center', gap = 8;
    const w = lay === 'side' ? Math.min(820, W - 120) : lay === 'title' ? Math.min(520, Math.max(360, W * 0.34)) : Math.min(520, Math.max(380, W * 0.4));
    const x = lay === 'title' ? Math.max(40, Math.round(W * 0.07)) : Math.round((W - w) / 2);
    // title block
    const logoH = PIX_H * sLogo, subGap = Math.round(sLogo * 3 + 10), titleH = logoH + (o.subtitle ? subGap + PIX_H * s1 : 0) + 12;
    const tw = Math.max(textW(o.title, sLogo), o.subtitle ? textW(o.subtitle, s1) : 0) + 40;
    const tp = ov.pane(81); tp.paint('mt' + o.title + (o.subtitle ?? '') + sLogo + W, tw, titleH, g => {
      const ax = lay === 'title' ? 'left' : 'center', tx = lay === 'title' ? 4 * k : (tw * k) / 2;
      text(g, o.title, tx, 4 * k, sLogo * k, lay === 'title' ? '#ffe2a0' : GOLD, ax);
      if (o.subtitle) text(g, o.subtitle, tx, (4 + logoH + subGap) * k, s1 * k, '#c8b8d8', ax);
    });
    const footH = PIX_H * s1 + 16, listTop0 = lay === 'title' ? Math.round(H * 0.08) + titleH + 28 : 0;
    const listH = o.items.reduce((a, it) => a + this.rowH(it) + (it.kind === 'head' ? 0 : gap), 0), notesH = o.notes ? o.notes.length * (PIX_H * s1 + 8) + 16 : 0;
    let ty: number;
    if (lay === 'title') ty = Math.round(H * 0.08);
    else { const total = titleH + 18 + listH + notesH; ty = Math.max(14, Math.round((H - footH - 24 - total) / 2)); }
    tp.at(lay === 'title' ? x : W / 2 - tw / 2, ty); this.panes.push(tp);
    // list viewport: scroll when it does not fit (settings)
    const top = lay === 'title' ? listTop0 : ty + titleH + 18, bot = H - footH - 28 - notesH;
    this.view = { top, bot, off: this.view.off };
    let y = top;
    o.items.forEach((it, i) => {
      const h = this.rowH(it);
      if (it.kind === 'head') {
        if (it.label) { const p = ov.pane(81); p.paint('mh' + it.label + w, w, h, g => { text(g, it.label, 4 * k, 6 * k, s1 * k, '#a898c0'); g.fillStyle = 'rgba(168,152,192,0.35)'; g.fillRect((textW(it.label, s1) + 14) * k, (h / 2) * k, (w - textW(it.label, s1) - 20) * k, Math.max(1, k)); }); this.panes.push(p); this.heads.push({ p, y }); p.at(x, y); }
        y += h; return;
      }
      const p = ov.pane(82); this.panes.push(p); this.rows.push({ p, i, x, y, w, h }); y += h + gap;
    });
    if (o.notes) {
      const p = ov.pane(81), nw = lay === 'side' ? w : Math.min(W - 80, Math.max(w, ...o.notes.map(l => textW(l, s1) + 24)));
      p.paint('mn' + o.notes.join('|') + nw, nw, notesH, g => { o.notes!.forEach((l, j) => text(g, l, 8 * k, (8 + j * (PIX_H * s1 + 8)) * k, s1 * k, '#c8b8d8')); });
      p.at(lay === 'side' ? x : W / 2 - nw / 2, Math.min(y + 4, H - footH - 24 - notesH)); this.panes.push(p);
    }
    // footer: control prompts
    const foot = '↑↓ 选择   ←→ 调整   确认 Enter / A   返回 Esc / B', fw = textW(foot, s1) + 28;
    const fpn = ov.pane(81); fpn.paint('mf' + fw, fw, footH, g => { panel(g, 0, 0, fw * k, footH * k, 2 * k, { body: 'rgba(10,6,14,0.82)', rim: '#4a3a5a', line: '#07050a', hi: 'rgba(255,255,255,0.04)' }); text(g, foot, (fw * k) / 2, 8 * k, s1 * k, '#c8b8d8', 'center'); });
    fpn.at(W / 2 - fw / 2, H - footH - 14); this.panes.push(fpn);
    this.scrollTo(this.f); this.paintRows();
  }
  /** keep the focused row inside the viewport */
  private scrollTo(i: number) {
    const r = this.rows.find(x => x.i === i); if (!r) return;
    const v = this.view, y0 = r.y - v.off, y1 = y0 + r.h;
    if (y1 > v.bot) v.off += y1 - v.bot; if (y0 < v.top) v.off -= v.top - y0; v.off = Math.max(0, v.off);
    for (const row of this.rows) { const yy = row.y - v.off; row.p.at(row.x, yy); row.p.visible = yy >= v.top - 2 && yy + row.h <= v.bot + 2; }
    for (const hd of this.heads) { const yy = hd.y - v.off; hd.p.at(hd.p.x, yy); hd.p.visible = yy >= v.top - 2 && yy <= v.bot; }
  }
  private paintRows() {
    const o = this.o!, k = this.ov.dpr, { s1, s2 } = this.sizes(), side = o.layout === 'side', left = side || o.layout === 'title';
    for (const r of this.rows) {
      const it = o.items[r.i] as Exclude<MenuItem, { kind: 'head' }>, foc = r.i === this.f, en = it.kind !== 'btn' || it.enabled !== false;
      const val = it.kind === 'opt' ? it.values[it.get()] ?? '' : '', sub = it.kind === 'btn' ? it.sub ?? '' : '';
      r.p.paint(['mr', it.id, it.label, val, sub, foc, en, r.w, r.h].join('|'), r.w, r.h, g => {
        const W = r.w * k, H = r.h * k, c = 3 * k;
        panel(g, 0, 0, W, H, c, { body: foc ? 'rgba(48,34,22,0.96)' : BODY, rim: foc ? RIM_F : RIM, line: '#07050a', hi: foc ? 'rgba(255,220,150,0.14)' : 'rgba(255,255,255,0.04)' });
        const col = !en ? '#6a6070' : it.kind === 'btn' && it.danger ? '#ff9a8a' : foc ? '#fff0c8' : '#e0d4ec';
        const ty = sub ? 9 * k : (H - PIX_H * s2 * k) / 2, lx = left ? 26 * k : W / 2;
        if (foc) { g.fillStyle = GOLD; const b = Math.max(2, Math.round(2 * k)), cx = 10 * k, cy = ty + (PIX_H * s2 * k) / 2; for (let j = -2; j <= 2; j++) g.fillRect(cx + (2 - Math.abs(j)) * b, cy + j * b - b / 2, b, b); }
        if (it.kind === 'opt') {
          text(g, it.label, lx, ty, s2 * k, col);
          const aw = textW('▶', s2) * k, rx = W - 18 * k, vw = textW(val, s2) * k, vx = rx - aw - 12 * k - vw;   // ◀ value ▶, right-aligned, no overlap
          text(g, '▶', rx, ty, s2 * k, foc ? GOLD : '#8a7a9a', 'right');
          text(g, val, vx, ty, s2 * k, foc ? '#ffe6a0' : '#d8c8e8');
          text(g, '◀', vx - 12 * k, ty, s2 * k, foc ? GOLD : '#8a7a9a', 'right');
        } else {
          text(g, it.label, lx, ty, s2 * k, col, left ? 'left' : 'center');
          if (sub) text(g, sub, lx, ty + (PIX_H * s2 + 5) * k, s1 * k, en ? '#b8a8c8' : '#5a5060', left ? 'left' : 'center');
        }
      });
    }
  }
  private selectableIn(o: MenuOpts, i: number) { const it = o.items[i]; return !!it && it.kind !== 'head' && (it.kind !== 'btn' || it.enabled !== false); }
  private selectable(i: number) { return !!this.o && this.selectableIn(this.o, i); }
  key(k: MenuKey) {
    if (!this.on || !this.o) return false;
    const o = this.o, it = o.items[this.f];
    if (k === 'up' || k === 'down') {
      const d = k === 'up' ? -1 : 1; let i = this.f;
      for (let n = 0; n < o.items.length; n++) { i = (i + d + o.items.length) % o.items.length; if (this.selectable(i)) break; }
      if (i !== this.f) { this.f = i; cue('click', 0.3); this.scrollTo(i); this.paintRows(); }
    } else if ((k === 'left' || k === 'right') && it?.kind === 'opt') {
      const n = it.values.length; it.set((it.get() + (k === 'left' ? -1 : 1) + n) % n); cue('click', 0.4); this.paintRows();
    } else if (k === 'ok' && it) {
      if (it.kind === 'btn' && it.enabled !== false) { cue('select', 0.6); it.on(); }
      else if (it.kind === 'opt') { const n = it.values.length; it.set((it.get() + 1) % n); cue('click', 0.4); this.paintRows(); }
    } else if (k === 'back' && o.onBack) { cue('click', 0.4); o.onBack(); }
    return true;
  }
  private rowAt(x: number, y: number) { return this.rows.find(r => r.p.visible && x >= r.x && x <= r.x + r.w && y >= r.p.y && y <= r.p.y + r.h) ?? null; }
  private dragY: number | null = null;
  pointer(type: string, x: number, y: number) {
    if (!this.on || !this.o) return false;
    const r = this.rowAt(x, y);
    if (type === 'down') { this.dragY = y; return true; }
    if (type === 'move') {
      if (this.dragY != null && Math.abs(y - this.dragY) > 6 && this.o.layout === 'side') { this.view.off = Math.max(0, this.view.off - (y - this.dragY)); this.dragY = y; this.scrollTo(-1); this.reflow(); return true; }
      const h = r && this.selectable(r.i) ? r.i : -1; if (h >= 0 && h !== this.f) { this.f = h; this.paintRows(); } return true;
    }
    if (type !== 'up') { this.dragY = null; return true; }
    const was = this.dragY; this.dragY = null;
    if (!r || !this.selectable(r.i) || (was != null && Math.abs(y - was) > 12)) return true;
    this.f = r.i; const it = this.o.items[r.i];
    if (it.kind === 'opt') { const n = it.values.length, lefthalf = x < r.x + r.w * 0.5; it.set((it.get() + (lefthalf ? -1 : 1) + n) % n); cue('click', 0.4); this.paintRows(); }
    else if (it.kind === 'btn') { cue('select', 0.6); it.on(); }
    return true;
  }
  private reflow() { const v = this.view, last = this.rows[this.rows.length - 1]; if (last) v.off = Math.min(v.off, Math.max(0, last.y + last.h - v.bot)); for (const row of this.rows) { const yy = row.y - v.off; row.p.at(row.x, yy); row.p.visible = yy >= v.top - 2 && yy + row.h <= v.bot + 2; } for (const hd of this.heads) { const yy = hd.y - v.off; hd.p.at(hd.p.x, yy); hd.p.visible = yy >= v.top - 2 && yy <= v.bot; } }
  /** gamepad: D-pad / left stick / A / B */
  private pollPad(dt: number) {
    const pads = (globalThis.navigator as Navigator | undefined)?.getGamepads?.() ?? [];
    const p = Array.from(pads).find(x => x && x.connected); if (!p) return;
    const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0, b = (i: number) => !!p.buttons[i]?.pressed;
    const now: Record<string, boolean> = { up: b(12) || ay < -0.6, down: b(13) || ay > 0.6, left: b(14) || ax < -0.6, right: b(15) || ax > 0.6, ok: b(0), back: b(1) };
    this.padRep -= dt;
    for (const key of Object.keys(now) as MenuKey[]) {
      const held = now[key], was = this.padPrev[key], dir = key === 'up' || key === 'down' || key === 'left' || key === 'right';
      if (held && (!was || (dir && this.padRep <= 0))) { this.key(key); this.padRep = was ? 0.12 : 0.35; if (!this.on) break; }
    }
    this.padPrev = now;
  }
  /** call every frame; the dt argument is ignored (real time is measured here, the game clock may be frozen) */
  update(_dt?: number) {
    const now = (globalThis.performance?.now?.() ?? Date.now()) / 1000, dt = this.last ? Math.min(0.1, now - this.last) : 0; this.last = now;
    if (!this.on) return;
    this.t += dt; const a = Math.min(1, this.t / 0.18);
    for (const p of this.panes) p.alpha = a;
    this.pollPad(dt);
  }
}
