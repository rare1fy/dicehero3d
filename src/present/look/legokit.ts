// Toy-brick look: the same part-on-joint models as the voxel kit, but each cell is one stud wide and one plate tall. Building turns
// the cells into real-looking bricks — columns of three same-colour plates become a brick, each brick layer is packed greedily into
// 1×N / 2×N bricks (orientation alternating per layer so the joints stagger), every brick is a slightly inset box so the seams show,
// exposed tops grow studs, and glowing cells become translucent emissive pieces. Glossy plastic with a soft room reflection.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VoxChar } from './voxkit';
import type { Bone } from '../actors/rig';

let envTex: THREE.Texture | null = null;
/** a small room reflection for the plastic (generated in-browser, no files) */
export const legoEnvTex = () => envTex;
export function initLegoEnv(renderer: THREE.WebGLRenderer) { if (envTex) return; const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); }

let plastic: THREE.MeshStandardMaterial | null = null;
function plasticMat() {
  if (plastic) return plastic;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0, envMap: envTex, envMapIntensity: 0.32 });
  // seams: darken a thin band along every brick edge (aBrick = position inside the face in studs, aBSize = face size)
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute vec2 aBrick; attribute vec2 aBSize; varying vec2 vB; varying vec2 vBS;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vB = aBrick; vBS = aBSize;');
    sh.fragmentShader = 'varying vec2 vB; varying vec2 vBS;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { vec2 e = min(vB, vBS - vB); float d = min(e.x, e.y); diffuseColor.rgb *= mix(0.74, 1.0, smoothstep(0.0, 0.04, d)); }`);
  };
  m.customProgramCacheKey = () => 'lego-plastic';
  return (plastic = m);
}
const transMats = new Map<number, THREE.MeshStandardMaterial>();
function transMat(c: number) {
  if (!transMats.has(c)) { const col = new THREE.Color(c); transMats.set(c, new THREE.MeshStandardMaterial({ color: col, emissive: col.clone().multiplyScalar(1.6), roughness: 0.15, transparent: true, opacity: 0.88, envMap: envTex, envMapIntensity: 0.8, toneMapped: false })); }
  return transMats.get(c)!;
}

export class LegoChar extends VoxChar {
  /** u = stud pitch (m), p = plate height (m) */
  constructor(readonly u: number, readonly p: number) { super(u); }

