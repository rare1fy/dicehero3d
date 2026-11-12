// Relics as little 3D models floating in a UI layer (the v5 relic presentation the user liked best): voxel extrusions of each relic's
// pixel icon, bobbing in slots down the left edge. On trigger the slot model jumps and flares, a glowing copy pops out into the world,
// carries its name, and flies along an arc with a gold trail to where its effect lands (weapon / hero / coin), then bursts there.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import visual from '../data/visualData.json';
import { scene, camera, V3 } from '../engine/world';
import { anim, animP, ease, wait, clock } from '../engine/clock';
import { trailSeg, fxGlow, fxRing, fxSparks, COL } from '../fx/fx';
import { lightPulse } from '../engine/prims';
import { toon } from '../look/toon';
import { popText } from '../battle/text3d';
import { cue } from '../../audio/cues';

type Px = { w: number; h: number; pal: string[]; rows: string[] };
const PX = visual.relicPx as Record<string, Px>;

/** Voxel model of a relic icon: one beveled cube per pixel, vertex-coloured, centred, ~1 unit tall. */
export function relicModel(id: string, depth = 2): THREE.Group {
  const px = PX[id], g = new THREE.Group(); if (!px) return g;
  const parts: THREE.BufferGeometry[] = [], s = 1 / Math.max(px.w, px.h), col = new THREE.Color();
  px.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return; const ci = parseInt(ch, 36); col.set(px.pal[ci] || '#ffffff');
    for (let z = 0; z < depth; z++) {
      const b = new THREE.BoxGeometry(s * 0.98, s * 0.98, s * 0.98).toNonIndexed(); b.deleteAttribute('uv');
      b.translate((x - (px.w - 1) / 2) * s, ((px.h - 1) / 2 - y) * s, (z - (depth - 1) / 2) * s);
      const n = b.attributes.position.count, c = new Float32Array(n * 3), shade = z === 0 || z === depth - 1 ? 1 : 0.8;
      for (let i = 0; i < n; i++) c.set([col.r * shade, col.g * shade, col.b * shade], i * 3);
      b.setAttribute('color', new THREE.BufferAttribute(c, 3)); parts.push(b);
    }
  }));
  const mat = toon(0xffffff, { vertexColors: true }).clone(); mat.emissive = new THREE.Color(0, 0, 0);
  const mesh = new THREE.Mesh(mergeGeometries(parts)!, mat); g.add(mesh); g.userData.mat = mat;
  return g;
}

interface Slot { id: string; model: THREE.Group; base: THREE.Vector3; jump: number; glow: number }

