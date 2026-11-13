// R7 玩家状态行（UX_V3 §1 / §1b / §6b，左侧玩家区）：血瓶右边两行像素状态牌，上行正面（护甲、屏障、狂暴…）、下行负面（中毒、灼烧、
// 虚弱、反噬…）。全部画在美术像素格上（paintCells：1 格 = GRID.u 设备像素，不缩放）：正面 = 暖色石底 + 金边八角牌，负面 = 暗红底 +
// 红边方牌缺一角；牌内 9×9 像素图标，右下角方正数字（层数 / 回合数）；超过 3 个折叠成「+N」。每行下面一条 1 格台沿。
// 血瓶上的血量 = 方正像素大数字（1 字格 = 1u 的整数倍，1u 深色描边）。返回回合末中毒 + 灼烧要扣的血（给血瓶画预扣那截）。
import type { Overlay, Pane } from '../overlay';
import type { UiLayer } from '../../ui3d/layer';
import type { Glyph } from './draw';
import { ST_GLYPH } from './plates';
import type { StatusV2 } from '../../../core/v2/types';
import { paintCells, digitCellsW, DIGIT_CELLS_H, type PixPen } from '../../ui3d/pixDraw';
import { GRID } from '../../ui3d/pixelGrid';
import { pixGlyph, INK } from './pixIcons';

export interface PlayerView { hp: number; maxHp: number; armor: number; barrier: number; rage: number; backlash: number; statuses: Array<{ type: StatusV2; value: number; duration?: number }> }
interface Ico { g: Glyph; col: string; n: number | string }

/** 一枚牌的边长、步距（格） */
const CH = 15, STEP = 17, ROW_W = 3 * STEP + 1, ROW_H = CH + 4;

function chip(pen: PixPen, x: number, y: number, ic: Ico, bad: boolean) {
  if (bad) {   // square, red rim, the top-right corner knocked off (裂角)
    pen.box(x, y, CH, CH, { fill: 'rgba(40,10,14,0.9)', line: INK, rim: '#b0302a', hi: null, cut: 1 });
    const u = pen.u, X = (c: number) => (pen.ox + c) * u, Y = (r: number) => (pen.oy + r) * u;
    pen.g.clearRect(X(x + CH - 3), Y(y), 3 * u, u); pen.g.clearRect(X(x + CH - 2), Y(y + 1), 2 * u, u); pen.g.clearRect(X(x + CH - 1), Y(y + 2), u, u);
    pen.cell(x + CH - 4, y, INK); pen.cell(x + CH - 3, y + 1, INK); pen.cell(x + CH - 2, y + 2, INK); pen.cell(x + CH - 1, y + 3, INK);
  } else {
    pen.box(x, y, CH, CH, { fill: 'rgba(46,34,26,0.9)', line: INK, rim: '#c89a40', hi: null, cut: 4 });
    pen.fill(x + 4, y + 2, CH - 8, 1, () => true, 'rgba(255,230,170,0.22)');
  }
  pixGlyph(pen, ic.g as never, x + 3, y + 2, { col: ic.col });
  const t = String(ic.n); if (!t) return;
  pen.digits(t, x + CH, y + CH - 6, { col: '#ffffff', align: 'right', shadow: null });
}

