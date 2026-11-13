// R7 技能槽 / 出牌按钮的前景层（UX_V3 §2b / §3 / §6b）：效果标签胶囊（Fusion Pixel 字 + 按类别着色的 1 格内沿）、预计数值胶囊
// （方正大数字，护甲 / 屏障 / 治疗带像素小图标）、目标头像（像素小兽头，一群 = 打全体）、2 档附加效果图标、刺客匕首牌（「末刀 +80%」
// 橙色）。全部画在美术像素格上（paintCells：1 格 = GRID.u 设备像素，不缩放），位置取整到设备像素。
import type { Slot3D } from './slot3d';
import { tagColor } from './slot3d';
import { paintCells, textCellsW, textCellsH, labelFp, digitCellsW, DIGIT_CELLS_H, PANEL, panelWith, type PixPen } from '../../ui3d/pixDraw';
import { GRID } from '../../ui3d/pixelGrid';
import { pixGlyph, INK, type PixGlyph } from './pixIcons';

const VAL_MK = { armor: ['shield', '#4a9aff'], barrier: ['ring', '#5ae0ff'], heal: ['heart', '#ff5a6a'] } as const;

/** 9×9 像素小兽头（红眼、两只耳朵） */
const FOE_HEAD = ['b.......b', 'bb.....bb', 'bbbbbbbbb', 'bbbbbbbbb', 'brrbbbrrb', 'bbbbbbbbb', '.bbbbbbb.', '..bkkkb..', '...bbb...'];
function foeHead(pen: PixPen, x: number, y: number) {
  pen.panel(x, y, 15, 15, PANEL.danger, 3);
  pen.icon(FOE_HEAD, x + 3, y + 3, { b: '#6a5a86', r: '#ff3a2a', k: '#2a2036' }, { outline: null });
}

/** the tag's font size: the label size, one step smaller while the capsule would be wider than the row step */
function tagFp(tag: string, fp: number, max: number) { let f = fp; while (f > 1 && (textCellsW(tag, f) + 9) * GRID.uc > max) f--; return f; }

