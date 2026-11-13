// R5 top left (UX_V3 §7 + the mockup): the purse and the gold number in a dark translucent rounded capsule (a thin slab in the UI
// layer so the 3D purse sits on it; the number is a crisp overlay pane), and under it a row of relics: each relic a 3D model hovering
// over the shared pedestal (two layers: the model bobs and turns slowly; its shadow lies on the pedestal). A relic beat makes its
// model rise, swell and spark while the pedestal ring lights. Tap a relic = its name and one line.
import * as THREE from 'three';
import type { UiLayer } from '../../ui3d/layer';
import { UiSparks, Spring } from '../../ui3d/vox';
import type { Overlay, Pane } from '../overlay';
import { relicModel, relicPedestal, glowRing, modelLook } from './models';
import { pill, label, type G } from './draw';

function slab(w: number, h: number, r: number, depth: number, mat: THREE.Material) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false); s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false); s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 }); g.translate(0, 0, -depth); return new THREE.Mesh(g, mat);
}
interface Relic { id: string; name: string; desc: string; g: THREE.Group; model: THREE.Object3D; ped: THREE.Object3D; ring: THREE.Mesh; shadow: THREE.Mesh; pop: Spring; fire: number; x: number; y: number }

export class TopLeft {
  pill = new THREE.Group(); private num: Pane; private tip: Pane; private relics: Relic[] = []; private sparks: UiSparks; private t = 0; private tipOn = -1;
  x = 88; y = 42; k = 1; gold = 0; on = false;
  constructor(private L: UiLayer, private ov: Overlay) {
    const body = slab(1.38, 0.41, 0.2, 0.06, new THREE.MeshBasicMaterial({ color: 0x14121c, transparent: true, opacity: 0.8, depthWrite: false }));
    const rim = slab(1.42, 0.45, 0.22, 0.04, new THREE.MeshBasicMaterial({ color: 0x8a82a0, transparent: true, opacity: 0.35, depthWrite: false })); rim.position.z = -0.03;
    this.pill.add(rim, body); this.pill.renderOrder = 1; L.scene.add(this.pill);
    this.num = ov.pane(8, true); this.tip = ov.pane(12, true); this.sparks = new UiSparks(L.scene, 60);
  }
  place(x: number, y: number, k: number) { this.x = x; this.y = y; this.k = k; }
  /** purse px (the 3D bag sits on the capsule's left end) */
  purse() { return { x: this.x - 44 * this.k, y: this.y }; }
  setRelics(list: Array<{ id: string; name: string; desc: string }>) {
    const key = list.map(r => r.id).join(','); if (key === this.relics.map(r => r.id).join(',')) return;
    for (const r of this.relics) this.L.scene.remove(r.g);
    this.relics = list.map(r => {
      const g = new THREE.Group(), ped = relicPedestal(), model = relicModel(r.name), ring = glowRing(0xffc040, 0.46, 0.56, 8, Math.PI * 2, Math.PI / 8);
      const fromA = !!ped.userData.fromA; if (!fromA) ped.rotation.x = 0.55; g.add(ped); ring.rotation.x = -Math.PI / 2 + 0.55; ring.position.y = 0.02; ring.visible = !fromA; g.add(ring); g.add(model);
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2 + 0.55; shadow.position.set(0, 0.05, 0.02); g.add(shadow);
      this.L.scene.add(g); return { ...r, g, model, ped, ring, shadow, pop: new Spring(260, 12), fire: 0, x: 0, y: 0 };
    });
    this.tipOn = -1;
  }
  /** a relic's beat: rise, swell, spark */
  fire(id: string) { const r = this.relics.find(x => x.id === id); if (!r) return; r.fire = 1; r.pop.kick(12); this.sparks.burst(this.L.at(r.x, r.y - 30 * this.k, 3), 18, this.L.px(200), this.L.px(5), 0xffd060, { life: 0.5 }); }
  /** hit area ≥ 88 reference px (UX_V3 §1b) */
  hitRelic(x: number, y: number) { return this.relics.findIndex(r => Math.abs(x - r.x) < 34 * this.k && y > r.y - 64 * this.k && y < r.y + 24 * this.k); }
  toggleTip(i: number) { this.tipOn = this.tipOn === i ? -1 : i; }
  closeTip() { this.tipOn = -1; }
  update(dt: number) {
    this.t += dt; const L = this.L, k = this.k, vis = this.on;
    this.pill.visible = vis; L.at(this.x, this.y, -2, this.pill.position); this.pill.scale.setScalar(L.px(100 * k));
    const g = Math.round(this.gold), txt = String(g), w = 90, h = 40;
    this.num.paint('n' + txt, w, h, (c: G, kk) => label(c, txt, 4, h / 2, 30, kk, { align: 'left', col: '#ffffff', sw: 4 }));
    this.num.scale = k; this.num.at(this.x - 6 * k - w / 2 + w * k / 2, this.y - h / 2); this.num.visible = vis;
    this.relics.forEach((r, i) => {
      r.x = this.x - 16 * k + i * 76 * k; r.y = this.y + 72 * k; r.g.visible = vis;   // tappable: ≥ 64 from the safe edge (UX_V3 §1b)
      const p = r.pop.step(0, dt); r.fire = Math.max(0, r.fire - dt / 1.2);
      L.at(r.x, r.y, 0, r.g.position); r.g.scale.setScalar(L.px(56 * k));
      const lift = 0.62 + Math.sin(this.t * 1.8 + i) * 0.05 + r.fire * 0.35;
      r.model.position.set(0, lift - 0.12, 0.12); r.model.rotation.set(0.1, Math.sin(this.t * 0.7 + i * 1.3) * 0.5, 0); r.model.scale.setScalar(0.74 * (1 + p * 0.02 + r.fire * 0.25));
      (r.ped as unknown as { setActive?: (k: number) => void }).setActive?.(r.fire); modelLook(r.model, 1 + r.fire * 1.2, 0);
      (r.ring.material as THREE.MeshBasicMaterial).opacity = 0.15 + r.fire * 0.85; (r.shadow.material as THREE.MeshBasicMaterial).opacity = 0.35 - r.fire * 0.2;
      if (r.fire > 0 && Math.random() < dt * 30) this.sparks.emit(L.at(r.x + (Math.random() - 0.5) * 30 * k, r.y - 30 * k, 2), new THREE.Vector3(0, L.px(90), 0), L.px(5), 0xffe080, 0.5);
    });
    this.sparks.update(dt);
    const r = this.relics[this.tipOn];
    if (vis && r) {
      const tw = 280, th = 66;
      this.tip.paint('rt' + r.id, tw, th, (c: G, kk) => { pill(c, 0, 0, tw, th, kk, { r: 12, rim: 'rgba(230,190,110,0.6)' }); label(c, r.name, 14, 20, 18, kk, { align: 'left', col: '#ffe6a0' });
        c.font = `600 ${14 * kk}px "Microsoft YaHei UI","Microsoft YaHei","PingFang SC",sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#e8dcc8'; c.fillText(r.desc.slice(0, 20), 14 * kk, 46 * kk); });
      this.tip.at(r.x - 20, r.y + 24 * k); this.tip.visible = true;
    } else this.tip.visible = false;
  }
}