export class RelicBar {
  scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50); slots: Slot[] = [];
  private w = 1; private h = 1; private col = { x: 0, w: 1 }; private top = 0;
  constructor() {
    this.scene.add(new THREE.HemisphereLight(0xfff0dc, 0x3a2a40, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(2, 3, 5); this.scene.add(d);
    this.cam.position.set(0, 0, 10);
  }
  set(ids: string[]) {
    for (const s of this.slots) this.scene.remove(s.model);
    this.slots = ids.map(id => { const m = relicModel(id); this.scene.add(m); return { id, model: m, base: V3(), jump: 0, glow: 0 }; });
    this.layout();
  }
  add(id: string) { const m = relicModel(id); this.scene.add(m); this.slots.push({ id, model: m, base: V3(), jump: 0, glow: 1 }); this.layout(); }
  resize(w: number, h: number, col: { x: number; w: number }, top: number) { this.w = w; this.h = h; this.col = col; this.top = top; this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this.layout(); }
  /** CSS px → a point in the overlay scene on the z=0 plane. */
  private toScene(x: number, y: number) {
    const v = V3((x / this.w) * 2 - 1, -(y / this.h) * 2 + 1, 0.5).unproject(this.cam), d = v.sub(this.cam.position).normalize();
    return this.cam.position.clone().addScaledVector(d, -this.cam.position.z / d.z);
  }
  /** where slot i sits (CSS px); landscape hands the hotbar's wells in here */
  place: ((i: number) => { x: number; y: number }) | null = null;
  slotPx(i: number) { return this.place ? this.place(i) : { x: this.col.x + 30, y: this.top + 92 + i * 54 }; }
  layout() { this.slots.forEach((s, i) => { const p = this.slotPx(i); s.base.copy(this.toScene(p.x, p.y)); const sz = this.toScene(p.x + 38, p.y).x - s.base.x; s.model.scale.setScalar(sz); }); }
  update(dt: number) {
    const t = clock.rtime;
    this.slots.forEach((s, i) => {
      s.jump = Math.max(0, s.jump - dt * 2.2); s.glow = Math.max(0, s.glow - dt * 1.6);
      const j = Math.sin(Math.min(1, 1 - s.jump) * Math.PI) * (s.jump > 0 ? 1 : 0);
      s.model.position.copy(s.base).add(V3(0, Math.sin(t * 1.6 + i) * 0.04 + j * 0.25, 0));
      s.model.rotation.y = Math.sin(t * 0.9 + i * 1.3) * 0.6 + s.jump * Math.PI * 2; s.model.rotation.x = 0.15;
      const m = s.model.userData.mat as THREE.MeshToonMaterial; m.emissive.setRGB(1.0 * s.glow, 0.8 * s.glow, 0.3 * s.glow);
    });
  }
  render(r: THREE.WebGLRenderer) { const ac = r.autoClear; r.autoClear = false; r.clearDepth(); r.render(this.scene, this.cam); r.autoClear = ac; }

  /** World point in front of the camera under a slot (where the flying copy is born). */
  slotWorld(i: number, dist = 5) {
    const p = this.slotPx(i), v = V3((p.x / this.w) * 2 - 1, -(p.y / this.h) * 2 + 1, 0.5).unproject(camera);
    return camera.position.clone().add(v.sub(camera.position).normalize().multiplyScalar(dist));
  }

  /** The v5 relic beat: jump + flare in the bar → glowing copy pops out with its name → arcs with a gold trail to `to` → burst. */
  async trigger(id: string, label: string, to: THREE.Vector3, colr = 0xffd060) {
    let i = this.slots.findIndex(s => s.id === id); if (i < 0) i = 0;
    const s = this.slots[i]; if (s) { s.jump = 1; s.glow = 1; }
    cue('relic');
    const from = this.slotWorld(i, 4.5), m = relicModel(id, 2); m.scale.setScalar(0.01); m.position.copy(from); scene.add(m);
    const mat = m.userData.mat as THREE.MeshToonMaterial; mat.emissive.setRGB(1.2, 0.9, 0.35);
    fxGlow(from, colr, 1.2, 0.4, 2.4);
    popText(label, from.clone().add(V3(0, 0.55, 0)), { color: '#ffe08a', size: 0.32, life: 1.2, rise: 0.5 });
    await animP(0.22, k => { m.scale.setScalar(ease.outBack(k) * 0.55); m.rotation.y = k * 4; });
    await wait(0.16);
    const mid = from.clone().lerp(to, 0.5).add(V3(0, 1.2, 0)); let last = from.clone();
    await animP(0.38, k => {
      const e = ease.inCubic(k), a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e;
      const p = V3(from.x * a + mid.x * b + to.x * c, from.y * a + mid.y * b + to.y * c, from.z * a + mid.z * b + to.z * c);
      m.position.copy(p); m.rotation.y += 0.4; m.rotation.x += 0.2; trailSeg(last, p, colr, 0.12, { life: 0.35, bright: 2.4 }); last = p;
    });
    scene.remove(m);
    fxGlow(to, colr, 1.4, 0.3, 2.6); fxRing(to, colr, 1.2, { billboard: true, life: 0.35, width: 0.15 }); fxSparks(to, COL.gold, 14, 4, { life: 0.4, grav: 5 }); lightPulse(to, colr, 6, 0.3, 5);
    cue('count', 1);
  }
}
void anim;
