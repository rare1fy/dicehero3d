// Long-press tips for every HUD element that had none (user 11-14: 「debuff状态的长按tips没有做，血瓶也应该有长按tips，看看还有哪些是没做
// 长按tips的」): the player's status chips (正面 / 负面), the flask, the reroll button, the end-turn / 吟唱 button, the dice queue, the purse
// and the enemy plates. Hold still 0.4 s → the tip; let go → it closes, and a held button does not fire. A quick tap on something
// that is not a button shows the same tip for a few seconds (UX_V3 §1: 「点图标看 tips」). One shared pixel tip (PANEL.tip).
// Texts follow the engine (core/v2/battle2.ts): poison / burn tick at turn end and ignore armour and barrier, armour / barrier clear at
// your turn start, weak ×0.75, vulnerable ×1.5, berserk +30 % dealt / ×1.2 taken, backlash +10 % taken per layer.
import type { Overlay, Pane } from '../overlay';
import type { Battle2 } from '../../../core/v2/battle2';
import type { StatusV2 } from '../../../core/v2/types';
import type { HeartFlask } from '../../ui3d/flask';
import type { DiceTray } from '../../ui3d/tray';
import type { Loot } from '../../ui3d/loot';
import type { RerollButton } from './reroll';
import type { ChantButton } from './chant';
import type { StatusRows, Ico } from './status';
import type { FoePlates } from './plates';
import { paintCells, textCellsW, textCellsH, labelFp, bigFp, PANEL } from '../../ui3d/pixDraw';
import { GRID } from '../../ui3d/pixelGrid';
import { cue } from '../../../audio/cues';

interface Tip { title: string; lines: string[]; x: number; y: number }
type Target = { kind: 'reroll' | 'chant' | 'foe'; button: true; uid?: number } | { kind: 'flask' | 'status' | 'tray' | 'purse'; button: false; chip?: { ico: Ico } | { more: Ico[] } };
export interface TipHost { reroll: RerollButton; chant: ChantButton; status: StatusRows; plates: FoePlates; k: number }

const HOLD_S = 0.4, SLOP = 10, TAP_S = 3;
const CN: Record<string, string> = { poison: '中毒', burn: '灼烧', freeze: '冻结', stun: '眩晕', vulnerable: '易伤', weak: '虚弱', berserk: '狂暴', armor: '护甲', barrier: '屏障', backlash: '反噬' };

/** what a status does, for the player (you) or an enemy */
function statusLines(k: string, n: number | string, d: number | undefined, enemy: boolean): { title: string; lines: string[] } {
  const left = d != null ? `（剩 ${d} 回合）` : '';
  switch (k) {
    case 'armor': return { title: `护甲 ${n}`, lines: ['先挡掉敌人的直接伤害', '毒和灼烧不挡', enemy ? '每回合结束时清零' : '你的回合开始时清零'] };
    case 'barrier': return { title: `屏障 ${n}`, lines: ['吟唱得到：先挡掉直接伤害', '毒和灼烧不挡', '你的回合开始时清零'] };
    case 'backlash': return { title: `反噬 ${n} 层`, lines: [`受到的直接伤害 +${Number(n) * 10}%`, '释放大招后清零'] };
    case 'poison': return { title: `中毒 ${n}`, lines: [`回合末扣 ${n} 血，然后减 1 层`, '无视护甲和屏障'] };
    case 'burn': return { title: `灼烧 ${n}`, lines: enemy ? [`回合末扣 ${n} 血`, '无视护甲'] : [`回合末扣 ${n} 血，然后熄灭`, '无视护甲和屏障'] };
    case 'weak': return { title: `虚弱${left}`, lines: [enemy ? '它的攻击伤害 ×0.75' : '你造成的伤害 ×0.75'] };
    case 'vulnerable': return { title: `易伤${left}`, lines: ['受到的直接伤害 ×1.5'] };
    case 'freeze': return { title: `冻结${left}`, lines: [enemy ? '这回合不能行动' : '不能行动'] };
    case 'stun': return { title: `眩晕${left}`, lines: [enemy ? '这回合不能行动' : '不能行动'] };
    case 'berserk': return { title: `狂暴${left}`, lines: ['造成的伤害 +30%', '受到的直接伤害 ×1.2', '卖血重投固定 3 血'] };
    default: return { title: CN[k] || k, lines: [] };
  }
}

export class HoldTips {
  private pane: Pane; private hold: { t: Target; x0: number; y0: number; time: number } | null = null;
  private tip: Tip | null = null; private tapT = 0; private shownByHold = false;
  flask: HeartFlask | null = null; tray: DiceTray | null = null; loot: Loot | null = null; private b: Battle2 | null = null; private ax = 0; private ay = 0;
  constructor(ov: Overlay, private h: TipHost) { this.pane = ov.pane(13); this.pane.visible = false; }

