// Long-press a die → a tip (user: 「长按骰子要有说明tips」): its value, what kind of die it is and what that kind does, and the
// controls. Pixel panel next to the die (overlay.ts helpers, Fusion Pixel font).
import type { DieKind } from '../../../core/v2/types';
import { type Overlay, type Pane, panel, text, textW, PIX_H } from '../overlay';

const KIND: Record<DieKind, { name: string; col: string; desc: string[] }> = {
  normal: { name: '普通骰', col: '#e8dcc8', desc: ['交出时按点数计入伤害或护甲'] },
  furyDie: { name: '怒火骰', col: '#ff7a5a', desc: ['所在出手的伤害或护甲 +50%', '没用掉留到下回合（最多 1 颗）'] },
  titanDie: { name: '泰坦骰', col: '#ffb860', desc: ['点数更大的特殊骰'] },
  starDie: { name: '星辰骰', col: '#7ae0ff', desc: ['交出时伤害 +15%', '超载后 2 回合新补的骰子'] },
  shadowDie: { name: '暗影骰', col: '#c89aff', desc: ['刺客补出来的骰子，当回合能用', '回合结束时消散'] },
  cracked: { name: '碎裂骰', col: '#a89a8a', desc: ['敌人塞进来的垃圾骰，点数只有 1～2'] },
  cursed: { name: '诅咒骰', col: '#c070d0', desc: ['敌人塞进来的垃圾骰，不能免费重投'] },
};

export class DieTip {
  p: Pane; on = false;
  constructor(private ov: Overlay) { this.p = ov.pane(66); this.p.visible = false; }
  show(value: number, kind: DieKind, x: number, y: number, kept = false) {
    const ov = this.ov, k = ov.dpr, fp = ov.fp, s1 = Math.max(1, Math.round(fp)), s2 = Math.max(2, Math.round(fp * 1.5));
    const K = KIND[kind] ?? KIND.normal, lines = [...K.desc, ...(kept ? ['魔导留场的骰子，下回合还在'] : []), '点：选中 / 取消　按住滑过：多选'];
    const head = `${K.name} · ${value} 点`, w = Math.max(textW(head, s2), ...lines.map(l => textW(l, s1))) + 32, h = PIX_H * s2 + 14 + lines.length * (PIX_H * s1 + 6) + 18;
    this.p.paint('dt' + head + lines.join('|') + w, w, h, g => {
      panel(g, 0, 0, w * k, h * k, 3 * k, { body: 'rgba(16,12,20,0.95)', rim: K.col, line: '#07050a', hi: 'rgba(255,255,255,0.06)' });
      text(g, head, 14 * k, 10 * k, s2 * k, K.col);
      lines.forEach((l, i) => text(g, l, 14 * k, (10 + PIX_H * s2 + 10 + i * (PIX_H * s1 + 6)) * k, s1 * k, i === lines.length - 1 ? '#9a8aa8' : '#e0d4ec'));
    });
    const px = Math.max(8, Math.min(ov.w - w - 8, x - w / 2)), py = Math.max(8, y - h - 48);
    this.p.at(px, py); this.p.visible = true; this.on = true;
  }
  hide() { this.p.visible = false; this.on = false; }
}
