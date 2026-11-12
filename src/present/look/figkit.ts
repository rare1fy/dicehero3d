// Toy-figure look (人仔风): a fixed set of moulded parts — block legs with a foot lip, a hip piece, a trapezoid torso, tube arms
// ending in ring hands, a neck post and a rounded cylinder head — whose character comes from printing (faces, costumes drawn on
// canvas) and plug-on accessories (hair, beards, hoods, hats, weapons). Glossy plastic. Our own proportions and details (no stud on
// the head, ring hands), in the spirit of classic toy figures. Same joint names as the voxel kit, so the same poses drive it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { VoxChar } from './voxkit';
import { canvasTex } from '../engine/world';
import type { Bone } from '../actors/rig';

let envTex: THREE.Texture | null = null;
export function setFigEnv(t: THREE.Texture | null) { envTex = t; }
const mats = new Map<string, THREE.Material>();
export function plastic(c: number, o: { rough?: number } = {}) {
  const k = `p${c}|${o.rough ?? 0.32}`;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: o.rough ?? 0.32, metalness: 0, envMap: envTex, envMapIntensity: 0.35 }));
  return mats.get(k) as THREE.MeshStandardMaterial;
}
export function printed(tex: THREE.Texture) { return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.32, metalness: 0, envMap: envTex, envMapIntensity: 0.35 }); }
export function transGlow(c: number) {
  const k = `t${c}`; if (!mats.has(k)) { const col = new THREE.Color(c); mats.set(k, new THREE.MeshStandardMaterial({ color: col, emissive: col.clone().multiplyScalar(1.5), roughness: 0.12, transparent: true, opacity: 0.9, envMap: envTex, envMapIntensity: 0.6, toneMapped: false })); }
  return mats.get(k)!;
}

/** a print sheet: draw(g, w, h) paints the surface; the bottom-left 8×8 px stays the base colour for unprinted faces */
export function sheet(w: number, h: number, base: string, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const t = canvasTex(w, h, g => { g.fillStyle = base; g.fillRect(0, 0, w, h); draw(g, w, h); g.fillStyle = base; g.fillRect(0, h - 8, 8, 8); });
  t.anisotropy = 4; return t;
}

// ------------------------------------------------------------------ moulded parts (sizes in figure millimetres; k converts to metres)
/** rounded cylinder head; the print wraps around with the face centred at u = 0.5 */
export function headGeo(r: number, h: number) {
  const e = Math.min(r, h) * 0.12, pts = [[0, 0], [r - e, 0], [r, e], [r, h - e], [r - e, h], [0, h]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 40, -Math.PI, Math.PI * 2);
  // v by height so the print maps evenly on the side; caps take the base corner
  const P = g.attributes.position, U = g.attributes.uv;
  for (let i = 0; i < P.count; i++) { const y = P.getY(i), rr = Math.hypot(P.getX(i), P.getZ(i)); if (rr < r - e * 0.5) U.setXY(i, 0.005, 0.005); else U.setY(i, y / h); }
  return g;
}
/** a box tapering toward the top (torsos, skirts); only the +z face (and optionally −z) shows the print */
export function taperBox(wB: number, wT: number, h: number, d: number, o: { dB?: number; back?: boolean } = {}) {
  const g = new THREE.BoxGeometry(wB, h, d, 1, 1, 1), P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const top = P.getY(i) > 0; if (top) P.setX(i, P.getX(i) * (wT / wB));
    if (!top && o.dB) P.setZ(i, P.getZ(i) * (o.dB / d));
    const nz = N.getZ(i); if (!(nz > 0.5 || (o.back && nz < -0.5))) U.setXY(i, 0.005, 0.005); else if (nz < -0.5) U.setX(i, U.getX(i));
  }
  g.computeVertexNormals(); return g;
}
export const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2));
export function ring(r: number, tube: number) { return new THREE.TorusGeometry(r, tube, 12, 24); }
export function tube(r: number, len: number) { const g = new THREE.CylinderGeometry(r, r, len, 16); g.translate(0, -len / 2, 0); return g; }
/** a flat extruded shape (blades, hair crests, beards), in the xy plane, thickness along z */
export function flat(pts: Array<[number, number]>, depth: number, bevel = 0.4) {
  const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 }); g.translate(0, 0, -depth / 2); return g;
}