export class StatusRows {
  private left: Pane; private right: Pane; private hp: Pane; x = 525; y = 605; k = 1; on = false; size = 134;
  /** left player zone: both rows to the flask's right, buffs on top, debuffs below */
  stack = false;
  constructor(ov: Overlay, public L?: UiLayer) { this.left = ov.pane(7); this.right = ov.pane(7); this.hp = ov.pane(8); }
  place(x: number, y: number, size: number, k: number) { this.x = x; this.y = y; this.size = size; this.k = k; }
  /** where a status icon flying to the player lands (the chip centre) */
  landing(type: StatusV2, p: PlayerView) {
    const good = type === 'berserk', list = p.statuses.filter(s => good ? s.type === 'berserk' : s.type !== 'berserk');
    const index = list.findIndex(s => s.type === type), slot = Math.min(2, index < 0 ? list.length : index), uc = GRID.uc;
    const pn = good ? this.left : this.right, cx = (1 + slot * STEP + CH / 2) * uc;
    if (this.stack) return { x: pn.x + cx, y: pn.y + (1 + CH / 2) * uc };
    return { x: good ? pn.x + pn.w - cx : pn.x + cx, y: pn.y + (1 + CH / 2) * uc };
  }
  /** returns the HP the DoTs will take at turn end (for the flask's cut) */
  update(p: PlayerView | null, shownHp: number) {
    const vis = this.on && !!p; this.left.visible = this.right.visible = this.hp.visible = vis; if (!vis || !p) return 0;
    const buffs: Ico[] = [], bad: Ico[] = [];
    if (p.armor > 0) buffs.push({ g: 'shield', col: '#4a9aff', n: p.armor });
    if (p.barrier > 0) buffs.push({ g: 'ring', col: '#5ae0ff', n: p.barrier });
    for (const s of p.statuses) {
      if (s.type === 'berserk') buffs.push({ g: 'tri', col: '#ff4a3a', n: s.duration ?? s.value });
      else if (ST_GLYPH[s.type]) { const S = ST_GLYPH[s.type], dot = s.type === 'poison' || s.type === 'burn'; bad.push({ g: S.g, col: S.col, n: dot ? s.value : s.duration ?? s.value }); }
    }
    if (p.backlash > 0) bad.push({ g: 'crack', col: '#d080ff', n: p.backlash });
    const dot = p.statuses.filter(s => s.type === 'poison' || s.type === 'burn').reduce((a, s) => a + s.value, 0);
    const uc = GRID.uc;
    const row = (pn: Pane, list: Ico[], badRow: boolean, rtl: boolean) => {
      const show = list.slice(0, list.length > 3 ? 2 : 3), more = list.length - show.length;
      paintCells(pn, [badRow, rtl, show.map(i => i.g + i.n).join(','), more].join('|'), ROW_W, ROW_H, pen => {
        // the shared ledge under the row (1 cell, fading in steps toward the far end)
        const lc = badRow ? ['#c03028', 'rgba(192,48,40,0.55)', 'rgba(192,48,40,0.25)'] : ['#c89a40', 'rgba(200,154,64,0.55)', 'rgba(200,154,64,0.25)'];
        const seg = Math.floor(ROW_W / 3); lc.forEach((c, i) => pen.rect(rtl ? ROW_W - (i + 1) * seg : i * seg, ROW_H - 2, seg, 1, c));
        const n = show.length + (more ? 1 : 0);
        show.forEach((ic, i) => chip(pen, rtl ? ROW_W - 1 - (i + 1) * STEP + 1 : 1 + i * STEP, 1, ic, badRow));
        if (more) { const t = `+${more}`, xx = rtl ? ROW_W - 1 - n * STEP + 1 : 1 + show.length * STEP; pen.digits(t, xx + Math.floor(CH / 2), 5, { col: badRow ? '#ffb0a0' : '#ffe6b0', align: 'center', shadow: null }); }
      });
    };
    row(this.left, buffs, false, !this.stack); row(this.right, bad, true, false);
    const gap = this.size * 0.5 + 6 * this.k;   // from the flask centre to the inner end of each row
    if (this.stack) { const ox = Math.round(this.x + gap); this.left.at(ox, Math.round(this.y - this.left.h - 2 * uc)); this.right.at(ox, Math.round(this.y)); }
    else { this.left.at(Math.round(this.x - gap - this.left.w), Math.round(this.y - this.left.h / 2)); this.right.at(Math.round(this.x + gap), Math.round(this.y - this.right.h / 2)); }
    // the HP number on the flask: square digits, 2 cells per digit cell (≈ 42 ref px tall), 1u ink outline + 1u drop
    const t = String(Math.max(0, Math.round(shownHp))), low = p.hp / Math.max(1, p.maxHp) < 0.3, s = Math.max(1, Math.min(2, Math.floor((this.size * 0.62) / GRID.uc / Math.max(1, digitCellsW(t))))), w = digitCellsW(t, s) + 4, h = DIGIT_CELLS_H * s + 5;
    paintCells(this.hp, 'hp' + t + low, w, h, pen => pen.digits(t, Math.floor(w / 2), 1, { col: low ? '#ffd0c8' : '#ffffff', scale: s, align: 'center', shadow: 'rgba(0,0,0,0.6)' }));
    this.hp.at(Math.round(this.x - this.hp.w / 2), Math.round(this.y - this.hp.h / 2 + this.size * 0.06));
    return dot;
  }
}