export function paintSlotFront(s: Slot3D, B: number, tier: number) {
  const st = s.st, on = s.vis > 0.3, uc = GRID.uc, fp = labelFp(), R = Math.round;
  // the tag capsule under the small slot
  const tag = s.def.tag, tc = st.dead ? '#8a8292' : tagColor(tag), tfp = tagFp(tag, fp, s.tagMax), tw = textCellsW(tag, tfp) + 8, th = textCellsH(tfp) + 6;
  paintCells(s.tag, ['g2', tag, tc, tfp].join('|'), tw + 1, th + 1, pen => {
    pen.panel(0, 0, tw, th, st.dead ? PANEL.disabled : panelWith(PANEL.normal, tc), 2);
    pen.text(tag, Math.floor(tw / 2), 3, { col: tc, fp: tfp, align: 'center' });
  });
  s.tag.at(R(s.cx - s.tag.w / 2), R(s.cy + s.size * 0.55 + 2 * uc));
  // user 11-13: 「选中技能的时候，下面的文字叠一起了」 — shrunk slots (beside a play button) have no room for a tag: it fades out with the shrink
  const rest = Math.max(0, Math.min(1, (s.size / s.k - 64) / 16));
  s.tag.alpha = on ? (1 - B) * rest * (1 - s.dim * 0.4) * s.vis : 0; s.tag.visible = s.tag.alpha > 0.02;
  // the value pill (play button): big square digits, 2 cells per digit cell
  const v = st.value != null && st.value > 0 ? String(st.value) : '', mk = st.valKind && st.valKind !== 'dmg' ? st.valKind : null, ds = 2;
  const vw = digitCellsW(v, ds) + 10 + (mk ? 12 : 0), vh = DIGIT_CELLS_H * ds + 9;
  paintCells(s.val, ['v2', v, mk].join('|'), vw + 1, vh + 1, pen => {
    pen.panel(0, 0, vw, vh, PANEL.focus, 3);
    if (mk) pixGlyph(pen, VAL_MK[mk][0] as PixGlyph, 4, Math.floor((vh - 9) / 2), { col: VAL_MK[mk][1] });
    pen.digits(v, (mk ? 12 : 0) + Math.floor((vw - (mk ? 12 : 0)) / 2), 4, { col: '#ffffff', scale: ds, align: 'center', shadow: null, hi: '#fff0c8' });
  });
  s.val.at(R(s.cx - s.val.w / 2), R(s.cy - s.val.h / 2 + s.size * 0.2 + s.bump.x * 0.2));
  s.val.alpha = v && on ? Math.max(0, B * 2 - 1) : 0; s.val.visible = s.val.alpha > 0.02;
  // the target portrait (bottom right): one enemy, or a crowd when it hits all
  const n = st.all ? 3 : 1, pw = 16 + (n - 1) * 6, ph = 16;
  paintCells(s.tgt, ['t2', n].join('|'), pw, ph, pen => { for (let i = n - 1; i >= 0; i--) foeHead(pen, i * 6, 0); });
  s.tgt.at(R(s.cx + s.size * 0.42 - s.tgt.w / 2), R(s.cy + s.size * 0.12 - s.tgt.h / 2));
  // 铁壁 / 屏障 / 治疗 act on the hero: no enemy portrait (it also covered the value pill on the medium buttons)
  const selfPlay = !!st.valKind && st.valKind !== 'dmg';
  s.tgt.alpha = on && !selfPlay ? Math.max(0, B * 2 - 1) : 0; s.tgt.visible = s.tgt.alpha > 0.02;
  // tier-2 extra effect (e.g. 冻结) hung on the right edge
  const ex = st.extra && tier >= 2 ? st.extra : null;
  paintCells(s.ext, ['x2', ex].join('|'), 16, 16, pen => { if (!ex) return; pen.panel(0, 0, 15, 15, panelWith(PANEL.focus, '#ffb040'), 4); pixGlyph(pen, ex as PixGlyph, 3, 3, { col: '#9ae8ff' }); });
  s.ext.at(R(s.cx + s.size * 0.66 - s.ext.w / 2), R(s.cy - s.size * 0.22 - s.ext.h / 2));
  s.ext.alpha = ex && on ? Math.max(0, B * 2 - 1) : 0; s.ext.visible = s.ext.alpha > 0.02;
  // rogue v4: the combo dagger plaque on the button's upper left (orange 「末刀」 on the last strike)
  const cb = st.combo && (st.combo.pct > 0 || st.combo.last) ? st.combo : null, ct = cb ? (cb.last ? `末刀 +${cb.pct}%` : `+${cb.pct}%`) : '';
  const col = cb?.last ? '#ff9a30' : '#d8b0ff', cw = 13 + textCellsW(ct, fp) + 4, chh = Math.max(15, textCellsH(fp) + 6);
  paintCells(s.cmb, ['c2', ct, col, fp].join('|'), cw + 1, chh + 1, pen => {
    if (!cb) return; pen.panel(0, 0, cw, chh, panelWith(PANEL.normal, col), 2);
    pixGlyph(pen, 'sword', 3, Math.floor((chh - 9) / 2), { col }); pen.text(ct, 13, Math.floor((chh - textCellsH(fp)) / 2), { col, fp });
  });
  s.cmb.at(R(s.cx - s.size * 0.5 - s.cmb.w / 2), R(s.cy - s.size * 0.42 - s.cmb.h / 2));
  paintLine(s, B, fp);
  s.cmb.alpha = cb && on ? Math.max(0, B * 2 - 1) * (cb.last ? 0.75 + 0.25 * Math.sin(s.t * 8) : 1) : 0; s.cmb.visible = s.cmb.alpha > 0.02;
}

