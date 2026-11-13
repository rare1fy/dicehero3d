// Console-style menu kit (title, pause, settings, confirm…): a vertical list with one focused item, driven by touch, mouse,
// keyboard (↑↓←→ / Enter / Esc) and gamepad (D-pad or left stick / A / B / Start). Drawn with the same pixel panels and pixel font as
// the rest of the overlay (overlay.ts), so it reads as part of the HUD: notched stone panels, 1-cell rims, gold only on the focus.
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
  /** 'center' (title, pause) or 'side' (settings: a wide sheet) */
  layout?: 'center' | 'side';
  /** background dim (0 = see-through, for the title over the 3D scene) */
  dim?: number;
  /** extra lines under the list (credits, key help) */
  notes?: string[];
  /** the logo screen: big title */
  big?: boolean;
}
export type MenuKey = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back';

const GOLD = '#ffd890', BODY = 'rgba(18,12,24,0.92)', RIM = '#6a5a7a', RIM_F = '#e8b060';

export class Menu {
  on = false; private o: MenuOpts | null = null; private f = 0; private t = 0;
  private panes: Pane[] = []; private rows: Array<{ p: Pane; i: number; x: number; y: number; w: number; h: number }> = [];
  private dim: THREE.Mesh; private hover = -1; private padPrev: Record<string, boolean> = {}; private padRep = 0;
  constructor(private ov: Overlay) {
    this.dim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x05030a, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false }));
    this.dim.renderOrder = 80; this.dim.visible = false; ov.scene.add(this.dim);
  }
  open(o: MenuOpts, focus?: string) {
    this.close(); this.o = o; this.on = true; this.t = 0;
    const sel = o.items.map((it, i) => ({ it, i })).filter(x => x.it.kind !== 'head' && (x.it.kind !== 'btn' || x.it.enabled !== false));
    this.f = focus ? Math.max(0, o.items.findIndex(it => it.kind !== 'head' && it.id === focus)) : sel[0]?.i ?? 0;
    this.build();
  }
  close() { for (const p of this.panes) this.ov.drop(p); this.panes = []; this.rows = []; this.on = false; this.o = null; this.dim.visible = false; }
  /** rebuild after a resize or a value change */
  refresh() { if (this.o) this.build(); }
  private build() {
    const o = this.o!, ov = this.ov, W = ov.w, H = ov.h, k = ov.dpr, fp = ov.fp;
    for (const p of this.panes) ov.drop(p); this.panes = []; this.rows = [];
    const dimA = o.dim ?? 0.62; this.dim.visible = dimA > 0; (this.dim.material as THREE.MeshBasicMaterial).opacity = dimA;
    this.dim.scale.set(W, H, 1); this.dim.position.set(W / 2, -H / 2, 0);
    const s1 = Math.max(1, Math.round(fp)), s2 = Math.max(2, Math.round(fp * 2)), s3 = Math.max(3, Math.round(fp * (o.big ? 5 : 2.6)));
    const side = o.layout === 'side', rowH = Math.round(PIX_H * s1 * 2.4 + 14), headH = Math.round(PIX_H * s1 * 1.6 + 10);
    const w = side ? Math.min(760, W - 120) : Math.min(420, W * 0.42), x = side ? (W - w) / 2 : (W - w) / 2;
    const listH = o.items.reduce((a, it) => a + (it.kind === 'head' ? headH : rowH + 8), 0);
    const titleH = Math.round(PIX_H * s3 + (o.subtitle ? PIX_H * s1 + 14 : 0) + 24), notesH = o.notes ? o.notes.length * (PIX_H * s1 + 8) + 16 : 0;
    let y = Math.max(16, Math.round((H - titleH - listH - notesH - 40) / (o.big ? 1.6 : 2)));
    // title
    const tw = Math.max(textW(o.title, s3), o.subtitle ? textW(o.subtitle, s1) : 0) + 60;
    const tp = ov.pane(81); tp.paint('mt' + o.title + (o.subtitle ?? '') + s3 + W, tw, titleH, g => {
      text(g, o.title, (tw * k) / 2, 8 * k, s3 * k, o.big ? '#ffe2a0' : GOLD, 'center');
      if (o.subtitle) text(g, o.subtitle, (tw * k) / 2, (8 + PIX_H * s3 + 12) * k, s1 * k, '#c8b8d8', 'center');
    }); tp.at(W / 2 - tw / 2, y); this.panes.push(tp); y += titleH + 8;
    // rows
    o.items.forEach((it, i) => {
      if (it.kind === 'head') {
        const p = ov.pane(81); p.paint('mh' + it.label + w, w, headH, g => { text(g, it.label, 6 * k, 6 * k, s1 * k, '#a898c0'); g.fillStyle = 'rgba(168,152,192,0.35)'; g.fillRect((textW(it.label, s1) + 16) * k, (headH / 2) * k, (w - textW(it.label, s1) - 22) * k, Math.max(1, k)); });
        p.at(x, y); this.panes.push(p); y += headH; return;
      }
      const p = ov.pane(82); this.panes.push(p); this.rows.push({ p, i, x, y, w, h: rowH }); y += rowH + 8;
    });
    if (o.notes) {
      const nh = notesH, p = ov.pane(81); p.paint('mn' + o.notes.join('|') + w, w, nh, g => { o.notes!.forEach((l, j) => text(g, l, 6 * k, (8 + j * (PIX_H * s1 + 8)) * k, s1 * k, '#b8a8c8')); });
      p.at(x, y + 4); this.panes.push(p);
    }
    // footer: control prompts (console convention)
    const foot = '↑↓ 选择   ←→ 调整   确认 Enter / A   返回 Esc / B', fw = textW(foot, s1) + 28, fh = PIX_H * s1 + 16;
    const fpn = ov.pane(81); fpn.paint('mf' + fw, fw, fh, g => { panel(g, 0, 0, fw * k, fh * k, 2 * k, { body: 'rgba(10,6,14,0.8)', rim: '#4a3a5a', line: '#07050a', hi: 'rgba(255,255,255,0.04)' }); text(g, foot, (fw * k) / 2, 8 * k, s1 * k, '#c8b8d8', 'center'); });
    fpn.at(W / 2 - fw / 2, H - fh - 14); this.panes.push(fpn);
    this.paintRows();
  }
  private paintRows() {
    const o = this.o!, k = this.ov.dpr, fp = this.ov.fp, s1 = Math.max(1, Math.round(fp)), s2 = Math.max(2, Math.round(fp * 1.5));
    for (const r of this.rows) {
      const it = o.items[r.i] as Exclude<MenuItem, { kind: 'head' }>, foc = r.i === this.f || r.i === this.hover, en = it.kind !== 'btn' || it.enabled !== false;
      const val = it.kind === 'opt' ? it.values[it.get()] ?? '' : '', sub = it.kind === 'btn' ? it.sub ?? '' : '';
      r.p.paint(['mr', it.id, it.label, val, sub, foc, en, r.w, r.h].join('|'), r.w, r.h, g => {
        const W = r.w * k, H = r.h * k;
        panel(g, 0, 0, W, H, 3 * k, { body: foc ? 'rgba(48,34,22,0.95)' : BODY, rim: foc ? RIM_F : RIM, line: '#07050a', hi: foc ? 'rgba(255,220,150,0.14)' : 'rgba(255,255,255,0.04)' });
        const col = !en ? '#6a6070' : it.kind === 'btn' && it.danger ? '#ff9a8a' : foc ? '#fff0c8' : '#e0d4ec', ty = (H - PIX_H * s2 * k) / 2 - (sub ? PIX_H * s1 * k * 0.55 : 0);
        if (foc) { g.fillStyle = GOLD; const c = 3 * k, cx = 12 * k, cy = H / 2; for (let j = -2; j <= 2; j++) g.fillRect(cx + (2 - Math.abs(j)) * c * 0.5, cy + j * c - c / 2, c, c); }   // ▶ caret in blocks
        if (it.kind === 'opt') {
          text(g, it.label, 30 * k, ty, s2 * k, col);
          const vw = textW(val, s2) * k, vx = W - 30 * k - vw;
          text(g, '◀', vx - textW('◀', s2) * k - 12 * k, ty, s2 * k, foc ? GOLD : '#8a7a9a'); text(g, val, vx, ty, s2 * k, foc ? '#ffe6a0' : '#d8c8e8'); text(g, '▶', W - 24 * k, ty, s2 * k, foc ? GOLD : '#8a7a9a', 'right');
        } else {
          text(g, it.label, o.layout === 'side' ? 30 * k : W / 2, ty, s2 * k, col, o.layout === 'side' ? 'left' : 'center');
          if (sub) text(g, sub, o.layout === 'side' ? 30 * k : W / 2, ty + (PIX_H * s2 + 6) * k, s1 * k, en ? '#b8a8c8' : '#5a5060', o.layout === 'side' ? 'left' : 'center');
        }
      });
      r.p.at(r.x, r.y);
    }
  }
  private selectable(i: number) { const it = this.o!.items[i]; return !!it && it.kind !== 'head' && (it.kind !== 'btn' || it.enabled !== false); }
  key(k: MenuKey) {
    if (!this.on || !this.o) return false;
    const o = this.o, it = o.items[this.f];
    if (k === 'up' || k === 'down') {
      const d = k === 'up' ? -1 : 1; let i = this.f;
      for (let n = 0; n < o.items.length; n++) { i = (i + d + o.items.length) % o.items.length; if (this.selectable(i)) break; }
      if (i !== this.f) { this.f = i; this.hover = -1; cue('click', 0.3); this.paintRows(); }
    } else if ((k === 'left' || k === 'right') && it?.kind === 'opt') {
      const n = it.values.length, v = (it.get() + (k === 'left' ? -1 : 1) + n) % n; it.set(v); cue('click', 0.4); this.paintRows();
    } else if (k === 'ok' && it) {
      if (it.kind === 'btn' && it.enabled !== false) { cue('select', 0.6); it.on(); }
      else if (it.kind === 'opt') { const n = it.values.length; it.set((it.get() + 1) % n); cue('click', 0.4); this.paintRows(); }
    } else if (k === 'back' && o.onBack) { cue('click', 0.4); o.onBack(); }
    return true;
  }
  private rowAt(x: number, y: number) { return this.rows.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) ?? null; }
  pointer(type: string, x: number, y: number) {
    if (!this.on || !this.o) return false;
    const r = this.rowAt(x, y);
    if (type === 'move') { const h = r && this.selectable(r.i) ? r.i : -1; if (h !== this.hover) { this.hover = h; if (h >= 0) this.f = h; this.paintRows(); } return true; }
    if (type !== 'up' || !r || !this.selectable(r.i)) return true;
    this.f = r.i; const it = this.o.items[r.i];
    if (it.kind === 'opt') { const n = it.values.length, left = x < r.x + r.w * 0.5; it.set((it.get() + (left ? -1 : 1) + n) % n); cue('click', 0.4); this.paintRows(); }
    else if (it.kind === 'btn') { cue('select', 0.6); it.on(); }
    return true;
  }
  /** gamepad: D-pad / left stick / A / B (Start is handled by the caller as pause) */
  pollPad(dt: number) {
    if (!this.on) return;
    const pads = (globalThis.navigator as Navigator | undefined)?.getGamepads?.() ?? [];
    const p = Array.from(pads).find(x => x && x.connected); if (!p) return;
    const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0, b = (i: number) => !!p.buttons[i]?.pressed;
    const now: Record<string, boolean> = { up: b(12) || ay < -0.6, down: b(13) || ay > 0.6, left: b(14) || ax < -0.6, right: b(15) || ax > 0.6, ok: b(0), back: b(1) };
    this.padRep -= dt;
    for (const key of Object.keys(now) as MenuKey[]) {
      const held = now[key], was = this.padPrev[key];
      if (held && (!was || ((key === 'up' || key === 'down' || key === 'left' || key === 'right') && this.padRep <= 0))) { this.key(key); this.padRep = was ? 0.12 : 0.35; }
    }
    this.padPrev = now;
  }
  update(dt: number) { if (!this.on) return; this.t += dt; const a = Math.min(1, this.t / 0.18); for (const p of this.panes) p.alpha = a; this.pollPad(dt); }
}
