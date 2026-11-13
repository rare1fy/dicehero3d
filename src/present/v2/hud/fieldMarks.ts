// R5 marks on the field dice (world space): a small gold reroll badge (a thick octagon token with the double-arrow mark, facing the
// camera, bobbing) over each selected die while a reroll is available (= the reroll button would reroll these), and a cyan ring of
// light on the ground under each die that stays on the field (mage keep / carried dice).
import * as THREE from 'three';
import { scene, camera, V3 } from '../../engine/world';
import { flat } from '../../ui3d/vox';

function markTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  g.fillStyle = '#2a2018'; g.fillRect(0, 0, 128, 128);
  g.lineCap = 'butt'; g.strokeStyle = '#ffc23a'; g.lineWidth = 16; g.fillStyle = '#ffc23a';
  for (let i = 0; i < 2; i++) {
    const a0 = i * Math.PI + 0.4, a1 = a0 + Math.PI - 1.0; g.beginPath(); g.arc(64, 64, 36, a0, a1); g.stroke();
    const tx = 64 + Math.cos(a1) * 36, ty = 64 + Math.sin(a1) * 36, dx = -Math.sin(a1), dy = Math.cos(a1), nx = Math.cos(a1), ny = Math.sin(a1);
    g.beginPath(); g.moveTo(tx + nx * 18, ty + ny * 18); g.lineTo(tx + dx * 22, ty + dy * 22); g.lineTo(tx - nx * 18, ty - ny * 18); g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export class FieldMarks {
  private badges: THREE.Group[] = []; private rings: THREE.Mesh[] = []; private t = 0; private faceMat: THREE.MeshBasicMaterial; private rimMat: THREE.MeshToonMaterial; private ringMat: THREE.MeshBasicMaterial;
  constructor() {
    this.faceMat = new THREE.MeshBasicMaterial({ map: markTex(), toneMapped: false }); this.rimMat = flat(0xd8a040, { emissive: 0x5a3a00 }).clone();
    this.ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x40e0ff).multiplyScalar(1.5), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  }
  private badge(i: number) {
    while (this.badges.length <= i) {
      const g = new THREE.Group(), geo = new THREE.CylinderGeometry(0.26, 0.26, 0.1, 8, 1, false, Math.PI / 8);
      const m = new THREE.Mesh(geo, [this.rimMat, this.faceMat, this.rimMat]); m.rotation.x = Math.PI / 2; g.add(m);
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), this.rimMat); stem.position.y = -0.33; g.add(stem);
      g.visible = false; scene.add(g); this.badges.push(g);
    }
    return this.badges[i];
  }
  private ring(i: number) {
    while (this.rings.length <= i) { const r = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.62, 40), this.ringMat); r.rotation.x = -Math.PI / 2; r.renderOrder = 2; r.visible = false; scene.add(r); this.rings.push(r); }
    return this.rings[i];
  }
  /** sel: positions of the selected dice (badges, only when a reroll is available); keep: ground points under the dice that stay */
  update(dt: number, sel: THREE.Vector3[], keep: THREE.Vector3[]) {
    this.t += dt;
    sel.forEach((p, i) => { const b = this.badge(i); b.visible = true; b.position.copy(p).add(V3(0, 0.9 + Math.sin(this.t * 3 + i) * 0.05, 0)); b.quaternion.copy(camera.quaternion); });
    for (let i = sel.length; i < this.badges.length; i++) this.badges[i].visible = false;
    keep.forEach((p, i) => { const r = this.ring(i); r.visible = true; r.position.set(p.x, 0.04, p.z); r.scale.setScalar(1 + 0.06 * Math.sin(this.t * 4 + i)); r.rotation.z = this.t * 0.4; });
    for (let i = keep.length; i < this.rings.length; i++) this.rings[i].visible = false;
    this.ringMat.opacity = 0.7 + 0.2 * Math.sin(this.t * 3);
  }
  hide() { for (const b of this.badges) b.visible = false; for (const r of this.rings) r.visible = false; }
}
