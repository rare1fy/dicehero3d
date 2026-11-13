// Rules v3 skill UI: four resident skill slots (散骰 / 同点 / 顺子 / 阵列: icon, name, tier lamps; tap = tier notes), the lit skill
// cards that fly out of their slot and grow at the right thumb (energy motes orbiting them), and the drag arrow from a card to an
// enemy (a segmented voxel arc rising toward the camera, pixel arrowhead). Data comes from the caller; nothing here reads rules.
import * as THREE from 'three';
import { panel, icon, text, textW, pixWrap, PIX_H, type Overlay, type Pane, type Rect } from './overlay';
import type { UiLayer } from '../ui3d/layer';
import { ease, lerp } from '../engine/clock';

export type SkillKind = 'basic' | 'same' | 'straight' | 'array';
export interface SlotDef { name: string; kind: SkillKind; level: number; steps: string[]; lines: string[] }
export interface SlotView { lit: boolean; tier: number; dead: boolean }
export interface CardDef<R = unknown> { slot: number; ref: R; name: string; sub: string; value: string; extra?: string; all: boolean; tier: number; ultimate: boolean }

export const TIER_HEX = ['#ffe2a8', '#6ac8ff', '#ffc040', '#ff7030', '#d060ff'];
const ROMAN = ['', 'I', 'II', 'III'];
export const KIND_ICON: Record<SkillKind, string[]> = {
  basic: ['..........', '..######..', '.#......#.', '.#......#.', '.#..oo..#.', '.#..oo..#.', '.#......#.', '.#......#.', '..######..', '..........'],
  same: ['..........', '####..####', '#..#..#..#', '#oo#..#oo#', '#oo#..#oo#', '#..#..#..#', '####..####', '..........', '..........', '..........'],
  straight: ['..........', '........##', '........##', '.....##.##', '.....##.##', '..##.##.##', '..##.##.##', '##.##.##.#', '##########', '##########'],
  array: ['###.###...', '#o#.#o#...', '###.###...', '..........', '..........', '...###.###', '...#o#.#o#', '...###.###', '..........', '..........'],
};

interface Card<R> { def: CardDef<R>; pane: Pane; k: number; out: number; from: { x: number; y: number }; x: number; y: number; w: number; h: number; key: string }
interface Orbit { cx: number; cy: number; rx: number; ry: number; col: number; n: number; speed: number }