  build(_o: Record<string, unknown> = {}) {
    const u = this.u, p = this.p, bones: Record<string, Bone> = {}, meshes: THREE.Mesh[] = [];
    const scale = (v: THREE.Vector3) => new THREE.Vector3(v.x * u, v.y * p, v.z * u);
    for (const [name, b] of this.bonesAbs) {
      const o3 = new THREE.Object3D() as Bone; o3.name = name; bones[name] = o3;
      const par = b.parent ? this.bonesAbs.get(b.parent)!.p : new THREE.Vector3();
      o3.position.copy(scale(b.p.clone().sub(par)));
    }
    for (const [name, b] of this.bonesAbs) if (b.parent) bones[b.parent].add(bones[name]);
    const at = (x: number, y: number, z: number) => this.get(x, y, z);

    // 1) vertical: a column run of 3 plates (aligned to y % 3) of one part and colour becomes a brick
    type Cell = { x: number; y: number; z: number; c: number; g: number; part: string };
    const units: Array<Cell & { h: number }> = [], used = new Set<string>();
    const all = [...this.cells.values()] as Cell[];
    for (const c of all) {
      const k = `${c.x},${c.y},${c.z}`; if (used.has(k)) continue;
      const y0 = Math.floor(c.y / 3) * 3;
      const col = [0, 1, 2].map(i => at(c.x, y0 + i, c.z));
      if (c.g === 0 && col.every(q => q && q.part === c.part && q.c === c.c && q.g === 0)) { for (let i = 0; i < 3; i++) used.add(`${c.x},${y0 + i},${c.z}`); units.push({ ...c, y: y0, h: 3 }); }
      else { used.add(k); units.push({ ...c, h: 1 }); }
    }
    // 2) horizontal: pack same (part, colour, y, h) units into bricks up to 2×4 / 1×6, orientation alternating by layer
    const groups = new Map<string, Map<string, Cell & { h: number }>>();
    for (const q of units) { const gk = `${q.part}|${q.c}|${q.g}|${q.y}|${q.h}`; if (!groups.has(gk)) groups.set(gk, new Map()); groups.get(gk)!.set(`${q.x},${q.z}`, q); }
    const byPart = new Map<string, { solid: THREE.BufferGeometry[]; trans: Map<number, THREE.BufferGeometry[]> }>();
    const studGeo = new THREE.CylinderGeometry(u * 0.3, u * 0.3, u * 0.2, 14, 1); studGeo.translate(0, u * 0.1, 0);
    for (const [gk, cells] of groups) {
      const [part, cs, gs, ys, hs] = gk.split('|'), color = new THREE.Color(+cs), glow = +gs > 0, y = +ys, h = +hs, alongX = ((y / 3) | 0) % 2 === 0;
      if (!byPart.has(part)) byPart.set(part, { solid: [], trans: new Map() });
      const bp = this.bonesAbs.get(part)!.p, out = byPart.get(part)!;
      const keys = [...cells.keys()].sort((a, b) => { const [ax, az] = a.split(',').map(Number), [bx, bz] = b.split(',').map(Number); return alongX ? az - bz || ax - bx : ax - bx || az - bz; });
      const done = new Set<string>();
      for (const k of keys) {
        if (done.has(k)) continue;
        const [x0, z0] = k.split(',').map(Number);
        const free = (x: number, z: number) => cells.has(`${x},${z}`) && !done.has(`${x},${z}`);
        // length along the main axis (max 4 for 2-wide, 6 for 1-wide), then try to widen to 2
        let len = 1; while (len < 6 && free(alongX ? x0 + len : x0, alongX ? z0 : z0 + len)) len++;
        let wid = 1; if (len <= 4 && [...Array(len).keys()].every(i => free(alongX ? x0 + i : x0 + 1, alongX ? z0 + 1 : z0 + i))) wid = 2;
        const w = alongX ? len : wid, d = alongX ? wid : len;
        for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) done.add(`${x0 + i},${z0 + j}`);
        // the brick body, inset a hair so the seams read
        const gap = u * 0.035, bw = w * u - gap, bh = h * p - p * 0.06, bd = d * u - gap;
        const g = new THREE.BoxGeometry(bw, bh, bd); const cx = (x0 + w / 2 - bp.x) * u, cy = (y + h / 2 - bp.y) * p, cz = (z0 + d / 2 - bp.z) * u; g.translate(cx, cy, cz);
        // per-face brick coords (in studs) for the seam shader
        const P = g.attributes.position, N = g.attributes.normal, B = new Float32Array(P.count * 2), S = new Float32Array(P.count * 2);
        for (let i = 0; i < P.count; i++) {
          const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), lx = (P.getX(i) - cx + bw / 2) / u, ly = (P.getY(i) - cy + bh / 2) / u, lz = (P.getZ(i) - cz + bd / 2) / u;
          const [a, b2, sa, sb] = nx > 0.5 ? [lz, ly, bd / u, bh / u] : ny > 0.5 ? [lx, lz, bw / u, bd / u] : [lx, ly, bw / u, bh / u];
          B[i * 2] = a; B[i * 2 + 1] = b2; S[i * 2] = sa; S[i * 2 + 1] = sb;
        }
        g.setAttribute('aBrick', new THREE.BufferAttribute(B, 2)); g.setAttribute('aBSize', new THREE.BufferAttribute(S, 2));
        const cols = new Float32Array(P.count * 3); for (let i = 0; i < P.count; i++) cols.set([color.r, color.g, color.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        g.deleteAttribute('uv');
        const parts: THREE.BufferGeometry[] = [g];
        // studs on every exposed top cell of this brick
        for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) {
          if (at(x0 + i, y + h, z0 + j)) continue;
          const sg = studGeo.clone(); sg.translate((x0 + i + 0.5 - bp.x) * u, (y + h - bp.y) * p - p * 0.03, (z0 + j + 0.5 - bp.z) * u);
          const n = sg.attributes.position.count, sc = new Float32Array(n * 3), sb = new Float32Array(n * 2), ss = new Float32Array(n * 2).fill(9);
          for (let q = 0; q < n; q++) { sc.set([color.r, color.g, color.b], q * 3); sb[q * 2] = 4; sb[q * 2 + 1] = 4; }
          sg.setAttribute('color', new THREE.BufferAttribute(sc, 3)); sg.setAttribute('aBrick', new THREE.BufferAttribute(sb, 2)); sg.setAttribute('aBSize', new THREE.BufferAttribute(ss, 2)); sg.deleteAttribute('uv');
          parts.push(sg);
        }
        if (glow) { const k2 = +cs; if (!out.trans.has(k2)) out.trans.set(k2, []); out.trans.get(k2)!.push(...parts); }
        else out.solid.push(...parts);
      }
    }
    for (const [part, { solid, trans }] of byPart) {
      if (solid.length) { const m = new THREE.Mesh(mergeGeometries(solid.map(g => g.index ? g.toNonIndexed() : g))!, plasticMat()); m.castShadow = true; m.name = part; bones[part].add(m); meshes.push(m); }
      for (const [c, gs] of trans) { const m = new THREE.Mesh(mergeGeometries(gs.map(g => g.index ? g.toNonIndexed() : g))!, transMat(c)); m.name = part + '_trans'; bones[part].add(m); }
    }
    for (const b of Object.values(bones)) b.rest = { p: b.position.clone(), r: b.rotation.clone(), s: b.scale.clone() };
    return { bones, meshes, root: bones.root };
  }
}
