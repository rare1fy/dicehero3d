// R5 enemy plates (UX_V3 §4 + the mockup): a dark capsule with the intent icon + number (sword red / shield blue / boot / frozen =
// grey with an ice rim), a red HP bar with its number, and a row of round status icons (thin outer arc = turns left, corner number).
// No names. Under the current target a red ring with ticks lies on the ground; while aiming, the hovered enemy gets a red "-18"
// bubble. Data comes from the caller each frame (cheap: panes repaint only when their key changes).
import * as THREE from 'three';
import { scene, V3 } from '../../engine/world';
import { worldToUi } from '../../ui3d/layer';
import type { Overlay, Pane } from '../overlay';
import { pill, label, glyph, rr, statusIcon, type Glyph, type G } from './draw';
import type { StatusV2 } from '../../../core/v2/types';
import { HpTrail } from '../hpDisplay';

export interface FoeView { uid: number; at: THREE.Vector3; foot: THREE.Vector3; width: number; hp: number; maxHp: number; armor: number; big: boolean; boss?: boolean; taunt?: boolean; protected?: boolean; dying?: boolean;
  intent: { kind: string; value?: number; status?: string } | null; statuses: Array<{ type: StatusV2; value: number; duration?: number }> }

export const ST_GLYPH: Record<StatusV2, { g: Glyph; col: string }> = {
  poison: { g: 'drop', col: '#5ae03a' }, burn: { g: 'fire', col: '#ff7a20' }, freeze: { g: 'crystal', col: '#8ad8ff' }, stun: { g: 'star', col: '#ffe060' },
  vulnerable: { g: 'crack', col: '#ff6a4a' }, weak: { g: 'broken', col: '#c8c8d8' }, berserk: { g: 'fist', col: '#ff5a4a' },
};
const INTENT: Record<string, { g: Glyph; col: string; rim: string }> = {
  atk: { g: 'sword', col: '#ff4a3a', rim: 'rgba(255,90,70,0.45)' }, def: { g: 'shield', col: '#3a8aff', rim: 'rgba(90,160,255,0.5)' }, mov: { g: 'boot', col: '#e0b860', rim: 'rgba(230,190,110,0.4)' },
  frz: { g: 'snow', col: '#a8d8ff', rim: 'rgba(170,220,255,0.8)' }, skl: { g: 'star', col: '#c890ff', rim: 'rgba(200,150,255,0.45)' }, curse: { g: 'skull', col: '#c890ff', rim: 'rgba(200,150,255,0.45)' },
};