export class SkillUI<R = unknown> {
  defs: SlotDef[] = []; views: SlotView[] = []; rects: Rect[] = []; cards: Card<R>[] = [];
  private slots: Pane[] = []; private tip: Pane; tipOn = -1; on = false; k = 1; W = 1280; H = 720;
  /** extra glows (e.g. the mage's chant button) */
  auras: Orbit[] = [];
  arrow: { x0: number; y0: number; x1: number; y1: number; hot: boolean } | null = null;
  private motes: THREE.Mesh[] = []; private moteMats: THREE.MeshBasicMaterial[] = []; private segs: THREE.Mesh[] = []; private segMat: THREE.MeshBasicMaterial; private segMat2: THREE.MeshBasicMaterial;
  private head: THREE.Group; private headMat: THREE.MeshBasicMaterial; private t = 0;
  constructor(private ov: Overlay, private L: UiLayer) {
    for (let i = 0; i < 4; i++) this.slots.push(ov.pane(9));
    this.tip = ov.pane(12);
    const box = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 64; i++) { const m = new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); const s = new THREE.Mesh(box, m); s.visible = false; s.renderOrder = 40; L.scene.add(s); this.motes.push(s); this.moteMats.push(m); }
    this.segMat = new THREE.MeshBasicMaterial({ color: 0xffd060, toneMapped: false }); this.segMat2 = new THREE.MeshBasicMaterial({ color: 0x8a5a20, toneMapped: false });
    for (let i = 0; i < 18; i++) { const s = new THREE.Mesh(box, i % 2 ? this.segMat2 : this.segMat); s.visible = false; s.renderOrder = 41; L.scene.add(s); this.segs.push(s); }
    // the pixel arrowhead: a stepped voxel triangle pointing +x (cells of 1)
    this.headMat = new THREE.MeshBasicMaterial({ color: 0xffd060, toneMapped: false }); this.head = new THREE.Group();
    for (let c = 0; c < 5; c++) for (let r = -(4 - c); r <= 4 - c; r++) { const m = new THREE.Mesh(box, this.headMat); m.position.set(c, r, 0); this.head.add(m); }
    const dark = new THREE.MeshBasicMaterial({ color: 0x07050a, toneMapped: false });
    for (let c = -1; c < 6; c++) { const hgt = Math.max(0, 5 - c); for (const r of [-hgt, hgt]) { const m = new THREE.Mesh(box, dark); m.position.set(c, r, -0.5); this.head.add(m); } }
    this.head.visible = false; this.head.renderOrder = 42; L.scene.add(this.head);
  }
  layout(W: number, H: number, k: number) {
    this.W = W; this.H = H; this.k = k;
    const w = Math.round(Math.max(150, 176 * k)), h = Math.round(Math.max(40, 46 * k)), x = W - w - 12, y0 = Math.round(92 * k);
    this.rects = [0, 1, 2, 3].map(i => ({ x, y: y0 + i * (h + 6), w, h }));
    for (const s of this.slots) s.key = ''; this.placeCards();
  }
  show(on: boolean) { this.on = on; if (!on) { this.setCards([]); this.tipOn = -1; this.arrow = null; this.auras = []; } }
  setSlots(defs: SlotDef[]) { this.defs = defs; this.views = defs.map(() => ({ lit: false, tier: 0, dead: false })); this.tipOn = -1; for (const s of this.slots) s.key = ''; }
  setViews(v: SlotView[]) { this.views = v; }
  hitSlot(x: number, y: number) { if (!this.on) return -1; return this.rects.findIndex((r, i) => i < this.defs.length && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h); }
  hitCard(x: number, y: number) { if (!this.on) return -1; return this.cards.findIndex(c => !c.out && c.k > 0.5 && Math.abs(x - c.x) <= c.w / 2 && Math.abs(y - c.y) <= c.h / 2); }
  toggleTip(i: number) { this.tipOn = this.tipOn === i ? -1 : i; }
  cardSize() { return { w: Math.round(Math.max(200, 240 * this.k)), h: Math.round(Math.max(140, 162 * this.k)) }; }

  /** the lit skills: kept cards update in place, new ones fly out of their slot, missing ones fade */
  setCards(defs: CardDef<R>[]) {
    const live = this.cards.filter(c => !c.out);
    for (const c of live) if (!defs.some(d => d.slot === c.def.slot)) c.out = 0.001;
    for (const d of defs) {
      const c = live.find(x => x.def.slot === d.slot), key = [d.name, d.sub, d.value, d.extra, d.tier, d.all].join('|');
      if (c) { if (c.key !== key) { c.def = d; c.key = key; c.pane.key = ''; } continue; }
      const r = this.rects[d.slot] || { x: this.W, y: this.H / 2, w: 10, h: 10 };
      this.cards.push({ def: d, pane: this.ov.pane(14), k: 0, out: 0, from: { x: r.x + r.w / 2, y: r.y + r.h / 2 }, x: 0, y: 0, w: 0, h: 0, key });
    }
    this.cards.sort((a, b) => a.def.slot - b.def.slot); this.placeCards();
  }
  private placeCards() {
    const live = this.cards.filter(c => !c.out), { w, h } = this.cardSize(), n = live.length;
    live.forEach((c, i) => { c.w = w; c.h = h; c.x = this.W - 16 - w / 2 - (n - 1 - i) * (w + 12); c.y = this.H - 16 - h / 2; });
  }

  update(dt: number) {
    this.t += dt;
    const ov = this.ov, d = ov.dpr, fp = ov.fp;
    // slots
    this.slots.forEach((p, i) => {
      const def = this.defs[i], r = this.rects[i]; if (!this.on || !def || !r) { p.visible = false; return; }
      const v = this.views[i] || { lit: false, tier: 0, dead: false };
      p.paint(['s', def.name, def.level, v.lit, v.tier, v.dead, r.w, r.h, d, this.tipOn === i].join('|'), r.w, r.h, g => drawSlot(g, d, r.w, r.h, fp, def, v, this.tipOn === i));
      p.at(r.x - (v.lit ? 10 : 0), r.y); p.visible = true;
    });
    // tier notes
    const ti = this.tipOn, td = this.defs[ti], tr = this.rects[ti];
    if (this.on && td && tr) {
      const s = Math.max(1, Math.round(fp * d)), w = Math.round(270 * Math.max(0.8, this.k)), lines = td.lines.flatMap(l => pixWrap(l, (w - 20) * d / s)), lh = PIX_H * s / d + 4, h = 34 + lines.length * lh;
      this.tip.paint('t' + ti + td.lines.join('|') + w + d, w, h, g => {
        panel(g, 0, 0, w * d, h * d, 2 * d, { body: '#140e18', rim: '#c8a060', line: '#07050a', hi: '#221a28' });
        text(g, `${td.name} ${ROMAN[td.level] || ''}`, 10 * d, 6 * d, s, '#ffe6a0');
        lines.forEach((l, j) => text(g, l, 10 * d, (28 + j * lh) * d, s, '#e8dcc8'));
      });
      this.tip.at(tr.x - w - 8, Math.min(this.H - h - 8, tr.y)); this.tip.visible = true;
    } else this.tip.visible = false;
    // cards
    for (const c of this.cards) {
      if (c.out) c.out += dt / 0.18; else c.k = Math.min(1, c.k + dt / 0.32);
      const e = ease.outBack(c.k), sc = c.out ? 1 + c.out * 0.25 : lerp(0.3, 1, Math.min(1, e));
      c.pane.paint(c.key + c.w + d, c.w, c.h, g => drawCard(g, d, c.w, c.h, fp, c.def));
      c.pane.scale = sc; c.pane.alpha = c.out ? Math.max(0, 1 - c.out) : Math.min(1, c.k * 2.5);
      c.pane.at(lerp(c.from.x, c.x, e) - c.w / 2, lerp(c.from.y, c.y, e) - c.h / 2); c.pane.visible = this.on;
    }
    for (const c of this.cards.filter(x => x.out >= 1)) this.ov.drop(c.pane);
    this.cards = this.cards.filter(x => x.out < 1);
    // energy motes around the cards and the auras
    const orbits: Orbit[] = this.on ? [...this.cards.filter(c => !c.out && c.k > 0.4).map(c => ({ cx: c.x, cy: c.y, rx: c.w * 0.58, ry: c.h * 0.62, col: hexN(TIER_HEX[Math.min(4, c.def.ultimate ? 4 : c.def.tier - 1)] || TIER_HEX[0]), n: c.def.ultimate ? 22 : 12 + c.def.tier * 3, speed: 1.6 + c.def.tier * 0.5 })), ...this.auras] : [];
    let m = 0;
    for (const o of orbits) for (let j = 0; j < o.n && m < this.motes.length; j++, m++) {
      const a = this.t * o.speed + (j / o.n) * Math.PI * 2, wob = Math.sin(this.t * 3 + j * 1.7);
      const px = o.cx + Math.cos(a) * o.rx * (1 + 0.06 * wob), py = o.cy + Math.sin(a) * o.ry * (1 + 0.06 * wob), z = this.L.px(40) * Math.sin(a);
      const s = this.motes[m]; this.L.at(px, py, z, s.position); s.scale.setScalar(this.L.px(5 + 2.5 * (0.5 + 0.5 * Math.sin(a * 2 + j)), z)); s.rotation.z = a;
      this.moteMats[m].color.setHex(o.col); this.moteMats[m].opacity = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(a)); s.visible = true;
    }
    for (; m < this.motes.length; m++) this.motes[m].visible = false;
    // the drag arrow
    const A = this.on ? this.arrow : null;
    if (!A) { for (const s of this.segs) s.visible = false; this.head.visible = false; return; }
    const col = A.hot ? 0xff6a3a : 0xffd060; this.segMat.color.setHex(col); this.headMat.color.setHex(col); this.segMat2.color.setHex(A.hot ? 0x8a2a10 : 0x8a5a20);
    const dx = A.x1 - A.x0, dy = A.y1 - A.y0, dist = Math.hypot(dx, dy), cx = (A.x0 + A.x1) / 2, cy = (A.y0 + A.y1) / 2 - Math.min(150, dist * 0.28);
    const bez = (t: number) => ({ x: (1 - t) ** 2 * A.x0 + 2 * (1 - t) * t * cx + t * t * A.x1, y: (1 - t) ** 2 * A.y0 + 2 * (1 - t) * t * cy + t * t * A.y1 });
    const n = this.segs.length, lift = this.L.px(70), endT = Math.max(0.6, 1 - 40 / Math.max(1, dist));
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5) / n) * endT, p = bez(t), q = bez(t + 0.01), z = lift * Math.sin(Math.PI * t), s = this.segs[i];
      this.L.at(p.x, p.y, z, s.position); s.rotation.set(0, 0, Math.atan2(-(q.y - p.y), q.x - p.x));
      const sz = this.L.px(9 + 5 * Math.sin(Math.PI * t), z); s.scale.set(sz * 1.5, sz, sz); s.visible = true;
    }
    const pe = bez(1), pb = bez(0.97); this.L.at(pe.x, pe.y, 0, this.head.position); this.head.rotation.set(0, 0, Math.atan2(-(pe.y - pb.y), pe.x - pb.x));
    this.head.position.add(new THREE.Vector3(-Math.cos(this.head.rotation.z), -Math.sin(this.head.rotation.z), 0).multiplyScalar(this.L.px(22)));
    this.head.scale.setScalar(this.L.px(4.2 + 0.4 * Math.sin(this.t * 10))); this.head.visible = true;
  }
}

