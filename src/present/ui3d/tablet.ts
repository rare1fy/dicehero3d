// 技能碑: a carved stone tablet in the UI layer, 3..5 rows. Each row: the condition icon on the left (a suit icon, pair, straight,
// point sum, big points), five tier lamps and the predicted value on the right. A row that the selected dice satisfy lights up and
// lifts toward the camera; a row that cannot be played this turn shrinks to a thin groove; tapping a row picks it (hit test: CSS px
// → row index). Row data comes in from the caller (rules layer), the tablet only shows it.
import * as THREE from 'three';
import { V3 } from '../engine/world';
import { UiLayer } from './layer';
import { voxModel, iconCells, hexN, Spring, UiSparks } from './vox';
import { SUITS, COND_ICONS, type SuitId } from './suitData';
import { cue } from '../../audio/cues';

export type RowCond = { kind: 'suit'; suit: SuitId } | { kind: 'mix'; suits: SuitId[] } | { kind: 'pair' | 'straight' | 'sum' | 'big' | 'any' };
export interface TabletRow { id: string; cond: RowCond; /** lamp count (tiers) shown, ≤ 5 */ tiers?: number }
/** ready = satisfied by the selection (lit, lifted); idle = playable this turn but not by the selection; dead = cannot be played this turn */
export interface RowView { state: 'ready' | 'idle' | 'dead'; /** lamps lit (0..tiers) */ tier: number; /** predicted value, e.g. 18 */ value?: number | string; /** lamp colour per tier (default warm gold → violet) */ }

const STONE = 0x6a6470, STONE_D = 0x46404e, STONE_L = 0x8e8896, MOSS = 0x4a5a40, GOLD = 0xd8a040;
const TIER_LAMP = [0xffe2a8, 0x6ac8ff, 0xffc040, 0xff7030, 0xd060ff];
const RW = 34, RH = 9;   // row size in cells

interface Row { def: TabletRow; g: THREE.Group; lamps: THREE.Mesh[]; lampMats: THREE.MeshBasicMaterial[]; icon: THREE.Group; view: RowView; lift: Spring; open: number; y: number; pick: number; glow: THREE.MeshBasicMaterial }

export class SkillTablet {
  root = new THREE.Group(); rows: Row[] = []; private slab: THREE.Group | null = null; private sparks: UiSparks;
  x = 1060; y = 330; widthPx = 250; hover = -1;
  onPick: (i: number, id: string) => void = () => {};
  constructor(private L: UiLayer) { L.scene.add(this.root); this.sparks = new UiSparks(L.scene, 80); }
  place(x: number, y: number, widthPx: number) { this.x = x; this.y = y; this.widthPx = widthPx; }
  private get cell() { return this.L.px(this.widthPx) / (RW + 4); }