export interface FigSpec {
  k: number;                                   // millimetres → metres
  skin: number; legs: number; hips: number; boots?: number;
  torso: THREE.Texture | number; arms: number; hands: number; face: THREE.Texture;
  /** optional skirt instead of legs (robes) */
  skirt?: { c: number | THREE.Texture; h: number; wB: number };
}
/** the anchor points accessories attach to, in figure millimetres */
export const FIG = { legH: 11.2, hipH: 3.2, torsoH: 12.8, torsoWB: 15.6, torsoWT: 12, torsoD: 7.6, neckH: 1.6, headR: 4.9, headH: 8.6, shoulderX: 6.9, handZ: 3.4 };

export class FigChar extends VoxChar {
  extent = { top: 0, width: 0 };
  private items: Array<{ bone: string; obj: THREE.Object3D }> = [];
  constructor(readonly k: number) { super(1); }
  /** attach an object placed in absolute figure millimetres to a joint */
  add(bone: string, geo: THREE.BufferGeometry, mat: THREE.Material, at: [number, number, number], rot: [number, number, number] = [0, 0, 0], o: { shadow?: boolean } = {}) {
    const m = new THREE.Mesh(geo, mat); m.position.set(...at); m.rotation.set(...rot); m.castShadow = o.shadow ?? true;
    this.items.push({ bone, obj: m }); return m;
  }
  build(_o: Record<string, unknown> = {}) {
    const k = this.k, bones: Record<string, Bone> = {}, meshes: THREE.Mesh[] = [];
    for (const [name, b] of this.bonesAbs) {
      const o3 = new THREE.Object3D() as Bone; o3.name = name; bones[name] = o3;
      const par = b.parent ? this.bonesAbs.get(b.parent)!.p : new THREE.Vector3();
      o3.position.copy(b.p).sub(par).multiplyScalar(k);
    }
    for (const [name, b] of this.bonesAbs) if (b.parent) bones[b.parent].add(bones[name]);
    const box = new THREE.Box3();
    for (const { bone, obj } of this.items) {
      const bp = this.bonesAbs.get(bone)!.p; obj.position.sub(bp).multiplyScalar(k); obj.scale.multiplyScalar(k);
      bones[bone].add(obj);
      const m = obj as THREE.Mesh; if (m.isMesh && (m.material as THREE.MeshStandardMaterial).isMeshStandardMaterial && !(m.material as THREE.MeshStandardMaterial).transparent) meshes.push(m);
    }
    bones.root.updateMatrixWorld(true); box.setFromObject(bones.root);
    this.extent = { top: box.max.y, width: box.max.x - box.min.x };
    for (const b of Object.values(bones)) b.rest = { p: b.position.clone(), r: b.rotation.clone(), s: b.scale.clone() };
    return { bones, meshes, root: bones.root };
  }
}

