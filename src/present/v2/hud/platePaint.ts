// R6 敌人牌的像素画法（UX_V3 §6b）：意图胶囊、血条（2 档红 + 1u 高光、掉血残影、预计伤害闪烁段、数字压条）、护甲盾、
// 嘲讽 / 被保护角标、状态小牌、悬停「-N」像素对话框、首领血条。全部按「格」画（1 格 = 1 美术像素），1u 深色描边，平涂，无渐变。
import { cutMask, digitCellsW, type PixPen } from '../../ui3d/pixDraw';
import { pixGlyph, pixSmallDigits, pixStatusChip, CHIP, INK, type PixGlyph } from './pixIcons';

export const BAR_H = 9;
export const PILL_H = 13;
export const CHIP_STEP = CHIP + 1;

export interface IntentStyle { g: PixGlyph; col: string; rim: string; body: string; num: string; hi: string }
const DARK = 'rgba(16,12,24,0.84)';
export const INTENT_PIX: Record<string, IntentStyle> = {
  atk: { g: 'sword', col: '#ff5040', rim: '#6a2622', body: 'rgba(24,10,16,0.84)', num: '#ffffff', hi: 'rgba(255,190,180,0.14)' },
  def: { g: 'shield', col: '#4a9aff', rim: '#24406e', body: 'rgba(10,14,30,0.84)', num: '#ffffff', hi: 'rgba(190,215,255,0.14)' },
  mov: { g: 'boot', col: '#e0b860', rim: '#5a4426', body: DARK, num: '#ffffff', hi: 'rgba(255,240,200,0.12)' },
  frz: { g: 'snow', col: '#c8e8ff', rim: '#a8d8ff', body: 'rgba(40,52,66,0.9)', num: '#c8d8e8', hi: '#e8f8ff' },
  skl: { g: 'star', col: '#c890ff', rim: '#4a2a6a', body: 'rgba(18,10,28,0.84)', num: '#ffffff', hi: 'rgba(230,200,255,0.14)' },
  curse: { g: 'skull', col: '#c890ff', rim: '#4a2a6a', body: 'rgba(18,10,28,0.84)', num: '#ffffff', hi: 'rgba(230,200,255,0.14)' },
};
export interface IntentView { kind: string; value?: number; status?: string }

/** 胶囊宽（格）：左线 + 图标（含描边）+ 数字（含描边）+ 附带状态图标 + 右线 */
export function intentW(it: IntentView, hasStatus: boolean) {
  const v = it.value != null ? String(it.value) : '';
  let w = 12; if (v) w += digitCellsW(v) + 1; if (hasStatus) w += 1 + GLYPH_STEP; return w + 1;
}
const GLYPH_STEP = 10;

/** 意图胶囊：(x, y) 左上；冻结 = 灰底 + 冰框（亮色内沿 + 上下冰棱） */
export function paintIntent(pen: PixPen, it: IntentView, x: number, y: number, st: { g: PixGlyph; col: string } | null) {
  const S = INTENT_PIX[it.kind] || INTENT_PIX.skl, v = it.value != null ? String(it.value) : '', w = intentW(it, !!st), frz = it.kind === 'frz';
  pen.box(x, y, w, PILL_H, { fill: S.body, line: INK, rim: S.rim, hi: null, cut: 2 });
  pen.fill(x + 2, y + 2, w - 4, 1, () => true, S.hi);
  if (frz) {   // icicles hanging off the frame: 1-cell pale teeth on the top and bottom lines
    for (let i = 3; i < w - 3; i += 3) { pen.cell(x + i, y, '#e8f8ff'); pen.cell(x + i + 1, y + PILL_H - 1, '#a8d8ff'); }
  }
  let cur = x + 2;
  pixGlyph(pen, S.g, cur, y + 2, { col: S.col, dim: frz ? 0.15 : 0 }); cur += GLYPH_STEP;
  if (v) { pen.digits(v, cur, y + 3, { col: S.num, shadow: null }); cur += digitCellsW(v) + 1; }
  if (st) { cur += 1; pixGlyph(pen, st.g, cur, y + 2, { col: st.col }); }
  return w;
}

