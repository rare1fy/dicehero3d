// The drag-aim arrow (UX_V3 §3): an orange segmented voxel arc from the play button to the finger / enemy, rising toward the
// camera in the middle (the UI layer's perspective makes it swell), dashed (block, gap, block), with a chunky stepped arrowhead.
// Pure UI-layer meshes, axis-aligned blocks turned along the curve.
import * as THREE from 'three';
import type { UiLayer } from '../../ui3d/layer';

const N = 15;
export class AimArrow {
  private segs: THREE.Mesh[] = []; private head = new THREE.Group(); private mat: THREE.MeshBasicMaterial; private dark: THREE.MeshBasicMaterial; private t = 0;
  /** x0,y0 → x1,y1 in CSS px; hot = over a valid target */
  a: { x0: number; y0: number; x1: number; y1: number; hot: boolean; blocked?: boolean } | null = null;
  private lock = new THREE.Group();
  private grow = 0; k = 1;
  constructor(private L: UiLayer) {
    const box = new THREE.BoxGeometry(1, 1, 1);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, toneMapped: false }); this.dark = new THREE.MeshBasicMaterial({ color: 0x5a2008, toneMapped: false });
    for (let i = 0; i < N; i++) { const s = new THREE.Mesh(box, this.mat); s.visible = false; s.renderOrder = 41; L.scene.add(s); this.segs.push(s);
      const e = new THREE.Mesh(box, this.dark); e.scale.set(1.25, 1.35, 0.8); e.position.z = -0.25; s.add(e); }
    // stepped arrowhead pointing +x (cells of 1), with a dark backing
    for (let c = 0; c < 5; c++) for (let r = -(4 - c); r <= 4 - c; r++) { const m = new THREE.Mesh(box, this.mat); m.position.set(c, r, 0); this.head.add(m); }
    for (let c = -1; c < 6; c++) { const h = Math.max(0, 5 - c); for (let r = -h; r <= h; r++) { const m = new THREE.Mesh(box, this.dark); m.position.set(c, r, -0.6); this.head.add(m); } }
    this.head.visible = false; this.head.renderOrder = 42; this.head.userData.noTilt = true; L.scene.add(this.head);
    const lockRows=['.###.','#...#','#...#','#####','##.##','##.##','#####'];
    lockRows.forEach((r,y)=>[...r].forEach((c,x)=>{if(c==='#'){const m=new THREE.Mesh(box,this.mat);m.position.set(x-2,3-y,0);this.lock.add(m);}}));
    this.lock.visible=false; this.lock.userData.noTilt=true; L.scene.add(this.lock);
  }
  update(dt: number) {
    this.t += dt; const A = this.a, L = this.L;
    this.grow = A ? Math.min(1, this.grow + dt / 0.18) : 0;
    if (!A) { for (const s of this.segs) s.visible = false; this.head.visible = this.lock.visible = false; return; }
    this.mat.color.setHex(A.blocked ? 0x969da9 : A.hot ? 0xff5a20 : 0xff9a30);
    this.lock.visible=!!A.blocked; L.at(A.x1,A.y1-30*this.k,3,this.lock.position); this.lock.scale.setScalar(L.px(5*this.k));
    const k = this.k, dx = A.x1 - A.x0, dy = A.y1 - A.y0, dist = Math.hypot(dx, dy), bend = Math.min(170 * k, dist * 0.32);
    // the control point: up and toward the outside of the turn (an arc that rises from the button)
    const cx = (A.x0 + A.x1) / 2 + Math.sign(dx || 1) * bend * 0.35, cy = (A.y0 + A.y1) / 2 - bend;
    const bez = (t: number) => ({ x: (1 - t) ** 2 * A.x0 + 2 * (1 - t) * t * cx + t * t * A.x1, y: (1 - t) ** 2 * A.y0 + 2 * (1 - t) * t * cy + t * t * A.y1 });
    const endT = Math.max(0.5, 1 - 34 * k / Math.max(1, dist)) * this.grow, lift = L.px(60 * k), flow = (this.t * 1.6) % 1;
    for (let i = 0; i < N; i++) {
      const s = this.segs[i], t = ((i + flow) / N) * endT; if (t > endT || t < 0) { s.visible = false; continue; }
      const p = bez(t), q = bez(Math.min(1, t + 0.01)), z = lift * Math.sin(Math.PI * t);
      L.at(p.x, p.y, z, s.position); s.rotation.set(0, 0, Math.atan2(-(q.y - p.y), q.x - p.x));
      const sz = L.px((8 + 5 * Math.sin(Math.PI * t)) * k, z); s.scale.set(sz * 1.25, sz, sz); s.visible = true;
    }
    const pe = bez(endT), pb = bez(Math.max(0, endT - 0.03)), ang = Math.atan2(-(pe.y - pb.y), pe.x - pb.x);
    L.at(pe.x, pe.y, 0, this.head.position); this.head.rotation.set(0, 0, ang);
    this.head.scale.setScalar(L.px((4.4 + 0.5 * Math.sin(this.t * 10)) * k)); this.head.visible = this.grow > 0.5;
  }
}