  private find(x: number, y: number): Target | null {
    const H = this.h, k = H.k;
    if (H.reroll.root.visible && H.reroll.hit(x, y)) return { kind: 'reroll', button: true };
    if (H.chant.root.visible && H.chant.hit(x, y)) return { kind: 'chant', button: true };
    const chip = H.status.on ? H.status.chipAt(x, y) : null; if (chip) return { kind: 'status', button: false, chip };
    const f = this.flask; if (f && Math.hypot(x - f.x, y - f.y) < f.sizePx * 0.46) return { kind: 'flask', button: false };
    const t = this.tray; if (t && t.count && t.hit(x, y) >= 0) return { kind: 'tray', button: false };
    const l = this.loot; if (l && l.visible && x > l.purse.x - 30 * k && x < l.purse.x + 70 * k && Math.abs(y - l.purse.y) < 28 * k) return { kind: 'purse', button: false };
    const u = H.plates.hit(x, y); if (u != null) return { kind: 'foe', button: true, uid: u };
    return null;
  }
  private content(t: Target, b: Battle2 | null): Tip | null {
    const H = this.h, k = H.k;
    switch (t.kind) {
      case 'reroll': {
        const r = b?.rerollInfo(), bi = b?.bloodInfo(), lines = ['选中骰子后点我，把它们重新投一遍', `本回合还能免费重投 ${r?.free ?? 0} 次`];
        if (r && r.bloodCost != null) lines.push(r.free > 0 ? '免费用完后卖血重投，血越卖越贵' : `免费用完：这次卖血重投 -${r.bloodCost} 血`);
        if (bi) lines.push(`斩首或完防：回合末还你卖掉的血的 ${Math.round(bi.ratio * 100)}%`);
        return { title: '重投', lines, x: H.reroll.x, y: H.reroll.y - H.reroll.sizePx * 0.6 };
      }
      case 'chant': {
        const mage = H.chant.v.mage !== false;
        const lines = mage ? ['不出手就结束回合 = 吟唱', '场上的骰子都留下，每回合补 1 颗（最多 6）', `吟唱环 ${H.chant.v.ring}/3，吟唱的回合有屏障`, '交 3 颗以内是小咒，照样吟唱；交 4 颗以上释放大招']
          : ['剩下的骰子回到队列，下回合再投出', '然后轮到敌人行动', '没骰子或没有能出的牌时会自动结束'];
        return { title: mage ? '吟唱（结束回合）' : '结束回合', lines, x: H.chant.x, y: H.chant.y - H.chant.sizePx * 0.6 };
      }
      case 'flask': {
        const p = b?.s.player, f = this.flask!; if (!p) return null;
        const lines: string[] = [];
        if (p.armor > 0) lines.push(`护甲 ${p.armor}：先挡直接伤害，你的回合开始时清零`);
        if (p.barrier > 0) lines.push(`屏障 ${p.barrier}：先挡直接伤害，你的回合开始时清零`);
        const po = p.statuses.find(s => s.type === 'poison')?.value ?? 0, bu = p.statuses.find(s => s.type === 'burn')?.value ?? 0;
        if (po + bu > 0) lines.push(`回合末${po ? ` 毒 ${po}` : ''}${bu ? ` 灼 ${bu}` : ''}：扣 ${po + bu} 血（无视护甲和屏障）`);
        const bi = b?.bloodInfo(); if (bi && bi.paid > 0) lines.push(`本回合卖血 ${bi.paid}，斩首或完防后回合末还 ${bi.refund}`);
        if (!lines.length) lines.push('挨打时先扣护甲和屏障，再扣生命', '毒和灼烧直接扣生命');
        return { title: `生命 ${p.hp} / ${p.maxHp}`, lines, x: f.x, y: f.y - f.sizePx * 0.55 };
      }
      case 'status': {
        const c = t.chip!, ax = this.ax, ay = this.ay - 24 * k;
        if ('more' in c) { const lines = c.more.map(i => { const s = statusLines(i.k, i.n, i.d, false); return `${s.title}：${s.lines[0] ?? ''}`; }); return { title: `还有 ${c.more.length} 个状态`, lines, x: ax, y: ay }; }
        const s = statusLines(c.ico.k, c.ico.n, c.ico.d, false); return { ...s, x: ax, y: ay };
      }
      case 'tray': { const n = this.tray!.count, p = this.tray!.slotPx(0); return { title: `骰子队列 ${n} 颗`, lines: ['这回合挣到的、没用掉的骰子在这里排队', '下回合开始时从这里扔进场地'], x: p.x, y: p.y - 50 * k }; }
      case 'purse': { const g = this.loot!.gold; return { title: `金币 ${g}`, lines: ['打倒敌人掉落', '在商人那里买遗物、升级技能'], x: this.loot!.purse.x + 40 * k, y: this.loot!.purse.y + 30 * k }; }
      case 'foe': {
        const v = t.uid != null ? H.plates.view(t.uid) : null, en = b && t.uid != null ? b.enemy(t.uid) : null; if (!v || !en) return null;
        const F = v.foe, lines: string[] = [], it = F.intent;
        if (it) lines.push(it.kind === 'atk' ? `下回合攻击 ${it.value ?? ''}${it.status ? '，附加' + (CN[it.status] || it.status) : ''}` : it.kind === 'def' ? `下回合防御：护甲 +${it.value ?? ''}` : it.kind === 'frz' ? '被控制：下回合不行动' : it.kind === 'curse' ? '往你的骰子里塞诅咒骰' : '下回合施法');
        if (F.taunt) lines.push('嘲讽：单体攻击只能打它');
        if (F.protected) lines.push('被保护：先打倒盾卫');
        if (F.armor > 0) lines.push(`护甲 ${F.armor}：先挡伤害，回合结束清零`);
        for (const s of F.statuses) { const d = statusLines(s.type as StatusV2, s.value, s.duration, true); lines.push(`${d.title}：${d.lines[0] ?? ''}`); }
        return { title: `${en.name}  生命 ${F.hp} / ${F.maxHp}`, lines, x: v.x, y: v.y - 8 * k };
      }
    }
  }
  private show(t: Target, b: Battle2 | null) { const c = this.content(t, b); if (!c) return; this.tip = c; this.pane.key = ''; cue('tick', 0.35); }
  hide() { this.tip = null; this.tapT = 0; this.shownByHold = false; }