interface Plate { p: Pane; trail: HpTrail; x: number; y: number; frozen: boolean; foe: FoeView; shake: number }
export class FoePlates {
  private plates = new Map<number, Plate>(); private bubble: Pane; private ring: THREE.Group; private ringMat: THREE.MeshBasicMaterial; private t = 0; private ringK = 0;
  k = 1; preview: { uid: number; dmg: number } | null = null; private bubbleK = 0; private lastTarget: FoeView | null = null;
  selectionPreview: Array<{ uid: number; dmg: number }> = [];
  private target: number | null = null; private tauntFlash = 0; private boss: Pane; private shields = new Map<number, THREE.Mesh>();
  constructor(private ov: Overlay) {
    this.bubble = ov.pane(16, true);
    this.boss = ov.pane(6, true);
    this.ring = new THREE.Group(); this.ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2a1a).multiplyScalar(1.4), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const r1 = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 16), this.ringMat), r2 = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.66, 16), this.ringMat);
    this.ring.add(r1, r2);
    for (let i = 0; i < 4; i++) { const tk = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.26), this.ringMat); const a = i * Math.PI / 2; tk.position.set(Math.cos(a) * 1.08, Math.sin(a) * 1.08, 0); tk.rotation.z = a + Math.PI / 2; this.ring.add(tk); }
    this.ring.rotation.x = -Math.PI / 2; this.ring.renderOrder = 9; this.ring.visible = false; this.ringMat.depthTest = false; scene.add(this.ring);
  }
  /** call every frame with the visible foes; target = current target uid (ring), live = the player can act */
  sync(foes: FoeView[], target: number | null, live: boolean, dt: number) {
    this.t += dt; this.target = target; this.tauntFlash = Math.max(0, this.tauntFlash - dt); const seen = new Set<number>();
    for (const f of foes) {
      seen.add(f.uid); let pl = this.plates.get(f.uid); if (!pl) { pl = { p: this.ov.pane(5, true), trail: new HpTrail(), x: 0, y: 0, frozen: false, foe: f, shake: 0 }; this.plates.set(f.uid, pl); }
      pl.foe = f; pl.shake = Math.max(0, pl.shake - dt); const trail = pl.trail.update(f.hp, dt);
      this.paint(pl.p, f, live, trail);
      const sp = worldToUi(f.at); if (!pl.frozen) { pl.x = sp.x; pl.y = sp.y; }
      const wobble = Math.sin(pl.shake * 70) * Math.min(1, pl.shake * 5) * 7 * this.k;
      pl.p.scale = this.k; pl.p.at(pl.x - pl.p.w / 2 + wobble, pl.y - pl.p.h / 2 - pl.p.h * this.k / 2); pl.p.visible = f.dying || sp.z < 1;
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
    const bf = foes.find(f => f.boss), bt = bf ? this.plates.get(bf.uid)!.trail.ghost : 0;
    this.boss.visible = !!bf;
    if (bf) { const w = 360, h = 30; this.boss.paint([bf.hp, bf.maxHp, bt.toFixed(1)].join('|'), w, h, (g, k) => { pill(g, 1, 1, w - 2, h - 2, k, { rim: '#cb9a62', rimW: 2 }); g.fillStyle = '#ffc0a2'; g.fillRect(5*k, 5*k, (w-10)*k*bt/bf.maxHp, (h-10)*k); g.fillStyle = '#c92130'; g.fillRect(5*k, 5*k, (w-10)*k*bf.hp/bf.maxHp, (h-10)*k); label(g, `${bf.hp} / ${bf.maxHp}`, w/2, h/2, 20, k); }); this.boss.scale = this.k; this.boss.at(this.ov.w/2 - w/2, 32*this.k-h/2); }
    // the damage preview bubble
    const pv = this.preview, pf = pv ? foes.find(f => f.uid === pv.uid) : null;
    this.bubbleK += ((pf ? 1 : 0) - this.bubbleK) * Math.min(1, dt * 14);
    if (pf && pv) {
      const txt = `-${pv.dmg}`, w = 30 + txt.length * 19, h = 48;
      this.bubble.paint('b' + txt, w, h, (g: G, k) => {
        g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 6 * k; rr(g, 2 * k, 2 * k, (w - 4) * k, (h - 12) * k, 8 * k); g.fillStyle = '#b8141a'; g.fill(); g.restore();
        g.beginPath(); g.moveTo(10 * k, (h - 11) * k); g.lineTo(4 * k, (h - 1) * k); g.lineTo(22 * k, (h - 11) * k); g.closePath(); g.fillStyle = '#b8141a'; g.fill();
        rr(g, 2 * k, 2 * k, (w - 4) * k, (h - 12) * k, 8 * k); g.lineWidth = 2 * k; g.strokeStyle = '#ff6a50'; g.stroke();
        label(g, txt, w / 2, (h - 10) / 2 + 1, 28, k, { col: '#ffffff' });
      });
      const sp = worldToUi(pf.at); this.bubble.at(sp.x + 40 * this.k, sp.y + 30 * this.k); this.bubble.scale = this.k * (0.6 + 0.4 * this.bubbleK);
    }
    this.bubble.alpha = this.bubbleK; this.bubble.visible = this.bubbleK > 0.02;
  }
  private paint(p: Pane, f: FoeView, live: boolean, ghost: number) {
    const it = live ? f.intent : null, sts = f.statuses.filter(s => ST_GLYPH[s.type]);
    const W = f.big ? 200 : 150, ih = it ? 34 : 0, bh = f.big ? 22 : 20, sh = sts.length ? 36 : 0, H = ih + (ih ? 6 : 0) + bh + 4 + sh + 2;
    const selected = f.uid === this.target, pv = this.preview?.uid === f.uid ? this.preview : this.selectionPreview.find(x => x.uid === f.uid), dmg = pv?.dmg ?? 0;
    const flash = f.taunt && this.tauntFlash > 0 && Math.sin(this.t * 24) > 0;
    const key = [W, it?.kind, it?.value, it?.status, f.hp, ghost.toFixed(1), f.maxHp, f.armor, selected, f.taunt, f.protected, flash, dmg, sts.map(s => s.type + s.value + ':' + (s.duration ?? '')).join(',')].join('|');
    p.paint(key, W, H, (g: G, k) => {
      let y = 0;
      if (it) {
        const I = INTENT[it.kind] || INTENT.skl, v = it.value != null ? String(it.value) : '', stg = it.status ? ST_GLYPH[it.status as StatusV2] : null;
        const pw = 46 + v.length * 14 + (stg ? 24 : 0) + (v ? 6 : 0), x0 = (W - pw) / 2;
        pill(g, x0, 0, pw, ih, k, { rim: I.rim, r: 10 });
        glyph(g, I.g, x0 + 20, ih / 2, 24, k, I.col);
        if (v) label(g, v, x0 + 38 + v.length * 7, ih / 2, 21, k, { col: it.kind === 'frz' ? '#c8d8e8' : '#ffffff' });
        if (stg) glyph(g, stg.g, x0 + pw - 18, ih / 2, 18, k, stg.col);
        y = ih + 6;
      }
      // HP bar: dark frame, red gradient fill, a lighter top line, the number on it
      const bx = 4, bw = W - 8, fr = Math.max(0, Math.min(1, f.hp / Math.max(1, f.maxHp)));
      g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 4 * k; rr(g, bx * k, y * k, bw * k, bh * k, (bh / 2) * k); g.fillStyle = '#1a0c10'; g.fill(); g.restore();
      if (ghost > f.hp) { g.fillStyle = '#ffd3ba'; g.fillRect((bx+2)*k, (y+2)*k, (bw-4)*Math.min(1,ghost/f.maxHp)*k, (bh-4)*k); }
      if (fr > 0) { const gr = g.createLinearGradient(0, y * k, 0, (y + bh) * k); gr.addColorStop(0, '#ff5a4a'); gr.addColorStop(0.5, '#d01a1e'); gr.addColorStop(1, '#8a0a10'); rr(g, (bx + 2) * k, (y + 2) * k, Math.max(bh - 4, (bw - 4) * fr) * k, (bh - 4) * k, ((bh - 4) / 2) * k); g.fillStyle = gr; g.fill(); }
      if (dmg > 0) { const loss = Math.min(f.hp, dmg); g.fillStyle = 'rgba(255,235,190,0.6)'; g.fillRect((bx+2+(bw-4)*(f.hp-loss)/f.maxHp)*k, (y+2)*k, (bw-4)*loss/f.maxHp*k, (bh-4)*k); if (dmg >= f.hp) glyph(g, 'skull', W-18, y+bh/2, 22, k, '#fff0bd'); }
      rr(g, bx * k, y * k, bw * k, bh * k, (bh / 2) * k); g.lineWidth = (selected ? 3 : 1.5) * k; g.strokeStyle = selected ? '#ff7464' : 'rgba(255,170,150,0.35)'; g.stroke();
      if (selected) { g.fillStyle = '#ff3a30'; g.fillRect((W/2-5)*k,(y+bh+1)*k,10*k,3*k); }
      if (f.taunt) { glyph(g, 'shield', 16, (ih || bh)/2, 26, k, flash ? '#ffffff' : '#64b5ff'); label(g, '!', 16, (ih || bh)/2, 18, k, { col: '#ffffff' }); }
      if (f.protected) glyph(g, 'lock', W-16, (ih || bh)/2, 20, k, '#b0b8c8');
      label(g, String(Math.max(0, f.hp)), W / 2, y + bh / 2 + 0.5, bh * 0.95, k, { col: '#ffffff', sw: 3.5 });
      if (f.armor > 0) { glyph(g, 'shield', bx + 12, y + bh / 2, 26, k, '#4a9aff'); label(g, String(f.armor), bx + 12, y + bh / 2 + 1, 12, k, { col: '#ffffff', sw: 2.5 }); }
      y += bh + 4;
      sts.forEach((s, i) => {
        const S = ST_GLYPH[s.type], n = sts.length, cx = W / 2 + (i - (n - 1) / 2) * 38, dot = s.type === 'poison' || s.type === 'burn';
        statusIcon(g, cx, y + 17, 16, k, { glyph: S.g, col: S.col, arc: '#ff3a2a', frac: dot ? 1 : Math.min(1, (s.duration ?? 1) / 3), n: dot ? s.value : s.duration ?? s.value });
      });
    });
  }
  freeze(uid: number) { const p = this.plates.get(uid); if (p) p.frozen = true; }
  deny(uid: number) { const p = this.plates.get(uid); if (p) p.shake = 0.4; this.tauntFlash = 0.55; }
  hit(x: number, y: number): number | null {
    let best: number | null = null, distance = Infinity;
    for (const [uid, p] of this.plates) { if (p.foe.dying || p.foe.hp <= 0 || !p.p.visible) continue; const cy = p.y - p.p.h*this.k/2, rw = Math.max(88,p.p.w)*this.k/2, rh = Math.max(88,p.p.h)*this.k/2; const d = Math.hypot(x-p.x,y-cy); if (Math.abs(x-p.x)<=rw && Math.abs(y-cy)<=rh && d<distance) { best=uid; distance=d; } }
    return best;
  }
  statusAt(uid: number, type: StatusV2) {
    const p = this.plates.get(uid); if (!p) return { x: this.ov.w/2, y: this.ov.h/3 };
    const sts = p.foe.statuses, i = sts.findIndex(s => s.type === type), n = sts.length + (i < 0 ? 1 : 0);
    return { x: p.x + ((i < 0 ? n-1 : i)-(n-1)/2)*38*this.k, y: p.y-19*this.k };
  }
  clear() { for (const pl of this.plates.values()) this.ov.drop(pl.p); this.plates.clear(); for (const m of this.shields.values()) { scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); } this.shields.clear(); this.preview = null; this.selectionPreview = []; this.ring.visible = this.boss.visible = false; this.ringK = 0; this.lastTarget = null; }
}
void V3;
