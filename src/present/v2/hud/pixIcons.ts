// R6 像素图标库（UX_V3 §6b）：hud/draw.ts 里 Glyph 的全部种类画成 9×9 格的像素图标（自动 1 格深色描边 → 占 11×11 格）。
// 字符行 + 2～3 档平涂（h 高光 / b 本色 / d 暗）+ 点缀色（a / A / c）+ 白闪（w）+ 内部深色（k）；只走横竖和正 45°，不画碎点。
// 用法：pixGlyph(pen, 'sword', x, y, { col }) —— (x, y) = 图标左上（格），描边在外面 1 格；pixGlyphC 以中心定位。
// 另有 3×5 小数字（角标层数 / 回合数，pixSmallDigits）和状态小牌（八角框 + 图标 + 角标，pixStatusChip）。
import type { Glyph } from './draw';
import type { PixPen } from '../../ui3d/pixDraw';
import { mixHex, cssHex } from '../../ui3d/pixelGrid';

export type PixGlyph = Glyph | 'excl' | 'coin' | 'dice';
/** 图标本体边长（格） */
export const GLYPH_N = 9;
/** 含 1 格描边的占位边长（格） */
export const GLYPH_BOX = GLYPH_N + 2;
export const INK = '#0a0710';

interface Art { col: string; acc?: string; rows: string[] }
// h 高光 b 本色 d 暗（由 col 推出）；A a c = 点缀色的高光 / 本色 / 暗（由 acc 推出）；w 白闪；k 深色细节
const ART: Record<PixGlyph, Art> = {
  lock: { col: '#b8c0d0', rows: [
    '..ddddd..',
    '.dd...dd.',
    '.d.....d.',
    '.d.....d.',
    'hhhhhhhhh',
    'bbbbkbbbb',
    'bbbbkbbbb',
    'bbbbbbbbb',
    'ddddddddd'] },
  sword: { col: '#dfe4ee', acc: '#e0a83a', rows: [
    '....w....',
    '...hbd...',
    '...hbd...',
    '...hbd...',
    '...hbd...',
    '.AAaaaac.',
    '....c....',
    '....c....',
    '...aac...'] },
  shield: { col: '#4a9aff', rows: [
    'hhhhhhhhd',
    'hbbbwdddd',
    'hbbbwdddd',
    'hbbbwdddd',
    'hbbbwdddd',
    '.hbbwddd.',
    '..hbwdd..',
    '...bwd...',
    '....d....'] },
  boot: { col: '#e0b860', acc: '#8a5a32', rows: [
    '.........',
    '.aaaaa...',
    '.hbbbd...',
    '.hbbbd...',
    '.hbbbbd..',
    '.hbbbbbd.',
    '.hbbbbbbd',
    '.cccccccc',
    '.........'] },
  snow: { col: '#a8d8ff', rows: [
    '....h....',
    '.b..h..b.',
    '..b.h.b..',
    '...bhb...',
    'hhhhwhhhh',
    '...bhb...',
    '..b.h.b..',
    '.b..h..b.',
    '....h....'] },
  skull: { col: '#e8e0d0', rows: [
    '.........',
    '..hhhhh..',
    '.hbbbbbd.',
    'hbbbbbbbd',
    'bkkbbbkkd',
    'bkkbbbkkd',
    'dbbbkbbbd',
    '.dbbbbbd.',
    '..bdbdb..'] },
  star: { col: '#ffe060', rows: [
    '....w....',
    '....h....',
    '...hhb...',
    'hhhhhbbbd',
    '.hhhbbbd.',
    '..hbbbd..',
    '..hbdbd..',
    '.hb...bd.',
    '.d.....d.'] },
  drop: { col: '#5ae03a', rows: [
    '....h....',
    '...hbb...',
    '...hbb...',
    '..hbbbd..',
    '.hwbbbbd.',
    '.hwbbbbd.',
    '.hbbbbbd.',
    '..dbbbd..',
    '...ddd...'] },
  fire: { col: '#ff7a20', acc: '#ffe060', rows: [
    '....h....',
    '...hb....',
    '...hbb.h.',
    '..hbbb.bd',
    '.hbbbbbbd',
    '.hbbabbbd',
    '.hbaAabbd',
    '..baAad..',
    '...dddd..'] },
  crystal: { col: '#8ad8ff', rows: [
    '....w....',
    '...hbb...',
    '...hbb...',
    '.h.hbb.b.',
    'hh.hbb.bd',
    'hb.hbd.bd',
    'hb.hbd.bd',
    'dd.hbd.dd',
    '...ddd...'] },
  ring: { col: '#5ae0ff', rows: [
    '.........',
    '.........',
    '..hhhhh..',
    '.hh...bb.',
    'hh.....bd',
    'bb.....dd',
    '.bd...dd.',
    '..ddddd..',
    '.........'] },
  tri: { col: '#ff4a3a', rows: [
    '.........',
    '....h....',
    '...hhb...',
    '..hh.bb..',
    '.hh...bb.',
    'hh.....bd',
    'hhhhbbbbd',
    'ddddddddd',
    '.........'] },
  broken: { col: '#c8c8d8', acc: '#a08a60', rows: [
    '......w..',
    '.....hbd.',
    '.....hbd.',
    '.........',
    '...h.d...',
    '...hbd...',
    '.AAaaaac.',
    '....c....',
    '...aac...'] },
  swirl: { col: '#b080ff', rows: [
    'hhhhhhhhb',
    'h.......b',
    'h.hhhhh.b',
    'h.h...b.b',
    'h.h.b.b.b',
    'h.h.bbb.b',
    'h.h.....b',
    'h.ddddddd',
    'h........'] },
  crack: { col: '#ff6a4a', rows: [
    'hhhhhhhhd',
    'hhhkhbbbd',
    'hhhhkbbbd',
    'hhhkbbbbd',
    'hhhhkbbbd',
    '.hhhkkbd.',
    '..hhhkd..',
    '...hbd...',
    '....d....'] },
  fist: { col: '#ff5a4a', rows: [
    '.........',
    '.hhhhhhh.',
    'hbdbdbdbd',
    'hbdbdbdbd',
    'hbbbbbbbd',
    'hhhhhbbbd',
    '.dbbbbbd.',
    '..bbbbd..',
    '..dddd...'] },
  heart: { col: '#ff5a6a', rows: [
    '.........',
    '.hh...bb.',
    'hwhb.bbbd',
    'hhbbbbbbd',
    'hbbbbbbbd',
    '.bbbbbbd.',
    '..bbbbd..',
    '...bbd...',
    '....d....'] },
  bolt: { col: '#ffe060', rows: [
    '.....hhb.',
    '....hhb..',
    '...hhb...',
    '..hhhhhb.',
    '....hhb..',
    '...hhb...',
    '..hhb....',
    '.hb......',
    '.b.......'] },
  // extras (not in draw.ts Glyph)
  excl: { col: '#ffffff', rows: [
    '...hhb...',
    '...hhb...',
    '...hhb...',
    '...hhb...',
    '...hhb...',
    '.........',
    '...hhb...',
    '...hbd...',
    '.........'] },
  coin: { col: '#ffc840', rows: [
    '..hhhhh..',
    '.hhbbbbd.',
    'hhbdddbbd',
    'hbbdbbbbd',
    'hbbdbbbbd',
    'hbbdbbbbd',
    'hbbbdddbd',
    '.bbbbbdd.',
    '..ddddd..'] },
  dice: { col: '#f0e8d8', rows: [
    'hhhhhhhhb',
    'hbbbbbbbd',
    'hbkbbbkbd',
    'hbbbbbbbd',
    'hbbbkbbbd',
    'hbbbbbbbd',
    'hbkbbbkbd',
    'hbbbbbbbd',
    'bdddddddd'] },
};