const hexN = (h: string) => parseInt(h.slice(1), 16);
function drawSlot(g: CanvasRenderingContext2D, d: number, w: number, h: number, fp: number, def: SlotDef, v: SlotView, open: boolean) {
  const rim = v.lit ? '#ffd060' : v.dead ? '#3a3442' : open ? '#c8a060' : '#6a5a78', body = v.lit ? '#2e2214' : v.dead ? '#100c14' : '#1a1422';
  panel(g, 0, 0, w * d, h * d, 2 * d, { body, rim, line: '#07050a', hi: v.lit ? '#3e2e1a' : '#241c2c' });
  const ic = Math.max(2, Math.round((h - 12) / 10)) * d;
  icon(g, KIND_ICON[def.kind], 7 * d, (h * d - 10 * ic) / 2, ic, { main: v.lit ? '#ffe6a0' : v.dead ? '#4a4252' : '#c8bcd4', acc: v.lit ? '#ff9a40' : '#8a7aa0' });
  const s = Math.max(1, Math.round(fp * d)), tx = 14 * d + 10 * ic;
  text(g, `${def.name}${def.level > 1 ? ' ' + ROMAN[def.level] : ''}`, tx, 5 * d, s, v.lit ? '#fff2d0' : v.dead ? '#6a6072' : '#e8dcf0');
  const n = def.steps.length, lw = 9 * d, ly = h * d - 12 * d;
  for (let i = 0; i < n; i++) {
    const on = i < v.tier && !v.dead; g.fillStyle = '#07050a'; g.fillRect(tx + i * (lw + 4 * d) - d, ly - d, lw + 2 * d, 7 * d);
    g.fillStyle = on ? TIER_HEX[i] : '#3a3040'; g.fillRect(tx + i * (lw + 4 * d), ly, lw, 5 * d);
  }
  void textW;
}
function drawCard(g: CanvasRenderingContext2D, d: number, w: number, h: number, fp: number, c: CardDef) {
  const col = c.ultimate ? TIER_HEX[4] : TIER_HEX[Math.max(0, Math.min(4, c.tier - 1))];
  panel(g, 0, 0, w * d, h * d, 3 * d, { body: '#1e1610', rim: col, line: '#07050a', hi: '#3a2a18' });
  g.fillStyle = col; g.globalAlpha = 0.18; g.fillRect(3 * d, 3 * d, w * d - 6 * d, 26 * d); g.globalAlpha = 1;
  const ic = Math.round(2.6 * d), s2 = Math.max(1, Math.round(fp * 1.5 * d)), s1 = Math.max(1, Math.round(fp * d)), s0 = Math.max(1, Math.round(fp * 0.75 * d));
  icon(g, KIND_ICON[kindOfName(c)], 10 * d, 10 * d, ic, { main: '#fff2d0', acc: col });
  const tx = 18 * d + 10 * ic;
  text(g, c.name, tx, 7 * d, s2, '#fff6e0');
  let y = 9 * d + PIX_H * s2;
  text(g, c.sub + (c.all ? ' · 全体' : ''), tx, y, s1, col); y += PIX_H * s1 + 6 * d;
  if (c.value) { text(g, c.value, w * d / 2, y, s2, '#ffe08a', 'center'); y += PIX_H * s2 + 3 * d; }
  if (c.extra) { text(g, c.extra, w * d / 2, y, s1, '#ffb070', 'center'); y += PIX_H * s1 + 2 * d; }
  const hy = h * d - PIX_H * s0 - 6 * d;
  if (hy >= y) text(g, c.all ? '点击出手' : '点击 / 拖向敌人', w * d / 2, hy, s0, '#9a8a70', 'center');
}
/** cards carry the slot kind through their slot index order: 0 散骰, 1 同点, 2 顺子, 3 阵列 */
function kindOfName(c: CardDef): SkillKind { return (['basic', 'same', 'straight', 'array'] as SkillKind[])[c.slot] || 'basic'; }