/** the standard figure: joints + body parts. Returns the char; accessories are added by the caller. */
export function figure(s: FigSpec) {
  const f = new FigChar(s.k), F = FIG;
  const hipY = F.legH, torsoY0 = hipY + F.hipH, torsoY1 = torsoY0 + F.torsoH, headY0 = torsoY1 + F.neckH, shY = torsoY1 - 2.2;
  f.bone('hips', 'root', 0, hipY, 0).bone('spine', 'hips', 0, torsoY0, 0).bone('chest', 'spine', 0, torsoY0 + 4, 0).bone('neck', 'chest', 0, torsoY1, 0).bone('head', 'neck', 0, headY0, 0)
    .bone('jaw', 'head', 0, headY0 + 1, F.headR - 1).bone('hat', 'head', 0, headY0 + F.headH, 0).bone('cape', 'chest', 0, torsoY1, -F.torsoD / 2)
    .bone('shL', 'chest', F.shoulderX, shY, 0).bone('armL', 'shL', F.shoulderX, shY, 0).bone('foreL', 'armL', F.shoulderX + 1.2, shY - 5.6, 0.6).bone('handL', 'foreL', F.shoulderX + 1.4, shY - 9.6, F.handZ - 0.8)
    .bone('shR', 'chest', -F.shoulderX, shY, 0).bone('armR', 'shR', -F.shoulderX, shY, 0).bone('foreR', 'armR', -F.shoulderX - 1.2, shY - 5.6, 0.6).bone('handR', 'foreR', -F.shoulderX - 1.4, shY - 9.6, F.handZ - 0.8)
    .bone('weapon', 'handR', -F.shoulderX - 1.4, shY - 11.4, F.handZ).bone('offhand', 'handL', F.shoulderX + 1.4, shY - 11.4, F.handZ)
    .bone('legL', 'hips', 3.9, hipY, 0).bone('shinL', 'legL', 3.9, 5, 0).bone('footL', 'shinL', 3.9, 1, 0).bone('legR', 'hips', -3.9, hipY, 0).bone('shinR', 'legR', -3.9, 5, 0).bone('footR', 'shinR', -3.9, 1, 0);
  // legs with a foot lip, or a robe skirt
  if (s.skirt) {
    const m = typeof s.skirt.c === 'number' ? plastic(s.skirt.c) : printed(s.skirt.c);
    f.add('hips', taperBox(s.skirt.wB, F.torsoWB, s.skirt.h, F.torsoD + 2.4, { dB: F.torsoD + 5 }), m, [0, hipY + F.hipH - s.skirt.h / 2, 0]);
  } else {
    for (const [b, x] of [['legL', 3.9], ['legR', -3.9]] as const) {
      f.add(b, rbox(7.4, F.legH - 1, 6.6, 0.6), plastic(s.legs), [x, (F.legH - 1) / 2 + 1, -0.3]);
      f.add(b, rbox(7.4, 2.4, 8.6, 0.6), plastic(s.boots ?? s.legs), [x, 1.2, 0.6]);
    }
    f.add('hips', rbox(15.6, F.hipH, 7.4, 0.6), plastic(s.hips), [0, hipY + F.hipH / 2, 0]);
  }
  // torso, neck post, head
  f.add('chest', taperBox(F.torsoWB, F.torsoWT, F.torsoH, F.torsoD, { back: true }), typeof s.torso === 'number' ? plastic(s.torso) : printed(s.torso), [0, torsoY0 + F.torsoH / 2, 0]);
  f.add('neck', tube(3.2, F.neckH + 0.6), plastic(s.skin), [0, headY0 + 0.4, 0]);
  f.add('head', headGeo(F.headR, F.headH), printed(s.face), [0, headY0, 0]);
  // arms: an upper tube and a forearm tube, ring hands facing forward
  for (const [sx, A, Fo, H] of [[1, 'armL', 'foreL', 'handL'], [-1, 'armR', 'foreR', 'handR']] as const) {
    const up = tube(2.1, 6.4); f.add(A, up, plastic(s.arms), [sx * F.shoulderX, shY + 0.8, 0], [0, 0, sx * 0.18]);
    f.add(A, new THREE.SphereGeometry(2.4, 16, 12), plastic(s.arms), [sx * F.shoulderX, shY, 0]);
    f.add(Fo, tube(2.0, 5.2), plastic(s.arms), [sx * (F.shoulderX + 1.2), shY - 5.2, 0.6], [-0.5, 0, 0]);
    f.add(H, ring(1.9, 0.95), plastic(s.hands), [sx * (F.shoulderX + 1.4), shY - 11.4, F.handZ], [0, 0, 0]);
    f.add(H, tube(1.2, 1.6), plastic(s.hands), [sx * (F.shoulderX + 1.4), shY - 9.4, F.handZ - 0.8], [-0.5, 0, 0]);
  }
  return { f, hipY, torsoY0, torsoY1, headY0, shY, top: headY0 + F.headH };
}

// ------------------------------------------------------------------ print helpers (face sheet is 512×256: u around the head, v up)
/** canvas x of a point on the face front: dx in units of the head radius (−1..1), y in sheet px from the top */
export const faceX = (w: number, dx: number) => w * 0.5 + dx * w * 0.16;
export function dotEye(g: CanvasRenderingContext2D, x: number, y: number, r: number, col = '#141018', hi = true) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, r, r * 1.15, 0, 0, Math.PI * 2); g.fill(); if (hi) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + r * 0.35, y - r * 0.4, r * 0.3, 0, Math.PI * 2); g.fill(); } }
export function stroke(g: CanvasRenderingContext2D, col: string, w: number, pts: Array<[number, number]>) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
export function fillPoly(g: CanvasRenderingContext2D, col: string, pts: Array<[number, number]>) { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); }