const hx = (s: string) => (s[0] === '#' && s.length === 7 ? parseInt(s.slice(1), 16) : -1);
/** 一个设计色的三档：高光 / 本色 / 暗 */
export function tones(col: string) {
  const c = hx(col); if (c < 0) return { h: col, b: col, d: col };
  return { h: cssHex(mixHex(c, 0xffffff, 0.45)), b: col, d: cssHex(mixHex(c, 0x0a0612, 0.42)) };
}
/** 默认主色 */
export const glyphCol = (k: PixGlyph) => ART[k]?.col ?? '#ffffff';
export const glyphRows = (k: PixGlyph) => ART[k]?.rows ?? [];

export interface GlyphOpts {
  /** 主色（h / b / d 三档由它推出） */
  col?: string;
  /** 点缀色（护手、火心…） */
  acc?: string;
  /** 每个图标格占几格（默认 1；大图标请优先用 1，保持 1 格 = 1 美术像素） */
  scale?: number;
  /** 描边色，null = 不描边（默认深色 1 格） */
  outline?: string | null;
  /** 1 格右下投影色（默认无） */
  shadow?: string | null;
  /** 单色剪影（所有格同一色，例如暗掉的待机态） */
  mono?: string;
  /** 0～1：往灰色靠（不可用 / 冷却） */
  dim?: number;
}

function palette(kind: PixGlyph, o: GlyphOpts) {
  const a = ART[kind], T = tones(o.col ?? a.col), A = tones(o.acc ?? a.acc ?? a.col);
  const pal: Record<string, string> = { h: T.h, b: T.b, d: T.d, A: A.h, a: A.b, c: A.d, w: '#fffaf0', k: INK };
  if (o.dim) { const g = 0x55525e; for (const ch in pal) { const v = hx(pal[ch]); if (v >= 0 && ch !== 'k') pal[ch] = cssHex(mixHex(v, g, Math.min(1, o.dim))); } }
  if (o.mono) for (const ch in pal) pal[ch] = o.mono;
  return pal;
}

