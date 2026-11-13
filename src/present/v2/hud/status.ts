// R5 status rows beside the heart flask (UX_V3 §1 + the mockup): buffs on the left, debuffs on the right, round icons with a
// translucent dark disc (no rim), a thin outer arc = turns left, a corner number; buffs gold-white, debuffs red with a red glow. A
// soft fading line under each row (gold left, red right). Also the flask's HP number (crisp, big) and the DoT forecast handed to the
// flask (poison + burn that tick at turn end).
import type { Overlay, Pane } from '../overlay';
import type { UiLayer } from '../../ui3d/layer';
import { statusIcon, fadeLine, label, type Glyph, type G } from './draw';
import { ST_GLYPH } from './plates';
import type { StatusV2 } from '../../../core/v2/types';

export interface PlayerView { hp: number; maxHp: number; armor: number; barrier: number; rage: number; backlash: number; statuses: Array<{ type: StatusV2; value: number; duration?: number }> }
interface Ico { g: Glyph; col: string; n: number | string; frac: number }

export class StatusRows {
  private left: Pane; private right: Pane; private hp: Pane; x = 525; y = 605; k = 1; on = false; size = 134;
  /** left player zone: both rows to the flask's right, buffs on top, debuffs below */
  stack = false;
  constructor(ov: Overlay, public L?: UiLayer) { this.left = ov.pane(7, true); this.right = ov.pane(7, true); this.hp = ov.pane(8, true); }
  place(x: number, y: number, size: number, k: number) { this.x = x; this.y = y; this.size = size; this.k = k; }
  landing(type: StatusV2, p: PlayerView) {
    const good = type === 'berserk', list = p.statuses.filter(s => good ? s.type === 'berserk' : s.type !== 'berserk');
    const index = list.findIndex(s => s.type === type), slot = Math.min(2, index < 0 ? list.length : index);
    const gap = this.size*0.5+6*this.k;
    if (this.stack) return { x: this.x + gap + (30 + slot * 52) * this.k, y: this.y + (good ? -40 : 34) * this.k };
    return { x: this.x+(good ? -1 : 1)*(gap+(30+slot*52)*this.k), y: this.y-1*this.k };
  }
  /** returns the HP the DoTs will take at turn end (for the flask's cut) */
  update(p: PlayerView | null, shownHp: number) {
    const vis = this.on && !!p; this.left.visible = this.right.visible = this.hp.visible = vis; if (!vis || !p) return 0;
    const buffs: Ico[] = [], bad: Ico[] = [];
    if (p.armor > 0) buffs.push({ g: 'shield', col: '#4a9aff', n: p.armor, frac: 1 });
    if (p.barrier > 0) buffs.push({ g: 'ring', col: '#5ae0ff', n: p.barrier, frac: 1 });
    for (const s of p.statuses) {
      if (s.type === 'berserk') buffs.push({ g: 'tri', col: '#ff4a3a', n: s.duration ?? s.value, frac: Math.min(1, (s.duration ?? 3) / 3) });
      else if (ST_GLYPH[s.type]) { const S = ST_GLYPH[s.type], dot = s.type === 'poison' || s.type === 'burn'; bad.push({ g: S.g, col: S.col, n: dot ? s.value : s.duration ?? s.value, frac: dot ? 1 : Math.min(1, (s.duration ?? 1) / 3) }); }
    }
    if (p.backlash > 0) bad.push({ g: 'crack', col: '#d080ff', n: p.backlash, frac: 1 });
    const dot = p.statuses.filter(s => s.type === 'poison' || s.type === 'burn').reduce((a, s) => a + s.value, 0);
    const k = this.k, step = 52, rw = 3 * step + 50, rh = 74;
    const row = (pn: Pane, list: Ico[], badRow: boolean) => {
      const show = list.slice(0, list.length > 3 ? 2 : 3), more = list.length - show.length;
      pn.paint([badRow, show.map(i => i.g + i.n + ':' + i.frac.toFixed(2)).join(','), more].join('|'), rw, rh, (g: G, kk) => {
        fadeLine(g, 0, rh - 8, rw, kk, badRow ? 'rgba(255,60,50,0.75)' : 'rgba(255,200,110,0.75)', 2);
        const n = show.length + (more ? 1 : 0), x0 = badRow || this.stack ? 30 : rw - 30 - (n - 1) * step;
        show.forEach((ic, i) => statusIcon(g, x0 + i * step, 30, 24, kk, { glyph: ic.g, col: ic.col, arc: badRow ? '#ff3a2a' : '#ffd890', frac: ic.frac, n: ic.n, bad: badRow }));
        if (more) label(g, `+${more}`, x0 + show.length * step, 30, 20, kk, { col: badRow ? '#ffb0a0' : '#ffe6b0' });
      });
      pn.scale = k;
    };
    row(this.left, buffs, false); row(this.right, bad, true);
    const gap = this.size * 0.5 + 6 * k;   // from the flask centre to the inner end of each row
    if (this.stack) { const ox = this.x + gap + (rw * k - rw) / 2, oy = (rh * k - rh) / 2; this.left.at(ox, this.y - rh * k + oy - 2 * k); this.right.at(ox, this.y + oy - 6 * k); }
    else { this.left.at(this.x - gap - rw * k + (rw * k - rw) / 2, this.y - rh / 2 + 6 * k); this.right.at(this.x + gap + (rw * k - rw) / 2, this.y - rh / 2 + 6 * k); }
    // the HP number on the flask
    const t = String(Math.max(0, Math.round(shownHp))), w = 110, h = 60, low = p.hp / Math.max(1, p.maxHp) < 0.3;
    this.hp.paint('hp' + t + low, w, h, (g: G, kk) => label(g, t, w / 2, h / 2, 44, kk, { col: low ? '#ffd0c8' : '#ffffff', sw: 6 }));
    this.hp.scale = k; this.hp.at(this.x - w / 2, this.y - h / 2 + this.size * 0.06);
    return dot;
  }
}
