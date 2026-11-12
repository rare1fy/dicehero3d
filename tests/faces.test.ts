// The shown face is always the rolled value (history: v5 raised the wrong face when dice lined up for the hand reveal).
import * as THREE from 'three';
import { FACE_N, FACE_U, FACE_V, assignFaceValues, presentQuat, snapFlat, topFaceOf, uprightTurns, turnedV, faceToward } from '../src/present/dice/faces';

const rq = (r: () => number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 7, r() * 7, r() * 7));
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

describe('face tables', () => {
  it('N = U × V for every face (outward, right-handed)', () => {
    for (let f = 0; f < 6; f++) expect(new THREE.Vector3().crossVectors(FACE_U[f], FACE_V[f]).distanceTo(FACE_N[f])).toBeLessThan(1e-9);
  });
  it('assignFaceValues puts the value on top and keeps all six values', () => {
    for (let top = 0; top < 6; top++) for (let v = 1; v <= 6; v++) {
      const f = assignFaceValues([1, 2, 3, 4, 5, 6], v, top);
      expect(f[top]).toBe(v); expect([...f].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });
});

describe('landed die: the top face is the value and its numeral reads upright from the camera', () => {
  it('random landings', () => {
    const r = rng(7), eye = new THREE.Vector3(0, 9, 12);
    for (let n = 0; n < 500; n++) {
      const q = snapFlat(rq(r), Math.floor(r() * 6)), top = topFaceOf(q).i, pos = new THREE.Vector3(r() * 6 - 3, 0.4, r() * 4 - 2);
      expect(topFaceOf(q).align).toBeGreaterThan(0.9999);
      const turns = uprightTurns(q, top, pos, eye);
      const up = turnedV(top, turns).applyQuaternion(q); up.y = 0; up.normalize();
      const away = new THREE.Vector3(pos.x - eye.x, 0, pos.z - eye.z).normalize();
      expect(up.dot(away)).toBeGreaterThan(Math.SQRT1_2 - 1e-6);   // within 45° of "away from the viewer"
    }
  });
});

describe('presented die (hand reveal): the value face points at the camera, numeral upright', () => {
  it('any face, any paint turns, any camera', () => {
    const r = rng(11);
    for (let n = 0; n < 500; n++) {
      const face = Math.floor(r() * 6), turns = Math.floor(r() * 4), camQ = rq(r);
      const q = presentQuat(face, turns, camQ);
      const toCam = new THREE.Vector3(0, 0, 1).applyQuaternion(camQ), camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camQ);
      const f = faceToward(q, toCam);
      expect(f.i).toBe(face); expect(f.align).toBeGreaterThan(0.9999);
      expect(turnedV(face, turns).applyQuaternion(q).dot(camUp)).toBeGreaterThan(0.9999);
    }
  });
});