/** 画一个像素图标：(x, y) = 图标左上（格），描边向外 1 格 */
export function pixGlyph(pen: PixPen, kind: PixGlyph, x: number, y: number, o: GlyphOpts = {}) {
  const a = ART[kind]; if (!a) return;
  pen.icon(a.rows, x, y, palette(kind, o), { scale: o.scale ?? 1, outline: o.outline === undefined ? INK : o.outline, shadow: o.shadow ?? null });
}
/** 以中心定位（cx, cy 为格坐标；9 格宽的图标落在 cx-4 … cx+4） */
export function pixGlyphC(pen: PixPen, kind: PixGlyph, cx: number, cy: number, o: GlyphOpts = {}) {
  const s = o.scale ?? 1, half = Math.floor((GLYPH_N * s) / 2);
  pixGlyph(pen, kind, cx - half, cy - half, o);
}
/** 图标尺寸（格）：含描边 */
export const glyphSize = (scale = 1) => ({ w: GLYPH_N * scale + 2, h: GLYPH_N * scale + 2, art: GLYPH_N * scale });

// ---------------------------------------------------------------- 3×5 小数字（角标）
export const SMALL_DIGITS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '..#', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'], '+': ['...', '.#.', '###', '.#.', '...'], '-': ['...', '...', '###', '...', '...'],
  'x': ['...', '#.#', '.#.', '#.#', '...'], '/': ['..#', '..#', '.#.', '#..', '#..'], ' ': ['.', '.', '.', '.', '.'],
};
export const SMALL_DIGIT_H = 5;
const sg = (ch: string) => SMALL_DIGITS[ch] || SMALL_DIGITS[' '];
/** 宽（格），字间 1 格；不含描边 */
export function smallDigitsW(t: string) { let w = 0; for (const ch of t) w += sg(ch)[0].length + 1; return Math.max(0, w - 1); }
/** 3×5 小数字：(x, y) = 左上（align 改锚点），1 格深色描边（line: null 关掉）；返回宽（格） */
export function pixSmallDigits(pen: PixPen, t: string, x: number, y: number, o: { col: string; line?: string | null; align?: 'left' | 'center' | 'right'; shadow?: string | null }) {
  const w = smallDigitsW(t), x0 = o.align === 'center' ? x - Math.floor(w / 2) : o.align === 'right' ? x - w : x;
  const each = (fn: (cx: number, cy: number) => void) => { let cx = 0; for (const ch of t) { const g = sg(ch); g.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') fn(cx + i, j); }); cx += g[0].length + 1; } };
  if (o.shadow) each((i, j) => pen.rect(x0 + i + 1, y + j + 2, 1, 1, o.shadow!));
  if (o.line !== null) each((i, j) => pen.rect(x0 + i - 1, y + j - 1, 3, 3, o.line ?? INK));
  each((i, j) => pen.rect(x0 + i, y + j, 1, 1, o.col));
  return w;
}

// ---------------------------------------------------------------- 状态小牌：八角框 + 图标 + 角标
export const CHIP = 13;
/**
 * 状态小牌（CHIP×CHIP 格）：深色半透明八角底、1 格深色描边、1 格彩色内沿（rim）、图标居中、右下角标数字（3×5 小数字）。
 * (x, y) = 左上（格）。
 */
export function pixStatusChip(pen: PixPen, kind: PixGlyph, x: number, y: number, o: { col?: string; rim: string; n?: number | string; body?: string; hi?: string | null; nCol?: string }) {
  pen.box(x, y, CHIP, CHIP, { fill: o.body ?? 'rgba(14,10,22,0.86)', line: INK, rim: o.rim, hi: null, cut: 3 });
  if (o.hi) pen.fill(x + 3, y + 1, CHIP - 6, 1, () => true, o.hi);
  pixGlyph(pen, kind, x + 2, y + 2, { col: o.col });
  if (o.n != null && o.n !== '') { const t = String(o.n); pixSmallDigits(pen, t, x + CHIP - 1, y + CHIP - 5, { col: o.nCol ?? '#ffffff', align: 'right' }); }
}

/** 调试：全部图标排一张（每格 13，n 列） */
export function drawGlyphAtlas(pen: PixPen, cols = 6) {
  const kinds = Object.keys(ART) as PixGlyph[];
  kinds.forEach((k, i) => { const cx = (i % cols) * 14 + 2, cy = Math.floor(i / cols) * 14 + 2; pixGlyph(pen, k, cx, cy); });
  return { w: cols * 14 + 2, h: Math.ceil(kinds.length / cols) * 14 + 2, kinds };
}
export const ALL_GLYPHS = Object.keys(ART) as PixGlyph[];
