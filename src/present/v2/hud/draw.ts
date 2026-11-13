// R5 HUD: crisp 2D painting for overlay panes (device-resolution canvas, system bold font, no pixel font). Dark translucent rounded
// capsules (the one restrained frame style), outlined numbers, and small vector glyphs for intents and statuses (round icons with a
// thin arc = turns left and a corner number). All sizes are CSS px; `k` = device px per CSS px.
import { fontOf } from '../../hud/paint';

export type G = CanvasRenderingContext2D;

export function rr(g: G, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
/** the dark translucent capsule: soft shadow, dark body, faint light rim (gold / coloured rim only for what can be acted on) */
export function pill(g: G, x: number, y: number, w: number, h: number, k: number, o: { rim?: string; body?: string; r?: number; rimW?: number } = {}) {
  const r = (o.r ?? h / 2) * k; x *= k; y *= k; w *= k; h *= k;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 6 * k; g.shadowOffsetY = 2 * k;
  rr(g, x, y, w, h, r); g.fillStyle = o.body ?? 'rgba(18,16,28,0.78)'; g.fill(); g.restore();
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.02)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
  rr(g, x, y, w, h, r); g.fillStyle = gr; g.fill();
  g.lineWidth = (o.rimW ?? 1.6) * k; g.strokeStyle = o.rim ?? 'rgba(200,190,230,0.28)'; rr(g, x + g.lineWidth / 2, y + g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth, Math.max(0, r - g.lineWidth / 2)); g.stroke();
}
/** bold outlined text; (x, y) = anchor at the vertical middle */
export function label(g: G, t: string, x: number, y: number, size: number, k: number, o: { col?: string; align?: CanvasTextAlign; stroke?: string; sw?: number; weight?: number; grad?: [string, string] } = {}) {
  const s = size * k; g.font = fontOf(s, o.weight ?? 900); g.textAlign = o.align ?? 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = (o.sw ?? Math.max(2.5, size * 0.2)) * k; g.strokeStyle = o.stroke ?? 'rgba(8,6,14,0.95)'; g.strokeText(t, x * k, y * k + s * 0.04);
  if (o.grad) { const gr = g.createLinearGradient(0, y * k - s / 2, 0, y * k + s / 2); gr.addColorStop(0, o.grad[0]); gr.addColorStop(1, o.grad[1]); g.fillStyle = gr; } else g.fillStyle = o.col ?? '#fff';
  g.fillText(t, x * k, y * k + s * 0.04);
}
export function textWidth(g: G, t: string, size: number, k = 1, weight = 900) { g.font = fontOf(size * k, weight); return g.measureText(t).width / k; }

