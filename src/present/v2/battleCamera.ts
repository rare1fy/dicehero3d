import * as THREE from 'three';
import type { BattleActor } from '../bestiary/battle';

export const HERO_POS = new THREE.Vector3(-3.6, 0, 0.5);
const LANES = [[-1.15, -2.0], [1.25, -2.8], [3.25, -3.4], [-3.4, -3.0]];
export function foePosition(lane: number, boss: boolean) {
  const p = LANES[lane % LANES.length];
  return new THREE.Vector3(boss ? 0 : p[0], 0, boss ? -2.7 : p[1]);
}
export interface FramingSubject { box: THREE.Box3; hero?: boolean; cardWidth?: number }
export function actorSubject(a: BattleActor, home: THREE.Vector3, hero = false): FramingSubject {
  a.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(a.root).translate(home.clone().sub(a.root.position));
  box.min.y = Math.min(box.min.y, home.y);
  if (hero) box.max.y += 0.9; // 职业状态也在取景内。
  return { box, hero, cardWidth: a.width > 2 ? 200 : 150 };
}
export interface CameraFit { eye: THREE.Vector3; look: THREE.Vector3; fov: number; distance: number; pitch: number; fits: boolean }

// 固定俯角下求透视安全区的可行交集：模型八个角 + 头牌像素留白。
// 小怪取最近的可行镜头；大模型最多 45°，距离限定 13～36。
export function fitBattleCamera(subjects: FramingSubject[], width: number, height: number, k: number, shift = 0): CameraFit {
  const large = subjects.some(s => !s.hero && s.box.getSize(new THREE.Vector3()).y > 3.0);
  const pitch = large ? 45 : 40, a = pitch * Math.PI / 180, up = new THREE.Vector3(0, Math.cos(a), -Math.sin(a));
  const back = new THREE.Vector3(0, Math.sin(a), Math.cos(a)), fov = 36, focal = height / (2 * Math.tan(fov * 0.86 * Math.PI / 360));
  const left = (width - 1280 * k) / 2, top = Math.max(0, height - 720 * k);
  let result!: CameraFit;
  for (let distance = 13; distance <= 36; distance += 0.2) {
    let xlo = -Infinity, xhi = Infinity, ylo = -Infinity, yhi = Infinity;
    for (const s of subjects) {
      const pad = s.hero ? 24 : (s.cardWidth ?? 150) / 2 + 12;
      for (const x of [s.box.min.x, s.box.max.x]) for (const y of [s.box.min.y, s.box.max.y]) for (const z of [s.box.min.z, s.box.max.z]) {
        const p = new THREE.Vector3(x, y, z), depth = Math.max(0.1, distance - p.dot(back)), py = p.dot(up);
        const t = top + (s.hero ? 110 : 100 + 104) * k, b = top + (s.hero ? 545 : 380) * k;
        xlo = Math.max(xlo, x - (left + (s.hero ? 350 : 1280 - 80 - pad) * k - width / 2) * depth / focal);
        xhi = Math.min(xhi, x - (left + (s.hero ? 100 : 80 + pad) * k - width / 2) * depth / focal);
        ylo = Math.max(ylo, py + (t - height / 2 + shift) * depth / focal);
        yhi = Math.min(yhi, py + (b - height / 2 + shift) * depth / focal);
      }
    }
    const fits = xlo <= xhi && ylo <= yhi, cx = (xlo + xhi) / 2, cy = (ylo + yhi) / 2;
    const look = up.clone().multiplyScalar(cy); look.x = cx;
    result = { eye: look.clone().addScaledVector(back, distance), look, fov, distance, pitch, fits };
    if (fits) break;
  }
  return result;
}
