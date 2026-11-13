// R5 battle HUD façade: owns the parts rebuilt to the approved mockup (top-left gold + relics, enemy plates + target ring + damage
// bubble, reroll button with lamps and orbiting dice, the floating prep dice spots, the centred heart flask with buff / debuff rows,
// the four-slot skill bar that grows a play button, the drag-aim arrow, the mage chant button, marks on the field dice) and lays them
// out in 1280×720 reference px × k (k = H / 720; right-hand parts anchored to the right edge). show2 feeds it data and taps.
import type { UiLayer } from '../../ui3d/layer';
import type { Overlay } from '../overlay';
import type { HeartFlask } from '../../ui3d/flask';
import type { DiceTray } from '../../ui3d/tray';
import type { Loot } from '../../ui3d/loot';
import type { Effect, StatusV2 } from '../../../core/v2/types';
import { SkillBar } from './skillBar';
import { RerollButton } from './reroll';
import { ChantButton } from './chant';
import { FoePlates, ST_GLYPH } from './plates';
import { TopLeft } from './topLeft';
import { StatusRows } from './status';
import { FieldMarks } from './fieldMarks';
import type { Glyph } from './draw';
import { setGrid, GRID } from '../../ui3d/pixelGrid';
import { turnInsets } from '../../../platform/rotate';

/** the ≤4-char tag under each skill (UX_V3 §2) and the tier-3 upgraded icon */
const TAGS: Record<string, string> = { 奥术弹: '单体', 冰锥: '控制', 闪电链: '弹射', 陨石: '爆发', 劈砍: '单体', 顺劈斩: '横扫', 盾墙: '防御', 狂血: '吸血', 袖箭: '补骰', 背刺: '处决', 影步: '补骰', 毒雾: '群毒',
  /* rules v4 names */ 铁壁: '防御', 盾冲: '控制', 血战: '爆发', 影舞: '群毒' };
const UP: Record<string, string> = { 冰锥: '冰环', 盾墙: '铁壁', 狂血: '血战', 毒雾: '影舞' };
export const skillTag = (name: string) => TAGS[name] || '单体';
export const skillUp = (name: string) => UP[name];
/** the icon of what a tier adds beyond damage (shown on the button from tier 2) */
export function extraGlyph(fx: Effect[]): Glyph | null {
  for (const e of fx) {
    if (e.t === 'stun') return e.look === 'freeze' ? 'snow' : 'star';
    if (e.t === 'status' && ST_GLYPH[e.status as StatusV2]) return ST_GLYPH[e.status as StatusV2].g;
    if (e.t === 'armor' || e.t === 'taunt') return 'shield';
    if (e.t === 'heal') return 'heart';
    if (e.t === 'barrier') return 'ring';
    if (e.t === 'spawnShadow' || e.t === 'earnDie') return 'star';
  }
  return null;
}

/** CSS env(safe-area-inset-*) in px (browser; 0 elsewhere), turned into game space when the canvas is rotated (platform/rotate.ts) */
let insets: { l: number; r: number; t: number; b: number } | null = null;
export function safeInsets() {
  if (insets) return turnInsets(insets);
  insets = { l: 0, r: 0, t: 0, b: 0 };
  try {
    if (typeof document === 'undefined' || !document.body) return insets;
    const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(d); const cs = getComputedStyle(d);
    insets = { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0, t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 }; d.remove();
  } catch { /* no DOM */ }
  return turnInsets(insets);
}

export class BattleHud {
  bar: SkillBar; reroll: RerollButton; chant: ChantButton; plates: FoePlates; top: TopLeft; status: StatusRows; marks: FieldMarks;
  W = 1280; H = 720; k = 1;
  constructor(private L: UiLayer, ov: Overlay) {
    this.bar = new SkillBar(L, ov); this.reroll = new RerollButton(L, ov); this.chant = new ChantButton(L, ov);
    this.plates = new FoePlates(ov); this.top = new TopLeft(L, ov); this.status = new StatusRows(ov, L); this.marks = new FieldMarks();
  }
  /** the HUD frame: the whole safe area — the left group anchors to its left edge, the right group to its right edge (user: 「两边UI的位置
   *  要根据屏幕的宽度适配」), k = px per reference px (from the height, capped by the width) */
  frame = { L0: 0, R0: 1280, k: 1, B: 720, top: 0 };
  layout(W: number, H: number, flask: HeartFlask, tray: DiceTray, loot: Loot) {
    const sa = safeInsets(), sw = W - sa.l - sa.r, sh = H - sa.t - sa.b;
    const k = Math.min(1.6, sh / 720, sw / 1280), L0 = sa.l, R0 = W - sa.r;
    setGrid(sh, this.L.dpr || 1);
    this.W = W; this.H = H; this.k = k; this.frame = { L0, R0, k, B: sa.t + sh, top: sa.t };
    const X = (x: number) => L0 + x * k, R = (x: number) => R0 - x * k, Y = (y: number) => sa.t + y * k;   // R(x) = x ref px in from the right
    // UX_V3 §1b: thumbs — reroll ≈ (left + 200, 560), play button ≈ (right − 200, 548), chant ≥ 64 from the right at y ≈ 400
    this.top.place(X(116), Y(42), k); loot.purse = this.top.purse(); loot.emblem = this.top.purse(); loot.bagPx = 40 * k;
    this.reroll.place(X(200), Y(560), 124 * k, k);
    // left player zone (user: 「血瓶在中间感觉好孤独」): reroll + flask + status rows stacked to the flask's right, all on the left
    flask.place(X(350), Y(626), 136 * k); this.status.place(X(350), Y(632), 120 * k, k); this.status.stack = true;
    this.chant.place(R(118), Y(330), 104 * k); this.chant.k = k;   // user 11-13: was y 400, it ran into the grown play button
    this.bar.layout(W, H, k, R0, sa.t); this.plates.k = k; this.bar.arrow.k = k;
    // the prep area: an irregular cluster above-left of the hero, over the reroll's top edge (no base)
    const spots = [[140, 436], [206, 452], [84, 452], [110, 376], [178, 370], [50, 392]];
    tray.sizePx = 50 * k; tray.still = true; tray.slotFn = (i: number) => { const s = spots[Math.min(spots.length - 1, i)]; return { x: X(s[0]), y: Y(s[1]) }; };
  }
  /** battle widgets on / off (top-left stays with the run) */
  battle(on: boolean, mage: boolean) {
    this.bar.show(on); this.reroll.root.visible = on; this.chant.root.visible = on; this.chant.v.mage = mage; this.status.on = on;
    if (!on) { this.plates.clear(); this.marks.hide(); this.bar.endAim(); }
  }
  runOn(on: boolean) { this.top.on = on; }
  update(dt: number) { this.bar.update(dt); this.reroll.update(dt); this.chant.update(dt); this.top.update(dt); }
}