// ---------------------------------------------------------------- vector glyphs, drawn in a unit box centred on (cx, cy), size s (CSS px)
export type Glyph = 'lock' | 'sword' | 'shield' | 'boot' | 'snow' | 'skull' | 'star' | 'drop' | 'fire' | 'crystal' | 'ring' | 'tri' | 'broken' | 'swirl' | 'crack' | 'fist' | 'heart' | 'bolt';
export function glyph(g: G, kind: Glyph, cx: number, cy: number, s: number, k: number, col: string, col2 = '#ffffff') {
  const X = (u: number) => (cx + u * s) * k, Y = (v: number) => (cy + v * s) * k, L = (w: number) => w * s * k;
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  const shade = (c: string) => { const gr = g.createLinearGradient(0, Y(-0.5), 0, Y(0.5)); gr.addColorStop(0, col2); gr.addColorStop(0.35, c); gr.addColorStop(1, c); return gr; };
  const fillOut = (c: string | CanvasGradient) => { g.fillStyle = c; g.fill(); g.lineWidth = L(0.07); g.strokeStyle = 'rgba(8,6,14,0.9)'; g.stroke(); };
  g.beginPath();
  switch (kind) {
    case 'lock': { g.arc(X(0),Y(-0.16),L(0.25),Math.PI,0); g.lineWidth=L(0.12); g.strokeStyle=col; g.stroke(); rr(g,X(-0.36),Y(-0.06),L(0.72),L(0.5),L(0.08)); fillOut(col); g.fillStyle='#19202b'; g.fillRect(X(-0.04),Y(0.07),L(0.08),L(0.2)); break; }
    case 'sword': {   // blade up-right, crossguard, grip
      g.moveTo(X(0.42), Y(-0.46)); g.lineTo(X(0.46), Y(-0.42)); g.lineTo(X(-0.08), Y(0.14)); g.lineTo(X(-0.16), Y(0.06)); g.closePath(); fillOut(shade(col));
      g.beginPath(); g.moveTo(X(-0.3), Y(0.02)); g.lineTo(X(-0.02), Y(0.3)); g.lineWidth = L(0.12); g.strokeStyle = 'rgba(8,6,14,0.9)'; g.stroke(); g.lineWidth = L(0.07); g.strokeStyle = col; g.stroke();
      g.beginPath(); g.moveTo(X(-0.16), Y(0.16)); g.lineTo(X(-0.38), Y(0.38)); g.lineWidth = L(0.13); g.strokeStyle = 'rgba(8,6,14,0.9)'; g.stroke(); g.lineWidth = L(0.07); g.strokeStyle = '#8a5a32'; g.stroke(); break;
    }
    case 'shield': g.moveTo(X(0), Y(-0.46)); g.lineTo(X(0.38), Y(-0.32)); g.lineTo(X(0.34), Y(0.08)); g.quadraticCurveTo(X(0.26), Y(0.34), X(0), Y(0.48)); g.quadraticCurveTo(X(-0.26), Y(0.34), X(-0.34), Y(0.08)); g.lineTo(X(-0.38), Y(-0.32)); g.closePath(); fillOut(shade(col));
      g.beginPath(); g.moveTo(X(0), Y(-0.3)); g.lineTo(X(0), Y(0.32)); g.moveTo(X(-0.2), Y(-0.06)); g.lineTo(X(0.2), Y(-0.06)); g.lineWidth = L(0.07); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke(); break;
    case 'boot': g.moveTo(X(-0.26), Y(-0.46)); g.lineTo(X(0.1), Y(-0.46)); g.lineTo(X(0.1), Y(0.02)); g.quadraticCurveTo(X(0.46), Y(0.08), X(0.46), Y(0.3)); g.lineTo(X(0.46), Y(0.4)); g.lineTo(X(-0.26), Y(0.4)); g.closePath(); fillOut(shade(col));
      g.beginPath(); g.moveTo(X(-0.26), Y(-0.3)); g.lineTo(X(0.1), Y(-0.3)); g.lineWidth = L(0.07); g.strokeStyle = 'rgba(8,6,14,0.6)'; g.stroke(); break;
    case 'snow': case 'crystal': {
      if (kind === 'crystal') { g.moveTo(X(0), Y(-0.5)); g.lineTo(X(0.2), Y(-0.1)); g.lineTo(X(0.12), Y(0.44)); g.lineTo(X(-0.12), Y(0.44)); g.lineTo(X(-0.2), Y(-0.1)); g.closePath(); fillOut(shade(col));
        g.beginPath(); g.moveTo(X(-0.22), Y(0.0)); g.lineTo(X(-0.42), Y(0.2)); g.lineTo(X(-0.3), Y(0.44)); g.lineTo(X(-0.14), Y(0.3)); g.closePath(); fillOut(shade(col));
        g.beginPath(); g.moveTo(X(0.22), Y(-0.05)); g.lineTo(X(0.42), Y(0.12)); g.lineTo(X(0.32), Y(0.44)); g.lineTo(X(0.14), Y(0.32)); g.closePath(); fillOut(shade(col)); break; }
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.moveTo(X(Math.cos(a) * 0.44), Y(Math.sin(a) * 0.44)); g.lineTo(X(-Math.cos(a) * 0.44), Y(-Math.sin(a) * 0.44)); }
      g.lineWidth = L(0.2); g.strokeStyle = 'rgba(8,6,14,0.9)'; g.stroke(); g.lineWidth = L(0.1); g.strokeStyle = col; g.stroke(); break;
    }
    case 'skull': g.arc(X(0), Y(-0.06), L(0.38), Math.PI * 0.85, Math.PI * 2.15); g.lineTo(X(0.22), Y(0.42)); g.lineTo(X(-0.22), Y(0.42)); g.closePath(); fillOut(shade(col));
      g.beginPath(); g.arc(X(-0.14), Y(0.0), L(0.09), 0, Math.PI * 2); g.arc(X(0.14), Y(0.0), L(0.09), 0, Math.PI * 2); g.fillStyle = '#1a0e16'; g.fill(); break;
    case 'star': for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, r = i % 2 ? 0.16 : 0.48; (i ? g.lineTo : g.moveTo).call(g, X(Math.cos(a) * r), Y(Math.sin(a) * r)); } g.closePath(); fillOut(shade(col)); break;
    case 'drop': g.moveTo(X(0), Y(-0.48)); g.bezierCurveTo(X(0.18), Y(-0.2), X(0.36), Y(0.02), X(0.34), Y(0.18)); g.arc(X(0), Y(0.16), L(0.34), 0.06, Math.PI - 0.06); g.bezierCurveTo(X(-0.36), Y(0.02), X(-0.18), Y(-0.2), X(0), Y(-0.48)); fillOut(shade(col));
      g.beginPath(); g.arc(X(-0.12), Y(0.16), L(0.08), 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill(); break;
    case 'fire': g.moveTo(X(0), Y(-0.5)); g.bezierCurveTo(X(0.12), Y(-0.24), X(0.42), Y(-0.08), X(0.36), Y(0.2)); g.arc(X(0), Y(0.18), L(0.36), 0.05, Math.PI - 0.05); g.bezierCurveTo(X(-0.4), Y(-0.02), X(-0.22), Y(-0.18), X(-0.12), Y(-0.36)); g.quadraticCurveTo(X(-0.06), Y(-0.16), X(0.02), Y(-0.12)); g.closePath(); fillOut(shade(col));
      g.beginPath(); g.moveTo(X(0), Y(-0.06)); g.quadraticCurveTo(X(0.22), Y(0.14), X(0.14), Y(0.3)); g.arc(X(0), Y(0.28), L(0.15), 0.1, Math.PI - 0.1); g.closePath(); g.fillStyle = '#fff2a0'; g.fill(); break;
    case 'ring': g.ellipse(X(0), Y(0.04), L(0.44), L(0.2), 0, 0, Math.PI * 2); g.lineWidth = L(0.2); g.strokeStyle = 'rgba(8,6,14,0.9)'; g.stroke(); g.lineWidth = L(0.11); g.strokeStyle = col; g.stroke(); break;
    case 'tri': g.moveTo(X(0), Y(-0.44)); g.lineTo(X(0.46), Y(0.36)); g.lineTo(X(-0.46), Y(0.36)); g.closePath(); g.lineWidth = L(0.26); g.strokeStyle = 'rgba(8,6,14,0.9)'; g.stroke(); g.lineWidth = L(0.14); g.strokeStyle = col; g.stroke(); break;
    case 'broken': g.moveTo(X(0.42), Y(-0.46)); g.lineTo(X(0.46), Y(-0.42)); g.lineTo(X(0.14), Y(-0.1)); g.lineTo(X(0.06), Y(-0.18)); g.closePath(); fillOut(shade(col));
      g.beginPath(); g.moveTo(X(0.0), Y(-0.04)); g.lineTo(X(-0.12), Y(0.08)); g.lineTo(X(-0.04), Y(0.16)); g.closePath(); fillOut(shade(col));
      g.beginPath(); g.moveTo(X(-0.36), Y(0.0)); g.lineTo(X(0.0), Y(0.36)); g.moveTo(X(-0.18), Y(0.2)); g.lineTo(X(-0.4), Y(0.42)); g.lineWidth = L(0.12); g.strokeStyle = 'rgba(8,6,14,0.9)'; g.stroke(); g.lineWidth = L(0.06); g.strokeStyle = col; g.stroke(); break;
    case 'swirl': for (let i = 0; i < 3; i++) { g.moveTo(X(Math.cos(i * 2.1) * 0.12), Y(Math.sin(i * 2.1) * 0.12)); g.arc(X(0), Y(0), L(0.12 + i * 0.12), i * 2.1, i * 2.1 + 3.6); }
      g.lineWidth = L(0.16); g.strokeStyle = 'rgba(8,6,14,0.9)'; g.stroke(); g.lineWidth = L(0.08); g.strokeStyle = col; g.stroke(); break;
    case 'crack': g.moveTo(X(-0.1), Y(-0.46)); g.lineTo(X(0.12), Y(-0.12)); g.lineTo(X(-0.12), Y(0.08)); g.lineTo(X(0.1), Y(0.46)); g.lineWidth = L(0.2); g.strokeStyle = 'rgba(8,6,14,0.9)'; g.stroke(); g.lineWidth = L(0.1); g.strokeStyle = col; g.stroke(); break;
    case 'fist': rr(g, X(-0.34), Y(-0.2), L(0.68), L(0.5), L(0.12)); fillOut(shade(col)); g.beginPath(); g.moveTo(X(-0.12), Y(-0.2)); g.lineTo(X(-0.12), Y(0.06)); g.moveTo(X(0.1), Y(-0.2)); g.lineTo(X(0.1), Y(0.06)); g.lineWidth = L(0.05); g.strokeStyle = 'rgba(8,6,14,0.7)'; g.stroke(); break;
    case 'heart': g.moveTo(X(0), Y(0.42)); g.bezierCurveTo(X(-0.6), Y(0.0), X(-0.3), Y(-0.5), X(0), Y(-0.2)); g.bezierCurveTo(X(0.3), Y(-0.5), X(0.6), Y(0.0), X(0), Y(0.42)); fillOut(shade(col)); break;
    case 'bolt': g.moveTo(X(0.1), Y(-0.48)); g.lineTo(X(-0.26), Y(0.06)); g.lineTo(X(0.0), Y(0.06)); g.lineTo(X(-0.1), Y(0.48)); g.lineTo(X(0.28), Y(-0.08)); g.lineTo(X(0.02), Y(-0.08)); g.closePath(); fillOut(shade(col)); break;
  }
  g.restore();
}

