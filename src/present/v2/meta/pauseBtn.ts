// The pause button (top-right corner, console convention: Start / Esc does the same). A small notched pixel stone with two bars;
// its hit area is padded to 88 reference px for thumbs (UX_V3 §1b).
import { type Overlay, type Pane, panel } from '../overlay';

export class PauseButton {
  p: Pane; private r = { x: 0, y: 0, w: 1, h: 1 }; on = false; private pressed = false;
  constructor(private ov: Overlay) { this.p = ov.pane(30); this.p.visible = false; }
  layout(W: number, safeRight: number, k: number) {
    const s = Math.round(44 * Math.max(0.8, k)), x = W - safeRight - s - Math.round(18 * k), y = Math.round(14 * k);
    this.r = { x, y, w: s, h: s }; this.paint(); this.p.at(x, y);
  }
  private paint() {
    const k = this.ov.dpr, s = this.r.w;
    this.p.paint('pause' + s + this.pressed, s, s, g => {
      const S = s * k, c = Math.max(2, Math.round(S / 16));
      panel(g, 0, this.pressed ? c : 0, S, S - c, 2 * c, { body: this.pressed ? '#2a2034' : '#1c1624', rim: '#8a7a9a', line: '#07050a', hi: 'rgba(255,255,255,0.08)' });
      if (!this.pressed) { g.fillStyle = '#07050a'; g.fillRect(c, S - c, S - 2 * c, c); }   // a 1-cell base under the stone = thickness
      g.fillStyle = '#e8dcc8'; const bw = Math.round(S * 0.14), bh = Math.round(S * 0.42), y = Math.round((S - bh) / 2) + (this.pressed ? c : -Math.round(c / 2));
      g.fillRect(Math.round(S * 0.3), y, bw, bh); g.fillRect(Math.round(S * 0.7) - bw, y, bw, bh);
    });
  }
  show(on: boolean) { this.on = on; this.p.visible = on; }
  /** padded hit test (≥ 88 ref px around the 44 px stone) */
  hit(x: number, y: number) { if (!this.on) return false; const pad = 22, r = this.r; return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad; }
  press(on: boolean) { if (this.pressed !== on) { this.pressed = on; this.paint(); } }
}