export interface BarOpts { hp: number; max: number; ghost: number; loss: number; blink: boolean; sel: boolean; num?: string }
/** 血条：w × 9 格；sel = 目标高亮（2 圈阶梯红光） */
export function paintBar(pen: PixPen, x: number, y: number, w: number, o: BarOpts) {
  if (o.sel) {
    const m2 = cutMask(w + 4, BAR_H + 4, 3), m1 = cutMask(w + 2, BAR_H + 2, 2);
    pen.fill(x - 2, y - 2, w + 4, BAR_H + 4, (i, j) => m2(i, j) && !m1(i - 1, j - 1), 'rgba(255,70,40,0.42)');
    pen.fill(x - 1, y - 1, w + 2, BAR_H + 2, (i, j) => m1(i, j) && !cutMask(w, BAR_H, 1)(i - 1, j - 1), '#ff5a40');
  }
  pen.box(x, y, w, BAR_H, { fill: 'rgba(26,10,16,0.9)', line: INK, hi: null, lo: null, cut: 1 });
  const ix = x + 1, iy = y + 1, iw = w - 2, ih = BAR_H - 2, max = Math.max(1, o.max);
  const cells = (v: number) => (v <= 0 ? 0 : Math.max(1, Math.min(iw, Math.round((iw * v) / max))));
  const fill = cells(o.hp), ghost = cells(Math.max(o.hp, o.ghost));
  if (ghost > fill) { pen.rect(ix + fill, iy, ghost - fill, ih, '#ffcfb0'); pen.rect(ix + fill, iy, ghost - fill, 1, '#fff0e4'); }
  if (fill > 0) {
    pen.rect(ix, iy, fill, ih, '#d8242a');
    pen.rect(ix, iy + 4, fill, ih - 4, '#9c121e');
    pen.rect(ix, iy, fill, 1, '#ff8a6a');
  }
  if (o.loss > 0 && fill > 0) {   // the predicted loss: the right end of the red, pale and blinking
    const keep = o.loss >= o.hp ? 0 : cells(o.hp - o.loss), a = Math.min(keep, fill - 1);
    const c = o.blink ? '#fff0c8' : '#ffb080';
    pen.rect(ix + a, iy, fill - a, ih, c); pen.rect(ix + a, iy + ih - 2, fill - a, 2, o.blink ? '#ffd890' : '#e88a60');
  }
  const t = o.num ?? String(Math.max(0, o.hp));
  pen.digits(t, x + Math.floor(w / 2), y + 1, { col: '#ffffff', align: 'center', shadow: null });
}

/** 护甲：蓝盾 + 小数字，盖在血条左端；(x, y) = 盾的左上 */
export function paintArmor(pen: PixPen, x: number, y: number, n: number) {
  pixGlyph(pen, 'shield', x, y, { col: '#4a9aff' });
  pixSmallDigits(pen, String(n), x + 4, y + 2, { col: '#ffffff', align: 'center' });
}
/** 嘲讽：盾牌 + 感叹号（flash = 被拒时闪白） */
export function paintTaunt(pen: PixPen, x: number, y: number, flash: boolean) {
  pixGlyph(pen, 'shield', x, y, { col: flash ? '#ffffff' : '#64b5ff' });
  pen.rect(x + 3, y + 1, 3, 1, INK); pen.rect(x + 4, y + 1, 1, 4, '#ffffff'); pen.rect(x + 3, y + 2, 1, 3, INK); pen.rect(x + 5, y + 2, 1, 3, INK);
  pen.rect(x + 3, y + 5, 3, 3, INK); pen.rect(x + 4, y + 6, 1, 1, '#ffffff');
}
export const paintLock = (pen: PixPen, x: number, y: number) => pixGlyph(pen, 'lock', x, y, { col: '#b0b8c8' });

/** 敌人状态行的一枚小牌 */
export function paintChip(pen: PixPen, x: number, y: number, s: { g: PixGlyph; col: string; n: number | string; good?: boolean }) {
  pixStatusChip(pen, s.g, x, y, { col: s.col, rim: s.good ? '#a8742a' : '#a02a24', n: s.n, hi: s.good ? 'rgba(255,220,150,0.18)' : 'rgba(255,150,130,0.16)' });
}

// ---------------------------------------------------------------- the "-N" bubble (a pixel speech box, tail down-left)
export function bubbleSize(txt: string) { return { w: digitCellsW(txt) + 10, h: 13 + 4 }; }
export function paintBubble(pen: PixPen, txt: string) {
  const { w } = bubbleSize(txt), bh = 13;
  // tail: a right triangle under the left end (vertical left edge, 45° right edge), opening into the box, outlined
  const tail: Array<[number, number]> = []; for (let j = 0; j < 4; j++) for (let i = 2; i <= 5 - j; i++) tail.push([i, bh - 1 + j]);
  for (const [x, y] of tail) pen.rect(x - 1, y - 1, 3, 3, INK);
  pen.box(0, 0, w, bh, { fill: '#b8141a', line: INK, hi: '#ff6a50', lo: '#7a0a10', cut: 2 });
  for (const [x, y] of tail) pen.cell(x, y, x === 5 - (y - bh + 1) ? '#7a0a10' : '#b8141a');
  pen.rect(2, bh - 2, 3, 1, '#b8141a');
  pen.digits(txt, Math.floor(w / 2), 3, { col: '#ffffff', align: 'center', shadow: null, hi: '#ffe8d8' });
}

// ---------------------------------------------------------------- the boss bar (top centre)
export const BOSS_W = 120;
export function bossSize() { return { w: BOSS_W + 8, h: BAR_H + 8 }; }
export function paintBoss(pen: PixPen, hp: number, max: number, ghost: number) {
  const { w, h } = bossSize();
  pen.box(0, 0, w, h, { fill: 'rgba(16,12,24,0.86)', line: INK, rim: '#6e5434', hi: null, cut: 3 });
  pen.fill(4, 2, w - 8, 1, () => true, 'rgba(255,220,170,0.16)');
  // small studs on both ends (restrained bronze, not gold)
  for (const sx of [2, w - 4]) { pen.rect(sx, Math.floor(h / 2) - 1, 2, 2, '#8a6a42'); pen.cell(sx, Math.floor(h / 2) - 1, '#c8a070'); }
  paintBar(pen, 4, 4, BOSS_W, { hp, max, ghost, loss: 0, blink: false, sel: false, num: `${Math.max(0, hp)}/${max}` });
}
