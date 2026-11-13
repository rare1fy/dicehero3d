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

export function paintSlotFront(s: Slot3D, B: number, tier: number) {
  const st = s.st, on = s.vis > 0.3, uc = GRID.uc, fp = labelFp(), R = Math.round;
  // the tag capsule under the small slot
  const tag = s.def.tag, tc = st.dead ? '#8a8292' : tagColor(tag), tw = textCellsW(tag, fp) + 8, th = textCellsH(fp) + 6;
  paintCells(s.tag, ['g2', tag, tc, fp].join('|'), tw + 1, th + 1, pen => {
    pen.panel(0, 0, tw, th, st.dead ? PANEL.disabled : panelWith(PANEL.normal, tc), 2);
    pen.text(tag, Math.floor(tw / 2), 3, { col: tc, fp, align: 'center' });
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
  s.tgt.alpha = on ? Math.max(0, B * 2 - 1) : 0; s.tgt.visible = s.tgt.alpha > 0.02;
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
  s.cmb.alpha = cb && on ? Math.max(0, B * 2 - 1) * (cb.last ? 0.75 + 0.25 * Math.sin(s.t * 8) : 1) : 0; s.cmb.visible = s.cmb.alpha > 0.02;
}
