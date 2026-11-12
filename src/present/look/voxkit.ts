// Chunky voxel characters, authored as one statue in absolute cell coordinates (y up from the ground, front = +z, x centred so
// symmetric pieces mirror across x = 0). Every cell belongs to a part; every part hangs on a bone of a simple joint rig, so the actor
// animates by rotating bones (procedural poses in the actor classes). Meshing: exposed faces only (faces between two parts are kept,
// they separate when the joints move), per-corner ambient occlusion from the whole statue, and a per-cell UV that the shader uses to
// draw a soft bevel highlight on every block edge — the blocks stay readable as blocks even at a distance.
import * as THREE from 'three';
import { toon } from './toon';
import type { Bone } from '../actors/rig';

export type Col = number;
interface Cell { c: Col; g: number; part: string }
const key = (x: number, y: number, z: number) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
const DIRS: Array<[number, number, number]> = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
// tangent axes per face direction (t1 × t2 = +axis)
const TAN: Array<[[number, number, number], [number, number, number]]> = [[[0, 1, 0], [0, 0, 1]], [[0, 1, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0]], [[0, 0, 1], [1, 0, 0]], [[1, 0, 0], [0, 1, 0]], [[1, 0, 0], [0, 1, 0]]];
const AO = [0.52, 0.7, 0.86, 1];