/** a pixel tick (✓): a 2-cell foot and a 4-cell rise, 1-cell ink outline */
function check(pen: PixPen, x: number, y: number, col: string) {
  const pts: Array<[number, number]> = [[0, 2], [1, 3], [2, 4], [3, 3], [4, 2], [5, 1], [6, 0]];
  for (const [i, j] of pts) pen.rect(x + i - 1, y + j - 1, 3, 3, INK);
  for (const [i, j] of pts) pen.rect(x + i, y + j, 1, 2, col);
}

/**
 * Warrior v4 lines under the play button (UX_V3 §8):
 * - 斩杀线: the hit kills its target → a red plaque 「斩首 +1骰」 (or 「斩杀 再动」 when the kill grants another action this turn);
 * - 完防线 on 铁壁: armour after the play against this turn's incoming attacks — a blue bar, a red tick at the incoming total,
 *   and when it covers everything the bar turns green with a ✓ 「完防」.
 */
function paintLine(s: Slot3D, B: number, fp: number) {
  const ln = s.st.line && s.st.lit ? s.st.line : null, uc = GRID.uc, R = Math.round, th = Math.max(15, textCellsH(fp) + 6);
  let key = 'none', w = 4;
  const killT = ln?.kind === 'kill' ? (ln.act ? '斩杀 再动' : '斩首 +1骰') : '';
  if (ln?.kind === 'kill') { key = 'k' + killT; w = 13 + textCellsW(killT, fp) + 4; }
  else if (ln?.kind === 'guard') { key = ['g', ln.armor, ln.incoming, ln.full].join(','); w = ln.full ? 13 + textCellsW('完防', fp) + 13 : 50; }
  paintCells(s.ln, ['ln', key, fp].join('|'), w + 1, th + 1, pen => {
    if (!ln) return;
    const gy = Math.floor((th - 9) / 2), ty = Math.floor((th - textCellsH(fp)) / 2);
    if (ln.kind === 'kill') {
      pen.panel(0, 0, w, th, PANEL.danger, 2); pixGlyph(pen, 'skull', 3, gy, { col: '#fff0bd' });
      pen.text(killT, 13, ty, { col: '#ffd8c8', fp });
      return;
    }
    if (ln.full) {
      pen.panel(0, 0, w, th, panelWith(PANEL.normal, '#5ad070'), 2); pixGlyph(pen, 'shield', 3, gy, { col: '#4a9aff' });
      pen.text('完防', 13, ty, { col: '#b8ffc8', fp }); check(pen, w - 11, Math.floor(th / 2) - 3, '#5ad070');
      return;
    }
    pen.panel(0, 0, w, th, PANEL.normal, 2); pixGlyph(pen, 'shield', 3, gy, { col: '#4a9aff' });
    const bx = 14, bw = w - 19, by = Math.floor(th / 2) - 2, max = Math.max(ln.incoming * 1.25, ln.armor, 1);
    const fill = Math.round((bw - 2) * Math.min(1, ln.armor / max)), tick = 1 + Math.round((bw - 2) * Math.min(1, ln.incoming / max));
    pen.rect(bx, by, bw, 5, INK); pen.rect(bx + 1, by + 1, bw - 2, 3, '#1c2030');
    if (fill > 0) { pen.rect(bx + 1, by + 1, fill, 3, '#4a9aff'); pen.rect(bx + 1, by + 1, fill, 1, '#9ad0ff'); }
    pen.rect(bx + tick - 1, by - 2, 3, 9, INK); pen.rect(bx + tick, by - 1, 1, 7, '#ff4a3a');   // the incoming total
  });
  s.ln.at(R(s.cx - s.ln.w / 2), R(s.cy + s.size * 0.5 + 2 * uc));
  s.ln.alpha = ln && s.vis > 0.3 ? Math.max(0, B * 2 - 1) : 0; s.ln.visible = s.ln.alpha > 0.02;
}
