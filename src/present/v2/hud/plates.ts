// R6 enemy plates in the hi-res pixel style (UX_V3 §4 / §6b + the mockup): a pixel capsule with the intent icon + square digits
// (sword red / shield blue / frozen = grey with an ice frame / skill / curse), a pixel HP bar (1u ink line, two reds + a 1u
// highlight, the lost chunk shrinking back over ~0.4 s, the number pressed onto the bar), the armor shield on its left end and a
// row of status chips (pixel icon + corner number). Every pane is painted on the art grid (paintCells: 1 cell = GRID.u device px,
// never scaled). Under the current target a red ring lies on the ground; while aiming, the hovered enemy gets a red pixel "-N" box.
import * as THREE from 'three';
import { scene, V3 } from '../../engine/world';
import { worldToUi } from '../../ui3d/layer';
import type { Overlay, Pane } from '../overlay';
import type { Glyph } from './draw';
import type { StatusV2 } from '../../../core/v2/types';
import { HpTrail } from '../hpDisplay';
import { paintCells } from '../../ui3d/pixDraw';
import { GRID } from '../../ui3d/pixelGrid';
import { pixGlyph, CHIP } from './pixIcons';
import { BAR_H, PILL_H, CHIP_STEP, intentW, paintIntent, paintBar, paintArmor, paintTaunt, paintLock, paintChip, paintBubble, bubbleSize, paintBoss, bossSize, type IntentView } from './platePaint';
import { installPixDebug } from './plateDemo';

export interface FoeView { uid: number; at: THREE.Vector3; foot: THREE.Vector3; width: number; hp: number; maxHp: number; armor: number; big: boolean; boss?: boolean; taunt?: boolean; protected?: boolean; dying?: boolean; /** R6_CONTRACT: where the lost-HP ghost starts (the HP before the hit frame); omitted = the plate tracks it itself */ trail?: number;
  intent: { kind: string; value?: number; status?: string } | null; statuses: Array<{ type: StatusV2; value: number; duration?: number }> }

export const ST_GLYPH: Record<StatusV2, { g: Glyph; col: string }> = {
  poison: { g: 'drop', col: '#5ae03a' }, burn: { g: 'fire', col: '#ff7a20' }, freeze: { g: 'crystal', col: '#8ad8ff' }, stun: { g: 'star', col: '#ffe060' },
  vulnerable: { g: 'crack', col: '#ff6a4a' }, weak: { g: 'broken', col: '#c8c8d8' }, berserk: { g: 'fist', col: '#ff5a4a' },
};

/** a plate's layout in cells (the pane is W × H cells; the bar is centred on the foe; the chips are the bottom row) */
export interface PlateLay { W: number; H: number; cw: number; barX: number; barY: number; barW: number; pillX: number; pillY: number; pillW: number; chipX: number; chipY: number; n: number }
export function plateLayout(f: Pick<FoeView, 'big' | 'taunt' | 'protected' | 'armor'>, it: IntentView | null, stOn: boolean, n: number): PlateLay {
  const barW = f.big ? 52 : 40, pillW = it ? intentW(it, stOn) : 0, chipsW = n ? n * CHIP_STEP - 1 : 0;
  const badge = f.taunt || f.protected ? 13 : 0, armorL = f.armor > 0 ? 6 : 0;
  const rowW = it ? Math.max(pillW + 2 * badge, barW + 2 * (armorL + 2)) : barW + 2 * (badge + armorL + 2);
  const cw = Math.max(barW + 4, pillW, chipsW, rowW);
  let W = cw + 4; if ((W - barW) % 2) W++;
  let y = 2; const pillY = y; if (it) y += PILL_H + 3;
  const barY = y; y += BAR_H; const chipY = y + 3; if (n) y += 3 + CHIP;
  return { W, H: y + 3, cw: Math.max(barW, pillW, chipsW), barX: (W - barW) / 2, barY, barW, pillX: Math.floor((W - pillW) / 2), pillY, pillW, chipX: Math.floor((W - chipsW) / 2), chipY, n };
}

