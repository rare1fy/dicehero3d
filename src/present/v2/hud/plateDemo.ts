// R6 调试页（截图自查用）：window.__pixAtlas(on) 把像素图标库画成一张总览；window.__pixPlates(on) 画一排敌人牌样张（各意图、
// 冻结、嘲讽、被保护、护甲、目标高亮、预计伤害 / 斩杀、状态行、「-N」气泡、首领血条）。都是普通 overlay pane，不影响战斗。
import type { Overlay, Pane } from '../overlay';
import { paintCells, type PixPen } from '../../ui3d/pixDraw';
import { GRID } from '../../ui3d/pixelGrid';
import { ALL_GLYPHS, pixGlyph, pixSmallDigits, pixStatusChip, CHIP, INK } from './pixIcons';
import { intentW, paintIntent, paintBar, paintArmor, paintTaunt, paintLock, paintChip, paintBubble, bubbleSize, paintBoss, bossSize, CHIP_STEP } from './platePaint';
import type { IntentView } from './platePaint';

type Sample = { it: IntentView | null; st?: { g: 'drop' | 'fire'; col: string }; hp: number; max: number; armor?: number; sel?: boolean; taunt?: boolean; prot?: boolean; loss?: number; ghost?: number; big?: boolean; chips?: Array<{ g: 'drop' | 'fire' | 'crystal' | 'star' | 'crack' | 'broken' | 'fist'; col: string; n: number; good?: boolean }> };
const SAMPLES: Sample[] = [
  { it: { kind: 'atk', value: 8 }, hp: 28, max: 28, sel: true },
  { it: { kind: 'def', value: 10 }, hp: 100, max: 120, big: true, chips: [{ g: 'crystal', col: '#8ad8ff', n: 1 }, { g: 'crack', col: '#ff6a4a', n: 2 }, { g: 'fire', col: '#ff7a20', n: 4 }] },
  { it: { kind: 'frz' }, hp: 14, max: 30, ghost: 22, chips: [{ g: 'crystal', col: '#8ad8ff', n: 1 }] },
  { it: { kind: 'atk', value: 12, status: 'poison' }, st: { g: 'drop', col: '#5ae03a' }, hp: 40, max: 40, armor: 6, taunt: true },
  { it: { kind: 'curse' }, hp: 22, max: 30, prot: true, loss: 9, chips: [{ g: 'drop', col: '#5ae03a', n: 3 }, { g: 'fist', col: '#ff5a4a', n: 2, good: true }] },
  { it: { kind: 'skl' }, hp: 6, max: 30, loss: 9, sel: true, chips: [{ g: 'broken', col: '#c8c8d8', n: 2 }, { g: 'star', col: '#ffe060', n: 1 }] },
];

function drawSample(pen: PixPen, s: Sample, x: number, y: number, w: number) {
  const barW = s.big ? 52 : 40, bx = x + Math.floor((w - barW) / 2);
  let yy = y;
  if (s.it) { const pw = intentW(s.it, !!s.st); paintIntent(pen, s.it, x + Math.floor((w - pw) / 2), yy, s.st ?? null);
    if (s.taunt) paintTaunt(pen, x + Math.floor((w - pw) / 2) - 12, yy + 2, false); if (s.prot) paintLock(pen, x + Math.floor((w + pw) / 2) + 3, yy + 2); yy += 16; }
  paintBar(pen, bx, yy, barW, { hp: s.hp, max: s.max, ghost: s.ghost ?? s.hp, loss: s.loss ?? 0, blink: true, sel: !!s.sel });
  if (s.armor) paintArmor(pen, bx - 5, yy, s.armor);
  if (s.loss && s.loss >= s.hp) pixGlyph(pen, 'skull', bx + barW - 4, yy, { col: '#fff0bd' });
  yy += 12;
  const cs = s.chips ?? [], cw = cs.length * CHIP_STEP - 1;
  cs.forEach((c, i) => paintChip(pen, x + Math.floor((w - cw) / 2) + i * CHIP_STEP, yy, c));
}

export function installPixDebug(ov: Overlay) {
  const g = globalThis as unknown as Record<string, unknown>; let atlas: Pane | null = null, plates: Pane | null = null;
  g.__pixAtlas = (on = true) => {
    atlas ??= ov.pane(95); atlas.visible = on; if (!on) return;
    const cols = 7, n = ALL_GLYPHS.length, W = cols * 26 + 4, H = Math.ceil(n / cols) * 26 + 22;
    paintCells(atlas, 'atlas', W, H, pen => {
      pen.rect(0, 0, W, H, 'rgba(20,16,30,0.96)');
      ALL_GLYPHS.forEach((k, i) => { const cx = (i % cols) * 26 + 4, cy = Math.floor(i / cols) * 26 + 4; pixGlyph(pen, k, cx, cy); pixStatusChip(pen, k, cx + 11, cy - 2, { rim: i % 2 ? '#a02a24' : '#a8742a', n: i + 1 }); });
      pixSmallDigits(pen, '0123456789+-x/', 4, H - 14, { col: '#ffffff' });
      pen.digits('0123456789-/', 4, H - 8, { col: '#ffffff', shadow: null });
    });
    atlas.at(16, 16);
  };
  g.__pixPlates = (on = true) => {
    plates ??= ov.pane(95); plates.visible = on; if (!on) return;
    const cell = 76, W = SAMPLES.length * cell + 8, B = bubbleSize('-18'), S = bossSize(), H = 72 + S.h + 6;
    paintCells(plates, 'plates', W, H, pen => {
      pen.rect(0, 0, W, H, 'rgba(36,30,52,0.97)');
      SAMPLES.forEach((s, i) => drawSample(pen, s, 4 + i * cell, 4, cell));
      const bp = { ox: pen.ox, oy: pen.oy }; pen.ox += 4; pen.oy += 52; paintBubble(pen, '-18'); pen.ox = bp.ox; pen.oy = bp.oy;
      pen.ox += 4 + B.w + 8; pen.oy += 70; paintBoss(pen, 180, 300, 230); pen.ox = bp.ox; pen.oy = bp.oy;
      pen.rect(0, H - 1, W, 1, INK); void CHIP;
    });
    plates.at(16, Math.round(ov.h * 0.18));
    return { u: GRID.u };
  };
}