/** the block material: toon + bevel highlight on block edges (attribute aVox) */
const matCache = new Map<string, THREE.MeshToonMaterial>();
export function voxToon(o: { rim?: number; self?: number; edge?: number } = {}) {
  const k = `${o.rim ?? 0.6}|${o.self ?? 0.05}|${o.edge ?? 0.2}`;
  if (matCache.has(k)) return matCache.get(k)!;
  // a private copy: the cached toon material is shared, and this one gets an extra shader stage
  const src = toon(0xffffff, { vertexColors: true, rim: o.rim ?? 0.6, self: o.self ?? 0.05 }), m = src.clone(), edge = o.edge ?? 0.2;
  m.onBeforeCompile = (sh, r) => {
    src.onBeforeCompile(sh, r);
    sh.vertexShader = 'attribute vec2 aVox; attribute vec4 aOpen; varying vec2 vVox; varying vec4 vOpen;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vVox = aVox; vOpen = aOpen;');
    sh.fragmentShader = 'varying vec2 vVox; varying vec4 vOpen;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { float d = 1.0; if (vOpen.x > 0.5) d = min(d, vVox.x); if (vOpen.y > 0.5) d = min(d, 1.0 - vVox.x); if (vOpen.z > 0.5) d = min(d, vVox.y); if (vOpen.w > 0.5) d = min(d, 1.0 - vVox.y);
        diffuseColor.rgb *= 1.0 + ${edge.toFixed(3)} * (1.0 - smoothstep(0.03, 0.1, d)); }`);
  };
  m.customProgramCacheKey = () => src.customProgramCacheKey() + '|vox' + edge;
  matCache.set(k, m); return m;
}
const glowMats = new Map<number, THREE.MeshBasicMaterial>();
const glowMat = (k: number) => { if (!glowMats.has(k)) glowMats.set(k, new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), vertexColors: true, toneMapped: false })); return glowMats.get(k)!; };

export class VoxChar {
  cells = new Map<number, Cell & { x: number; y: number; z: number }>();
  bonesAbs = new Map<string, { parent: string | null; p: THREE.Vector3 }>();
  private cur = 'root';
  constructor(readonly s: number) { this.bonesAbs.set('root', { parent: null, p: new THREE.Vector3() }); }

  /** a joint at absolute cell-corner coordinates */
  bone(name: string, parent: string, x: number, y: number, z: number) { this.bonesAbs.set(name, { parent, p: new THREE.Vector3(x, y, z) }); return this; }
  /** subsequent cells belong to this bone's part */
  part(bone: string) { if (!this.bonesAbs.has(bone)) throw new Error('no bone ' + bone); this.cur = bone; return this; }

  set(x: number, y: number, z: number, c: Col | null, g = 0) { const k = key(x, y, z); if (c == null) this.cells.delete(k); else this.cells.set(k, { x, y, z, c, g, part: this.cur }); return this; }
  get(x: number, y: number, z: number) { return this.cells.get(key(x, y, z)); }
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: Col | null, g = 0) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x, y, z, c, g);
    return this;
  }
  /** mirrored across x = 0 (cell x ↔ −1 − x) */
  symBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: Col | null, g = 0) { this.box(x0, y0, z0, x1, y1, z1, c, g); return this.box(-1 - x0, y0, z0, -1 - x1, y1, z1, c, g); }
  sym(x: number, y: number, z: number, c: Col | null, g = 0) { this.set(x, y, z, c, g); return this.set(-1 - x, y, z, c, g); }
  ell(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, c: Col, g = 0) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, dz = (z + 0.5 - cz) / rz; if (dx * dx + dy * dy + dz * dz <= 1) this.set(x, y, z, c, g);
    }
    return this;
  }
  /** recolour existing cells: fn returns a colour (or null to keep) */
  paint(fn: (c: Cell & { x: number; y: number; z: number }) => Col | null | undefined, onlyPart?: string) {
    for (const v of this.cells.values()) { if (onlyPart && v.part !== onlyPart) continue; const r = fn(v); if (r != null) v.c = r; }
    return this;
  }
  /** a straight run of cells between two cell centres (staffs, straps) */
  line(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: Col, g = 0) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1);
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), Math.round(z0 + ((z1 - z0) * i) / n), c, g);
    return this;
  }

  /**
   * Build the rig: returns bones (Object3D, positioned relative to their parents, rest pose recorded) and the meshes per part.
   * jitter: per-cell brightness grain; glow: brightness multiplier for glowing cells (they feed the bloom).
   */
  build(o: { jitter?: number; glow?: number; rim?: number; self?: number; edge?: number } = {}) {
    const s = this.s, bones: Record<string, Bone> = {}, meshes: THREE.Mesh[] = [];
    for (const [name, b] of this.bonesAbs) {
      const o3 = new THREE.Object3D() as Bone; o3.name = name; bones[name] = o3;
      const par = b.parent ? this.bonesAbs.get(b.parent)!.p : new THREE.Vector3();
      o3.position.copy(b.p).sub(par).multiplyScalar(s);
    }
    for (const [name, b] of this.bonesAbs) if (b.parent) bones[b.parent].add(bones[name]);
    const occ = (x: number, y: number, z: number) => this.cells.has(key(x, y, z));
    const jit = o.jitter ?? 0.05, col = new THREE.Color();
    const byPart = new Map<string, { solid: number[][]; glow: number[][] }>();
    const hash = (x: number, y: number, z: number) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    for (const v of this.cells.values()) {
      if (!byPart.has(v.part)) byPart.set(v.part, { solid: [[], [], [], [], [], []], glow: [[], [], [], [], [], []] });
      const tgt = v.g > 0 ? byPart.get(v.part)!.glow : byPart.get(v.part)!.solid, [P, N, C, U, I, E] = tgt;
      col.set(v.c); const sh = v.g > 0 ? 1 : 1 + (hash(v.x, v.y, v.z) - 0.5) * 2 * jit;
      const bp = this.bonesAbs.get(v.part)!.p;
      for (let d = 0; d < 6; d++) {
        const [dx, dy, dz] = DIRS[d], nb = this.cells.get(key(v.x + dx, v.y + dy, v.z + dz));
        if (nb && nb.part === v.part && (nb.g > 0) === (v.g > 0)) continue;
        const [t1, t2] = TAN[d], base = P.length / 3, pos = dx + dy + dz > 0;
        const cx = v.x + 0.5 + dx * 0.5, cy = v.y + 0.5 + dy * 0.5, cz = v.z + 0.5 + dz * 0.5;
        const aos: number[] = [];
        // an edge of this face is "open" (gets the bevel) only where the block sticks out (convex edge)
        const open = (tx: number, ty: number, tz: number) => (occ(v.x + tx, v.y + ty, v.z + tz) ? 0 : 1);
        const eo = [open(-t1[0], -t1[1], -t1[2]), open(t1[0], t1[1], t1[2]), open(-t2[0], -t2[1], -t2[2]), open(t2[0], t2[1], t2[2])];
        for (const [s1, s2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          P.push((cx + (t1[0] * s1 + t2[0] * s2) * 0.5 - bp.x) * s, (cy + (t1[1] * s1 + t2[1] * s2) * 0.5 - bp.y) * s, (cz + (t1[2] * s1 + t2[2] * s2) * 0.5 - bp.z) * s);
          N.push(dx, dy, dz); U.push(s1 > 0 ? 1 : 0, s2 > 0 ? 1 : 0); E.push(...eo);
          // corner AO from the three cells in front of the face around this corner
          const ox = v.x + dx, oy = v.y + dy, oz = v.z + dz;
          const a1 = occ(ox + t1[0] * s1, oy + t1[1] * s1, oz + t1[2] * s1) ? 1 : 0, a2 = occ(ox + t2[0] * s2, oy + t2[1] * s2, oz + t2[2] * s2) ? 1 : 0;
          const a3 = occ(ox + t1[0] * s1 + t2[0] * s2, oy + t1[1] * s1 + t2[1] * s2, oz + t1[2] * s1 + t2[2] * s2) ? 1 : 0;
          const ao = v.g > 0 ? 3 : a1 && a2 ? 0 : 3 - (a1 + a2 + a3); aos.push(ao);
          const f = AO[ao] * sh; C.push(col.r * f, col.g * f, col.b * f);
        }
        // flip the quad diagonal so AO interpolates without the anisotropy seam
        const flip = aos[0] + aos[2] < aos[1] + aos[3];
        const q = flip ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
        if (pos) I.push(...q.map(i => base + i)); else I.push(base + q[0], base + q[2], base + q[1], base + q[3], base + q[5], base + q[4]);
      }
    }
    const solidMat = voxToon({ rim: o.rim, self: o.self, edge: o.edge });
    for (const [part, { solid, glow }] of byPart) {
      for (const [arr, isGlow] of [[solid, false], [glow, true]] as const) {
        const [P, N, C, U, I, E] = arr; if (!I.length) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('aVox', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('aOpen', new THREE.Float32BufferAttribute(E, 4)); g.setIndex(I);
        g.computeBoundingSphere();
        const m = new THREE.Mesh(g, isGlow ? glowMat(o.glow ?? 2.6) : solidMat); m.castShadow = !isGlow; m.receiveShadow = false; m.name = part + (isGlow ? '_glow' : '');
        bones[part].add(m); if (!isGlow) meshes.push(m);
      }
    }
    for (const b of Object.values(bones)) b.rest = { p: b.position.clone(), r: b.rotation.clone(), s: b.scale.clone() };
    return { bones, meshes, root: bones.root };
  }
}