  /** call first in the battle's pointer handler; true = consumed. b = the live battle (texts read the engine). */
  pointer(type: string, x: number, y: number, b: Battle2 | null): boolean {
    this.b = b;
    if (type === 'down') {
      this.ax = x; this.ay = y;
      if (this.tapT > 0) this.hide();
      const t = this.find(x, y); if (!t) return false;
      this.hold = { t, x0: x, y0: y, time: 0 }; this.shownByHold = false;
      return !t.button;   // buttons still get their press; the rest is ours
    }
    const H = this.hold; if (!H) return false;
    if (type === 'move') { if (Math.hypot(x - H.x0, y - H.y0) > SLOP * this.h.k) { this.hold = null; if (this.shownByHold) this.hide(); } return false; }
    // up / cancel
    this.hold = null;
    if (this.shownByHold) {   // read the tip, let go: nothing fires
      this.hide();
      if (H.t.kind === 'reroll') this.h.reroll.pointer('cancel', x, y); else if (H.t.kind === 'chant') this.h.chant.pointer('cancel', x, y);
      return true;
    }
    if (!H.t.button && type === 'up') { this.show(H.t, b); this.tapT = TAP_S; return true; }
    return false;
  }
  update(dt: number) {
    const H = this.hold;
    if (H && !this.shownByHold) { H.time += dt; if (H.time >= HOLD_S) { this.show(H.t, this.b); this.shownByHold = true; } }
    if (this.tapT > 0) { this.tapT -= dt; if (this.tapT <= 0) this.hide(); }
    this.draw();
  }
  private draw() {
    const t = this.tip; if (!t) { this.pane.visible = false; return; }
    const fp = labelFp(), bf = Math.max(fp, bigFp() >> 1), lh = textCellsH(fp) + 1;
    const w = Math.max(textCellsW(t.title, bf), ...t.lines.map(l => textCellsW(l, fp))) + 8, h = textCellsH(bf) + 8 + t.lines.length * lh;
    paintCells(this.pane, 'ht' + t.title + '|' + t.lines.join('|') + fp, w + 1, h + 1, pen => {
      const P = PANEL.tip; pen.panel(0, 0, w, h, P, 2);
      pen.text(t.title, 4, 3, { col: P.title, fp: bf }); pen.rect(4, 4 + textCellsH(bf), w - 8, 1, P.edge!);
      t.lines.forEach((l, j) => pen.text(l, 4, 6 + textCellsH(bf) + j * lh, { col: P.text, fp }));
    });
    // above the anchor, kept on screen (8 px margin)
    const W = this.pane.w, Hh = this.pane.h, sw = innerWidthOf(this.pane), sh = innerHeightOf(this.pane);
    const px = Math.max(8, Math.min(sw - W - 8, t.x - W / 2)), py = Math.max(8, Math.min(sh - Hh - 8, t.y - Hh));
    this.pane.at(Math.round(px), Math.round(py)); this.pane.visible = true;
    void GRID;
  }
}
// the overlay's size (CSS px): the pane's owner knows it; fall back to the window
const innerWidthOf = (p: Pane) => ((p as unknown as { ov?: { w: number } }).ov?.w ?? (typeof innerWidth !== 'undefined' ? innerWidth : 1280));
const innerHeightOf = (p: Pane) => ((p as unknown as { ov?: { h: number } }).ov?.h ?? (typeof innerHeight !== 'undefined' ? innerHeight : 720));