  setRows(defs: TabletRow[]) {
    for (const r of this.rows) this.root.remove(r.g);
    if (this.slab) this.root.remove(this.slab);
    const n = defs.length;
    // the back slab: a tall stone with a stepped top, a darker frame
    this.slab = voxModel(1, set => {
      const H = n * (RH + 1) + 3;
      for (let x = -RW / 2 - 2; x < RW / 2 + 2; x++) for (let y = -2; y < H; y++) {
        const top = y >= H - 2, inset = top && (x < -RW / 2 + 1 || x >= RW / 2 - 1); if (inset) continue;
        const frame = x < -RW / 2 || x >= RW / 2 || y < 0 || y >= H - 3;
        set(x, y, -2, STONE_D); set(x, y, -1, frame ? STONE : STONE_D);
        if (frame && (x + y) % 7 === 0 && y < 2) set(x, y, 0, MOSS);
      }
      for (let x = -3; x <= 2; x++) set(x, H - 2, 0, GOLD);   // a gold keystone on the top
    }, { centre: [0, (n * (RH + 1) + 1) / 2, 0] });
    this.root.add(this.slab);
    this.rows = defs.map((def, i) => this.buildRow(def, i, n));
    cue('reveal', 0.4);
  }
  private buildRow(def: TabletRow, i: number, n: number): Row {
    const g = new THREE.Group(), tiers = Math.min(5, def.tiers ?? 5);
    const plank = voxModel(1, set => {
      for (let x = -RW / 2; x < RW / 2; x++) for (let y = 0; y < RH; y++) { const edge = y === 0 || y === RH - 1 || x === -RW / 2 || x === RW / 2 - 1; set(x, y, 0, edge ? STONE_L : STONE); set(x, y, 1, edge ? STONE_L : STONE); }
      // the icon well on the left, and the lamp sockets
      for (let x = -RW / 2 + 1; x < -RW / 2 + 9; x++) for (let y = 1; y < RH - 1; y++) set(x, y, 1, STONE_D);
      for (let t = 0; t < 5; t++) { const lx = -7 + t * 3; set(lx, 3, 1, STONE_D); set(lx + 1, 3, 1, STONE_D); set(lx, 4, 1, STONE_D); set(lx + 1, 4, 1, STONE_D); }
    }, { centre: [0, RH / 2, 0] });
    g.add(plank);
    // condition icon (relief), 10×10 rows → scaled to 7 cells
    const mk = (S: { icon: string[]; col: string; accent?: string; dark: string } | null, rows: string[]) => {
      const col = S ? hexN(S.col) : 0xe8dcc0, acc = S?.accent ? hexN(S.accent) : col, dk = S ? hexN(S.dark) : 0x3a3040;
      return voxModel(1, set => iconCells(set, rows, 0, 0, 0, 2, ch => (ch === 'd' ? { c: dk } : ch === 'o' ? { c: acc, g: 1 } : { c: col })), { centre: [5, 5, 0] });
    };
    let icon: THREE.Group;
    if (def.cond.kind === 'mix') {
      // mixed-suit row: two suit icons side by side
      const two = [...new Set(def.cond.suits)].slice(0, 2); icon = new THREE.Group();
      two.forEach((sid, j) => { const m = mk(SUITS[sid], SUITS[sid].icon); m.scale.setScalar(0.4); m.position.set(two.length < 2 ? 0 : j ? 2 : -2, 0, 0); icon.add(m); });
    } else {
      const cd = def.cond, S = cd.kind === 'suit' ? SUITS[cd.suit] : null;
      icon = mk(S, cd.kind === 'suit' ? SUITS[cd.suit].icon : COND_ICONS[cd.kind]); icon.scale.setScalar(0.7);
    }
    icon.position.set(-RW / 2 + 5, 0, 2.2); g.add(icon);
    // lamps
    const lamps: THREE.Mesh[] = [], lampMats: THREE.MeshBasicMaterial[] = [];
    for (let t = 0; t < tiers; t++) {
      const mt = new THREE.MeshBasicMaterial({ color: 0x2a2430, toneMapped: false }), lm = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), mt);
      lm.position.set(-7 + t * 3 + 1, 0, 2); g.add(lm); lamps.push(lm); lampMats.push(mt);
    }
    // a glow plate behind the row (additive), shown when ready
    const glow = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(RW + 2, RH + 2), glow); gp.position.z = -0.4; g.add(gp);
    this.root.add(g);
    const y = (n - 1 - i) * (RH + 1) - ((n - 1) * (RH + 1)) / 2;
    return { def, g, lamps, lampMats, icon, view: { state: 'idle', tier: 0 }, lift: new Spring(220, 15), open: 1, y, pick: 0, glow };
  }
  /** update one row's view (call when the selection or the dice change) */
  setView(i: number, v: RowView) {
    const r = this.rows[i]; if (!r) return;
    if (v.state === 'ready' && r.view.state !== 'ready') { r.lift.kick(10); cue('select', 0.5); }
    r.view = { ...v };
  }
  /** the picked-row beat: the row flashes and pops, sparks off the lamps */
  flash(i: number) {
    const r = this.rows[i]; if (!r) return; r.pick = 1; r.lift.kick(24); cue('crit', 0.5);
    const p = r.g.getWorldPosition(V3()); this.sparks.burst(p.setZ(p.z + 1), 22, this.L.px(320), this.L.px(5), TIER_LAMP[Math.max(0, r.view.tier - 1)] ?? 0xffe2a8, { life: 0.5 });
  }
  /** CSS px → row index (−1 = none). Dead rows are not hittable. */
  hit(x: number, y: number) {
    for (let i = 0; i < this.rows.length; i++) {
      const r = this.rows[i]; if (r.view.state === 'dead') continue;
      const c = this.L.toPx(r.g.getWorldPosition(V3())), hw = this.widthPx / 2, hh = (this.widthPx / (RW + 4)) * RH / 2 * Math.max(0.3, r.open);
      if (Math.abs(x - c.x) < hw && Math.abs(y - c.y) < hh) return i;
    }
    return -1;
  }
  pointer(type: string, x: number, y: number) {
    const i = this.hit(x, y); this.hover = type === 'up' || type === 'cancel' ? -1 : i;
    if (type === 'down' && i >= 0 && this.rows[i].view.state === 'ready') { this.flash(i); this.onPick(i, this.rows[i].def.id); return true; }
    if (type === 'down' && i >= 0) { cue('deny', 0.4); return true; }
    return false;
  }
  /** screen px of row i's lamp end (where a fly-out can start) */
  rowPx(i: number) { const r = this.rows[i]; return r ? this.L.toPx(r.g.localToWorld(V3(RW / 2 - 4, 0, 2))) : { x: this.x, y: this.y }; }

  update(dt: number, time: number) {
    const L = this.L, c = this.cell;
    L.at(this.x, this.y, 0, this.root.position); this.root.scale.setScalar(c);
    this.root.rotation.set(-0.06, -0.32, 0);   // turned toward the centre of the screen: its left edge comes forward
    this.rows.forEach((r, i) => {
      const v = r.view, ready = v.state === 'ready', dead = v.state === 'dead';
      r.open += ((dead ? 0.14 : 1) - r.open) * Math.min(1, dt * 10);
      const lf = r.lift.step(ready ? 1 : 0, dt);
      r.pick = Math.max(0, r.pick - dt * 2.5);
      r.g.position.set(ready ? -0.6 : 0, r.y, 1 + lf * 2.4 + (this.hover === i && !dead ? 0.6 : 0));
      r.g.scale.set(1, Math.max(0.05, r.open), 1);
      r.icon.visible = r.open > 0.5;
      const tiers = r.lamps.length;
      r.lampMats.forEach((m, t) => {
        const on = t < v.tier && !dead, k = ready ? 1.7 + 0.3 * Math.sin(time * 6 + t) : 0.75;
        if (on) m.color.setHex(TIER_LAMP[t]).multiplyScalar(k); else m.color.setHex(dead ? 0x1a161e : 0x2a2430);
        r.lamps[t].visible = r.open > 0.5; void tiers;
      });
      r.glow.opacity = (ready ? 0.22 + 0.08 * Math.sin(time * 4) : 0) + r.pick * 0.6;
      const ep = L.toPx(r.g.localToWorld(V3(RW / 2 - 4.5, 0, 2)));
      L.text.set(`tab.${i}`, { text: dead || v.value == null ? '' : String(v.value), x: ep.x, y: ep.y, cell: ready ? 4 : 3, color: ready ? '#ffe9a8' : '#a89cb4', align: 'center', alpha: Math.max(0, r.open - 0.4) / 0.6 });
    });
    for (let i = this.rows.length; i < 6; i++) L.text.hide(`tab.${i}`);
    this.sparks.update(dt);
  }
}
