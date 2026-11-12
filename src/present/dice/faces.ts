// Die face geometry: which local face is which, how each face's texture tile is oriented, and the maths that keeps the shown face
// honest — the face that ends on top (or that is turned toward the camera when the dice line up) is always the rolled value, upright.
// History item: v5 showed the wrong face when dice rose into a row (it assumed the value sat on the local +Y face). Here every pose that
// presents a value is computed from that die's own value face (presentQuat), and tests/faces.test.ts checks it for random rolls.
import * as THREE from 'three';

/** Local faces: 0 +X, 1 −X, 2 +Y, 3 −Y, 4 +Z, 5 −Z. U = texture right, V = texture up, N = U × V (outward). */
export const FACE_N = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
export const FACE_U = [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0)];
export const FACE_V = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0)];

/** A sharp cube (no rounded corners — history item) with each face UV-mapped to tile i of a 6×1 atlas. */
export function dieGeometry(size: number): THREE.BufferGeometry {
  const h = size / 2, pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let f = 0; f < 6; f++) {
    const N = FACE_N[f], U = FACE_U[f], V = FACE_V[f], base = pos.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = N.clone().multiplyScalar(h).addScaledVector(U, a * h).addScaledVector(V, b * h);
      pos.push(p.x, p.y, p.z); nor.push(N.x, N.y, N.z); uv.push((f + (a + 1) / 2) / 6, (b + 1) / 2);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}

const _v = new THREE.Vector3();
/** Which local face points most nearly along `dir` (world) for orientation q; align = cosine. */
export function faceToward(q: THREE.Quaternion, dir: THREE.Vector3): { i: number; align: number } {
  let best = 0, bd = -2;
  for (let i = 0; i < 6; i++) { const d = _v.copy(FACE_N[i]).applyQuaternion(q).dot(dir); if (d > bd) { bd = d; best = i; } }
  return { i: best, align: bd };
}
export const UP = new THREE.Vector3(0, 1, 0);
export const topFaceOf = (q: THREE.Quaternion) => faceToward(q, UP);

/** Rotation that snaps q so face i points exactly up (keeps the yaw). */
export function snapFlat(q: THREE.Quaternion, i: number): THREE.Quaternion {
  const nW = FACE_N[i].clone().applyQuaternion(q);
  return new THREE.Quaternion().setFromUnitVectors(nW, UP).multiply(q.clone());
}

/** Quarter turns (0..3) to paint the top tile with so its numeral reads upright for a viewer at `eye` (world, die-local frame same as world). */
export function uprightTurns(qEnd: THREE.Quaternion, top: number, diePos: THREE.Vector3, eye: THREE.Vector3): number {
  const V = FACE_V[top].clone().applyQuaternion(qEnd); V.y = 0; V.normalize();
  const D = new THREE.Vector3(diePos.x - eye.x, 0, diePos.z - eye.z).normalize();   // "away from the viewer" on the ground = text up
  // angle from V to D, measured around +Y (counter-clockwise seen from above)
  const ang = Math.atan2(V.z * D.x - V.x * D.z, V.x * D.x + V.z * D.z);
  return ((Math.round(ang / (Math.PI / 2)) % 4) + 4) % 4;
}
/** The tile's effective "up" after painting it with `turns` quarter turns (counter-clockwise in texture space). */
export function turnedV(face: number, turns: number): THREE.Vector3 {
  const U = FACE_U[face], V = FACE_V[face];
  switch (((turns % 4) + 4) % 4) { case 0: return V.clone(); case 1: return U.clone().negate(); case 2: return V.clone().negate(); default: return U.clone(); }
}

/** Orientation (world) that turns face `face` (painted with `turns`) squarely toward the camera with its numeral upright on screen. */
export function presentQuat(face: number, turns: number, cameraQ: THREE.Quaternion): THREE.Quaternion {
  const N = FACE_N[face], Vt = turnedV(face, turns), Ut = new THREE.Vector3().crossVectors(Vt, N);   // right = up × normal
  // local basis (Ut, Vt, N) must map to camera-space (X, Y, Z): R = [X Y Z]·[Ut Vt N]^T = [Ut Vt N]^T
  const m = new THREE.Matrix4().makeBasis(Ut, Vt, N).transpose();
  return cameraQ.clone().multiply(new THREE.Quaternion().setFromRotationMatrix(m));
}

/** Rotate a die's face numbering so `value` sits on face `top` (a cyclic shift keeps every value once). */
export function assignFaceValues(faces: readonly number[], value: number, top: number): number[] {
  const f = faces.length === 6 ? faces : [1, 2, 3, 4, 5, 6];
  let k = f.indexOf(value); if (k < 0) k = 0;
  const out = f.map((_, j) => f[(j - top + k + 12) % 6]);
  out[top] = value;
  return out;
}