interface Plate { p: Pane; trail: HpTrail; x: number; y: number; frozen: boolean; foe: FoeView; shake: number; lay: PlateLay | null }
export class FoePlates {
  private plates = new Map<number, Plate>(); private bubble: Pane; private ring: THREE.Group; private ringMat: THREE.MeshBasicMaterial; private t = 0; private ringK = 0;
  k = 1; preview: { uid: number; dmg: number } | null = null; private bubbleK = 0; private lastTarget: FoeView | null = null;
  selectionPreview: Array<{ uid: number; dmg: number }> = [];
  private target: number | null = null; private tauntFlash = 0; private boss: Pane; private shields = new Map<number, THREE.Mesh>();
  constructor(private ov: Overlay) {
    this.bubble = ov.pane(16);
    this.boss = ov.pane(6);
    this.ring = new THREE.Group(); this.ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2a1a).multiplyScalar(1.4), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const r1 = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 16), this.ringMat), r2 = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.66, 16), this.ringMat);
    this.ring.add(r1, r2);
    for (let i = 0; i < 4; i++) { const tk = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.26), this.ringMat); const a = i * Math.PI / 2; tk.position.set(Math.cos(a) * 1.08, Math.sin(a) * 1.08, 0); tk.rotation.z = a + Math.PI / 2; this.ring.add(tk); }
    this.ring.rotation.x = -Math.PI / 2; this.ring.renderOrder = 9; this.ring.visible = false; this.ringMat.depthTest = false; scene.add(this.ring);
    installPixDebug(ov);
  }
  private get ka() { return GRID.ka || this.k; }
  /** call every frame with the visible foes; target = current target uid (ring), live = the player can act */
  sync(foes: FoeView[], target: number | null, live: boolean, dt: number) {
    this.t += dt; this.target = target; this.tauntFlash = Math.max(0, this.tauntFlash - dt); const seen = new Set<number>(), uc = GRID.uc;
    for (const f of foes) {
      seen.add(f.uid); let pl = this.plates.get(f.uid); if (!pl) { pl = { p: this.ov.pane(5), trail: new HpTrail(), x: 0, y: 0, frozen: false, foe: f, shake: 0, lay: null }; this.plates.set(f.uid, pl); }
      pl.foe = f; pl.shake = Math.max(0, pl.shake - dt); if (f.trail != null && f.trail > pl.trail.hp) pl.trail.update(f.trail, 0); const trail = pl.trail.update(f.hp, dt);
      this.paint(pl, f, live, trail);
      const sp = worldToUi(f.at); if (!pl.frozen) { pl.x = sp.x; pl.y = sp.y; }
      const wobble = Math.round(Math.sin(pl.shake * 70) * Math.min(1, pl.shake * 5) * 2.4) * uc;   // the deny shake moves in whole cells
      pl.p.at(pl.x - pl.p.w / 2 + wobble, pl.y - pl.p.h); pl.p.visible = f.dying || sp.z < 1;
      if (f.taunt && !this.shields.has(f.uid)) { const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 12), new THREE.MeshBasicMaterial({ color: 0x409aff, transparent: true, opacity: 0.7, depthWrite: false, depthTest: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 8; scene.add(m); this.shields.set(f.uid, m); }
      const shield = this.shields.get(f.uid); if (shield) { shield.visible = !!f.taunt; shield.position.copy(f.foot).y += 0.07; shield.scale.setScalar(Math.max(0.9, f.width * 0.72)); (shield.material as THREE.MeshBasicMaterial).opacity = this.tauntFlash ? 0.5 + 0.5 * Math.abs(Math.sin(this.t * 24)) : 0.65; }
    }
    for (const [u, pl] of [...this.plates]) if (!seen.has(u)) { this.ov.drop(pl.p); this.plates.delete(u); }
    for (const [u, m] of this.shields) if (!seen.has(u)) { scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); this.shields.delete(u); }
    // the target ring
    const tf = foes.find(f => f.uid === target) || null; if (tf) this.lastTarget = tf;
    this.ringK += ((tf && !tf.dying ? 1 : 0) - this.ringK) * Math.min(1, dt * 8);
    const L = this.lastTarget; this.ring.visible = this.ringK > 0.02 && !!L;
    if (L) { this.ring.position.set(L.foot.x, L.foot.y + 0.05, L.foot.z); const s = Math.max(0.8, L.width * 0.75) * (0.9 + 0.1 * this.ringK); this.ring.scale.setScalar(s); this.ring.rotation.z = this.t * 0.5; }
    this.ringMat.color.setHex(L?.taunt ? 0x50aaff : 0xff3024).multiplyScalar(1.35);
    this.ringMat.opacity = this.ringK * (0.7 + 0.16 * Math.sin(this.t * 2));
    // the boss bar (top centre)
    const bf = foes.find(f => f.boss), bt = bf ? this.plates.get(bf.uid)!.trail.ghost : 0;
    this.boss.visible = !!bf;
    if (bf) { const S = bossSize(); paintCells(this.boss, ['boss', bf.hp, bf.maxHp, bt.toFixed(1)].join('|'), S.w, S.h, pen => paintBoss(pen, bf.hp, bf.maxHp, bt)); this.boss.at(Math.round(this.ov.w / 2 - this.boss.w / 2), Math.round(30 * this.ka - this.boss.h / 2)); }
    // the damage preview bubble (fades in and rises a few cells; never scaled)
    const pv = this.preview, pf = pv ? foes.find(f => f.uid === pv.uid) : null;
    this.bubbleK += ((pf ? 1 : 0) - this.bubbleK) * Math.min(1, dt * 14);
    if (pf && pv) {
      const txt = `-${pv.dmg}`, S = bubbleSize(txt);
      paintCells(this.bubble, 'b' + txt, S.w, S.h, pen => paintBubble(pen, txt));
      const sp = worldToUi(pf.at), pl = this.plates.get(pf.uid), x0 = pl?.lay ? pl.x + (pl.lay.cw / 2 + 2) * uc : sp.x + 40 * this.ka;
      this.bubble.at(x0, sp.y - this.bubble.h * 0.2 + Math.round((1 - this.bubbleK) * 4) * uc);
    }
    this.bubble.alpha = this.bubbleK; this.bubble.visible = this.bubbleK > 0.02;
  }
  private paint(pl: Plate, f: FoeView, live: boolean, ghost: number) {
    const it = live ? f.intent : null, sts = f.statuses.filter(s => ST_GLYPH[s.type]), stg = it?.status ? ST_GLYPH[it.status as StatusV2] ?? null : null;
    const sel = f.uid === this.target, pv = this.preview?.uid === f.uid ? this.preview : this.selectionPreview.find(x => x.uid === f.uid), dmg = pv?.dmg ?? 0;
    const blink = dmg > 0 && Math.floor(this.t * 5) % 2 === 0, flash = !!f.taunt && this.tauntFlash > 0 && Math.sin(this.t * 24) > 0;
    const L = plateLayout(f, it, !!stg, sts.length); pl.lay = L;
    const key = [L.W, L.H, it?.kind, it?.value, it?.status, f.hp, ghost.toFixed(1), f.maxHp, f.armor, sel, f.taunt, f.protected, flash, dmg, blink, sts.map(s => s.type + s.value + ':' + (s.duration ?? '')).join(',')].join('|');
    paintCells(pl.p, 'pl' + key, L.W, L.H, pen => {
      if (it) paintIntent(pen, it, L.pillX, L.pillY, stg);
      paintBar(pen, L.barX, L.barY, L.barW, { hp: f.hp, max: f.maxHp, ghost, loss: dmg, blink, sel });
      if (f.armor > 0) paintArmor(pen, L.barX - 5, L.barY, f.armor);
      if (dmg > 0 && dmg >= f.hp) pixGlyph(pen, 'skull', L.barX + L.barW - 4, L.barY, { col: '#fff0bd' });
      const rowY = it ? L.pillY + 2 : L.barY, left = it ? L.pillX - 12 : L.barX - (f.armor > 0 ? 6 : 0) - 12, right = it ? L.pillX + L.pillW + 3 : L.barX + L.barW + 3;
      if (f.taunt) paintTaunt(pen, left, rowY, flash);
      if (f.protected) paintLock(pen, right, rowY);
      sts.forEach((s, i) => {
        const S = ST_GLYPH[s.type], dot = s.type === 'poison' || s.type === 'burn';
        paintChip(pen, L.chipX + i * CHIP_STEP, L.chipY, { g: S.g, col: S.col, n: dot ? s.value : s.duration ?? s.value, good: s.type === 'berserk' });
      });
    });
  }
  freeze(uid: number) { const p = this.plates.get(uid); if (p) p.frozen = true; }
  deny(uid: number) { const p = this.plates.get(uid); if (p) p.shake = 0.4; this.tauntFlash = 0.55; }
  /** tap / hover hit test: the plate's visible content, padded to ≥ 88 reference px (UX_V3 §1b) */
  hit(x: number, y: number): number | null {
    let best: number | null = null, distance = Infinity; const uc = GRID.uc, min = 88 * this.ka;
    for (const [uid, p] of this.plates) {
      if (p.foe.dying || p.foe.hp <= 0 || !p.p.visible || !p.lay) continue;
      const cy = p.y - p.p.h / 2, rw = Math.max(min, p.lay.cw * uc) / 2, rh = Math.max(min, (p.lay.H - 4) * uc) / 2, d = Math.hypot(x - p.x, y - cy);
      if (Math.abs(x - p.x) <= rw && Math.abs(y - cy) <= rh && d < distance) { best = uid; distance = d; }
    }
    return best;
  }
  /** where a status icon flying to this foe lands: its chip in the bottom row (a new status takes the next slot) */
  statusAt(uid: number, type: StatusV2) {
    const p = this.plates.get(uid); if (!p) return { x: this.ov.w / 2, y: this.ov.h / 3 };
    const sts = p.foe.statuses.filter(s => ST_GLYPH[s.type]), i = sts.findIndex(s => s.type === type), n = sts.length + (i < 0 ? 1 : 0), slot = i < 0 ? n - 1 : i, uc = GRID.uc;
    const chipsW = n * CHIP_STEP - 1;
    return { x: p.x + (slot * CHIP_STEP + CHIP / 2 - chipsW / 2) * uc, y: p.y - (3 + CHIP / 2) * uc };
  }
  clear() { for (const pl of this.plates.values()) this.ov.drop(pl.p); this.plates.clear(); for (const m of this.shields.values()) { scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); } this.shields.clear(); this.preview = null; this.selectionPreview = []; this.ring.visible = this.boss.visible = false; this.ringK = 0; this.lastTarget = null; }
}
void V3;
