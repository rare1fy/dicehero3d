// R6 高清像素 2D 画笔（UX_V3 §6b）：在 overlay 画布上按「美术像素格」作画。1 格 = GRID.u 个设备像素（整数），所以每格边缘锐利；
// 只画横平竖直和 1:1 台阶，平涂 2～4 档，1u 深色描边、1u 高光。文字：粗体方正数字（pixDigits）+ Fusion Pixel 12px 中文（v2/pix.ts，
// 每个字体像素 = 整数个设备像素）。所有坐标、尺寸单位都是「格」。
import { GRID } from './pixelGrid';
import { eachDigitCell, digitsW, DIGIT_H } from './pixDigits';
import { drawPix, pixW, PIX_H } from '../v2/pix';
import type { Pane } from '../v2/overlay';

export type G2 = CanvasRenderingContext2D;
export type Mask = (x: number, y: number) => boolean;

/** 八角 / 切角矩形的格子遮罩（w×h 格，四角按 1:1 台阶切掉 cut 格） */
export function cutMask(w: number, h: number, cut: number): Mask {
  return (x, y) => x >= 0 && y >= 0 && x < w && y < h && Math.min(x, w - 1 - x) + Math.min(y, h - 1 - y) >= cut;
}
/** 格子到遮罩外沿的「八角距离」（0 = 最外一圈） */
export function cutDist(w: number, h: number, cut: number) {
  return (x: number, y: number) => { const a = Math.min(x, w - 1 - x), b = Math.min(y, h - 1 - y); return Math.min(a, b, a + b - cut); };
}