/** a round status icon: translucent dark disc (no rim), the glyph, an outer thin arc = turns left (frac), a corner number */
export function statusIcon(g: G, cx: number, cy: number, r: number, k: number, o: { glyph: Glyph; col: string; arc: string; frac: number; n?: number | string; bad?: boolean }) {
  g.save();
  if (o.bad) { const gl = g.createRadialGradient(cx * k, cy * k, r * 0.4 * k, cx * k, cy * k, r * 1.35 * k); gl.addColorStop(0, 'rgba(255,40,30,0.35)'); gl.addColorStop(1, 'rgba(255,40,30,0)'); g.fillStyle = gl; g.beginPath(); g.arc(cx * k, cy * k, r * 1.35 * k, 0, Math.PI * 2); g.fill(); }
  const gr = g.createRadialGradient(cx * k, (cy - r * 0.3) * k, r * 0.1 * k, cx * k, cy * k, r * k); gr.addColorStop(0, 'rgba(40,36,56,0.82)'); gr.addColorStop(1, 'rgba(10,8,18,0.82)');
  g.beginPath(); g.arc(cx * k, cy * k, r * k, 0, Math.PI * 2); g.fillStyle = gr; g.fill();
  // the track and the turns-left arc
  g.lineCap = 'round'; g.lineWidth = Math.max(2, r * 0.13) * k;
  g.beginPath(); g.arc(cx * k, cy * k, (r - r * 0.08) * k, 0, Math.PI * 2); g.strokeStyle = 'rgba(255,255,255,0.10)'; g.stroke();
  if (o.frac > 0) { g.beginPath(); g.arc(cx * k, cy * k, (r - r * 0.08) * k, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, o.frac)); g.strokeStyle = o.arc; g.stroke(); }
  glyph(g, o.glyph, cx, cy, r * 1.15, k, o.col);
  if (o.n != null && o.n !== '') label(g, String(o.n), cx + r * 0.72, cy + r * 0.62, r * 0.72, k, { col: '#ffffff', sw: r * 0.2 });
  g.restore();
}
/** a soft horizontal line fading out at both ends (under the status rows) */
export function fadeLine(g: G, x: number, y: number, w: number, k: number, col: string, h = 2) {
  const gr = g.createLinearGradient(x * k, 0, (x + w) * k, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.25, col); gr.addColorStop(0.75, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(x * k, y * k, w * k, h * k);
}