export class PixPen {
  /** u = 设备像素 / 格；(ox, oy) = 原点（格） */
  constructor(public g: G2, public u = GRID.u, public ox = 0, public oy = 0) { g.imageSmoothingEnabled = false; }
  /** 一块实心矩形（格） */
  rect(x: number, y: number, w: number, h: number, col: string) { if (w <= 0 || h <= 0) return; const u = this.u; this.g.fillStyle = col; this.g.fillRect((this.ox + x) * u, (this.oy + y) * u, w * u, h * u); }
  cell(x: number, y: number, col: string) { this.rect(x, y, 1, 1, col); }
  /** 按遮罩逐行填色（行内连续格合并成一次 fillRect） */
  fill(x: number, y: number, w: number, h: number, m: Mask, col: string | ((cx: number, cy: number) => string | null)) {
    for (let j = 0; j < h; j++) {
      let run = -1, rc: string | null = null;
      for (let i = 0; i <= w; i++) {
        const c = i < w && m(i, j) ? (typeof col === 'string' ? col : col(i, j)) : null;
        if (c !== rc) { if (rc && run >= 0) this.rect(x + run, y + j, i - run, 1, rc); run = i; rc = c; }
      }
    }
  }
  /**
   * 像素框：1u 深色描边（line）、本体（fill）、上沿 1u 高光（hi）、下沿 1u 暗边（lo），四角切 cut 格（1:1 台阶；cut = 1 即
   * 圆角胶囊的像素写法）。alpha 仅作用于本体（深色半透明底）。
   */
  box(x: number, y: number, w: number, h: number, o: { fill: string; line?: string | null; hi?: string | null; lo?: string | null; cut?: number; rim?: string | null }) {
    const cut = o.cut ?? 1, outer = cutMask(w, h, cut), inner = cutMask(w - 2, h - 2, Math.max(0, cut - 1));
    // 只画圈，不叠在本体下面（本体可以是半透明深色）
    if (o.line !== null) this.fill(x, y, w, h, (i, j) => outer(i, j) && !inner(i - 1, j - 1), o.line ?? '#0a0710');
    const ix = x + 1, iy = y + 1, iw = w - 2, ih = h - 2;
    if (o.rim) {   // 1u 彩色内沿（可操作 = 金；按类别着色）
      const r2 = cutMask(iw - 2, ih - 2, Math.max(0, cut - 2));
      this.fill(ix, iy, iw, ih, (i, j) => inner(i, j) && !r2(i - 1, j - 1), o.rim);
      this.fill(ix + 1, iy + 1, iw - 2, ih - 2, r2, o.fill);
    } else this.fill(ix, iy, iw, ih, inner, o.fill);
    if (o.hi) this.fill(ix, iy, iw, 1, (i, j) => inner(i, j), o.hi);
    if (o.lo) this.fill(ix, iy + ih - 1, iw, 1, (i) => inner(i, ih - 1), o.lo);
  }
  /** 像素图标：rows 每个字符一格，pal 给颜色（'.' 或未定义 = 透明）；outline = 先把每格外扩 1 格画一遍深色描边 */
  icon(rows: string[], x: number, y: number, pal: Record<string, string>, o: { outline?: string | null; scale?: number; shadow?: string | null } = {}) {
    const s = o.scale ?? 1;
    const each = (fn: (cx: number, cy: number, ch: string) => void) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const ch = r[i]; if (ch !== '.' && pal[ch]) fn(i, j, ch); } });
    if (o.shadow) each((i, j) => this.rect(x + i * s + s, y + j * s + s, s, s, o.shadow!));
    if (o.outline !== null) { const ol = o.outline ?? '#0a0710'; each((i, j) => this.rect(x + i * s - 1, y + j * s - 1, s + 2, s + 2, ol)); }
    each((i, j, ch) => this.rect(x + i * s, y + j * s, s, s, pal[ch]));
  }
  /** 粗体方正数字：(x, y) = 左上（align 改锚点）；scale = 每个字格占几格；1 格深色描边 + 1 格下投影 */
  digits(t: string, x: number, y: number, o: { col: string; line?: string | null; shadow?: string | null; scale?: number; align?: 'left' | 'center' | 'right'; hi?: string | null }) {
    const s = o.scale ?? 1, w = digitsW(t) * s, x0 = o.align === 'center' ? x - Math.floor(w / 2) : o.align === 'right' ? x - w : x;
    if (o.shadow !== null) eachDigitCell(t, (i, j) => this.rect(x0 + i * s, y + j * s + s + (o.line === null ? 0 : 1), s, s, o.shadow ?? 'rgba(0,0,0,0.55)'));
    if (o.line !== null) eachDigitCell(t, (i, j) => this.rect(x0 + i * s - 1, y + j * s - 1, s + 2, s + 2, o.line ?? '#0a0710'));
    eachDigitCell(t, (i, j) => this.rect(x0 + i * s, y + j * s, s, s, o.col));
    if (o.hi) eachDigitCell(t, (i, j) => { if (j === 0) this.rect(x0 + i * s, y, s, Math.max(1, s >> 1), o.hi!); });
    return w;
  }
  /**
   * Fusion Pixel 中文 / 字母：fp = 每个字体像素占几个设备像素（整数，≥ 1）；(x, y) 为格坐标（左上，align 改锚点）。
   * 描边为 1 个字体像素的四向深色（字体像素 = 1u 时就是 1u 描边）。返回宽（格，向上取整）。
   */
  text(t: string, x: number, y: number, o: { col: string; fp?: number; line?: string | null; align?: 'left' | 'center' | 'right'; shadow?: string | null; thin?: boolean }) {
    const fp = Math.max(1, Math.round(o.fp ?? this.u)), u = this.u, wDev = pixW(t) * fp;
    let px = (this.ox + x) * u; if (o.align === 'center') px -= wDev / 2; else if (o.align === 'right') px -= wDev;
    px = Math.round(px); const py = Math.round((this.oy + y) * u);
    if (o.shadow) drawPix(this.g, t, px, py + fp, { scale: fp, color: o.shadow, outline: null });
    // thin = a 1-device-px outline (small labels: a full font-pixel outline would close the counters of 口 etc.)
    const thin = o.thin ?? fp < u, line = o.line === null ? null : o.line ?? '#0a0710';
    if (line && thin) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) drawPix(this.g, t, px + dx, py + dy, { scale: fp, color: line, outline: null });
    drawPix(this.g, t, px, py, { scale: fp, color: o.col, outline: thin ? null : line });
    return Math.ceil(wDev / u);
  }
}

/** 文字尺寸（格）：fp 个设备像素 / 字体像素 */
export const textCellsW = (t: string, fp: number) => Math.ceil((pixW(t) * fp) / GRID.u);
export const textCellsH = (fp: number) => Math.ceil((PIX_H * fp) / GRID.u);
export const digitCellsW = (t: string, scale = 1) => digitsW(t) * scale;
export const DIGIT_CELLS_H = DIGIT_H;
/** 标签字号：大数字 1u；标签用更小的整数倍（u ≥ 4 时取 u/2，手机上至少 1 个设备像素 = Fusion Pixel 原生 12px） */
export const labelFp = () => Math.max(1, Math.floor(GRID.u / 2));
export const bigFp = () => GRID.u;

/** 在一个 Pane 上按格作画：pane 尺寸 = 格数 × u（设备像素），nearest 采样，不缩放 */
export function paintCells(p: Pane, key: string, cw: number, ch: number, draw: (pen: PixPen) => void) {
  const u = GRID.u, dpr = GRID.dpr;
  p.smooth = false; p.scale = 1;
  p.paint(key + '|u' + u, (cw * u) / dpr, (ch * u) / dpr, g => draw(new PixPen(g, u)));
}
