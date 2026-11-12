// The battle cast as toy figures (look/figkit.ts): printed faces and costumes, plug-on hair / beards / hoods / crowns / weapons.
import * as THREE from 'three';
import { figure, FIG, plastic, printed, transGlow, sheet, headGeo, taperBox, rbox, tube, flat, faceX, dotEye, stroke, fillPoly, setFigEnv } from '../look/figkit';
import { BattleActor } from './battle';
import type { ModelDef } from './models';
import type { Cast } from '../actors/cast';
import type { V } from './kit';

export { setFigEnv };
const C = { NOUGAT: 0xd89a6a, SKIN_S: '#d89a6a', RED: 0xc0261c, ORANGE: 0xff8a1c, YELLOW: 0xffc83a, BROWN: 0x5e3418, DBROWN: 0x3a2210, TAN: 0xe2cfa0, GREY: 0x7a7e86, LGREY: 0xc8ccd2, DGREY: 0x4a4c54, PURPLE: 0x5e2a8c, DPURPLE: 0x3a1a5a, GOLD: 0xe0b040, BONE: 0xece6d8, GREEN: 0x7a9a62, DGREEN: 0x4a6a3e, BLACK: 0x18141a };

// ================================================================== 嗜血狂战
function warrior(): V {
  const face = sheet(512, 256, C.SKIN_S, (g, w) => {
    g.fillStyle = '#2a4aa8'; g.fillRect(faceX(w, -1.0), 98, faceX(w, 1.0) - faceX(w, -1.0), 44);   // woad band
    dotEye(g, faceX(w, -0.42), 120, 13); dotEye(g, faceX(w, 0.42), 120, 13);
    stroke(g, '#5a1e10', 12, [[faceX(w, -0.8), 84], [faceX(w, -0.18), 100]]); stroke(g, '#5a1e10', 12, [[faceX(w, 0.8), 84], [faceX(w, 0.18), 100]]);
    stroke(g, '#a8604a', 5, [[faceX(w, 0.7), 150], [faceX(w, 0.55), 172]]);   // scar
    fillPoly(g, '#6e3216', [[faceX(w, -0.9), 158], [faceX(w, 0.9), 158], [faceX(w, 0.8), 256], [faceX(w, -0.8), 256]]);   // beard printed on the jaw
    g.fillStyle = '#2a1008'; g.fillRect(faceX(w, -0.32), 176, faceX(w, 0.32) - faceX(w, -0.32), 16); g.fillStyle = '#fff4e0'; g.fillRect(faceX(w, -0.26), 176, faceX(w, 0.26) - faceX(w, -0.26), 6);
  });
  const torso = sheet(512, 512, C.SKIN_S, (g, w, h) => {
    stroke(g, '#b07850', 8, [[w * 0.18, h * 0.34], [w * 0.46, h * 0.42]]); stroke(g, '#b07850', 8, [[w * 0.82, h * 0.34], [w * 0.54, h * 0.42]]);   // pecs
    for (const y of [0.55, 0.66]) { stroke(g, '#b07850', 6, [[w * 0.4, h * y], [w * 0.47, h * y]]); stroke(g, '#b07850', 6, [[w * 0.53, h * y], [w * 0.6, h * y]]); }
    fillPoly(g, '#5e3418', [[w * 0.72, 0], [w * 0.92, 0], [w * 0.3, h * 0.84], [w * 0.1, h * 0.84]]);   // strap
    g.fillStyle = '#c8ccd2'; for (const t of [0.2, 0.42, 0.64]) { g.beginPath(); g.arc(w * (0.82 - t * 0.62), h * (t * 0.84) + 22, 9, 0, 7); g.fill(); }
    g.fillStyle = '#3a2210'; g.fillRect(0, h * 0.84, w, h * 0.16); g.fillStyle = '#e0b040'; g.fillRect(w * 0.42, h * 0.85, w * 0.16, h * 0.14);   // belt
  });
  const { f, headY0, torsoY1, shY } = figure({ k: 0.05, skin: C.NOUGAT, legs: C.DBROWN, boots: C.TAN, hips: 0x8a2018, torso, arms: C.NOUGAT, hands: C.NOUGAT, face });
  const top = headY0 + FIG.headH;
  // flame mohawk: two crest layers running front to back
  const crest = (s: number) => flat([[-5 * s, 0], [-5 * s, 3], [-3.5 * s, 6.5], [-2 * s, 4], [-0.5 * s, 8.5], [1 * s, 4.5], [2.5 * s, 7.5], [3.5 * s, 3.5], [5 * s, 5.5], [5 * s, 0]], 2.4, 0.4);
  f.add('hat', crest(1), plastic(C.RED), [0, top - 1, -0.3], [0, Math.PI / 2, 0]);
  f.add('hat', crest(0.8), plastic(C.ORANGE), [0, top - 0.6, -0.1], [0, Math.PI / 2, 0]).scale.set(1, 0.85, 1.3);
  // beard piece with a braid, ears
  f.add('jaw', flat([[-4.6, 1.5], [4.6, 1.5], [3.8, -2.5], [1.4, -5.5], [-1.4, -5.5], [-3.8, -2.5]], 1.6, 0.5), plastic(0x6e3216), [0, headY0 + 0.5, FIG.headR - 0.2]);
  f.add('jaw', tube(0.8, 3.2), plastic(0x6e3216), [0, headY0 - 4.6, FIG.headR + 0.6]); f.add('jaw', new THREE.SphereGeometry(1, 12, 8), plastic(C.GOLD), [0, headY0 - 7.6, FIG.headR + 0.6]);
  // fur mantle with a horn on the left shoulder; bracers
  f.add('shL', rbox(7, 3.4, 8.4, 1.4), plastic(C.TAN), [FIG.shoulderX + 0.4, shY + 1.6, 0]);
  const horn = new THREE.ConeGeometry(0.9, 3.6, 10); f.add('shL', horn, plastic(0xf4eedc), [FIG.shoulderX + 1.4, shY + 4.6, -1], [0, 0, -0.3]);
  for (const [b, x] of [['foreL', 1], ['foreR', -1]] as const) f.add(b, new THREE.CylinderGeometry(2.3, 2.3, 2, 16), plastic(C.DGREY), [x * (FIG.shoulderX + 1.4), shY - 8, 2], [-0.5, 0, 0]);
  // the great axe: haft through the right ring hand along +z, a broad blade hanging under its far end
  const wx = -FIG.shoulderX - 1.4, wy = shY - 11.4, wz = FIG.handZ;
  const haft = tube(0.85, 28); haft.rotateX(-Math.PI / 2); f.add('weapon', haft, plastic(C.BROWN), [wx, wy, wz - 6]);
  f.add('weapon', flat([[15, 1.2], [22, 1.2], [24, -1.2], [24, -7], [21.5, -9], [18.5, -6.5], [15, -3]], 1.2, 0.35), plastic(C.LGREY), [wx, wy, wz], [0, -Math.PI / 2, 0]);
  f.add('weapon', flat([[15, 1.2], [17, 1.2], [17, 4.5], [15, 3]], 1.4, 0.3), plastic(C.GREY), [wx, wy, wz], [0, -Math.PI / 2, 0]);
  void torsoY1;
  return f;
}

// ================================================================== 枯骨巫妖
function lich(): V {
  const face = sheet(512, 256, '#ece6d8', (g, w) => {
    for (const s of [-1, 1]) { g.fillStyle = '#141018'; g.beginPath(); g.ellipse(faceX(w, s * 0.42), 118, 26, 30, 0, 0, 7); g.fill(); }
    fillPoly(g, '#141018', [[faceX(w, 0), 150], [faceX(w, -0.12), 170], [faceX(w, 0.12), 170]]);
    g.fillStyle = '#141018'; g.fillRect(faceX(w, -0.55), 190, faceX(w, 0.55) - faceX(w, -0.55), 30); g.fillStyle = '#ece6d8';
    for (let i = 0; i < 6; i++) g.fillRect(faceX(w, -0.5 + i * 0.19), 192, faceX(w, 0.1) - faceX(w, 0), 26);
    stroke(g, '#8a8270', 4, [[faceX(w, 0.6), 70], [faceX(w, 0.5), 90], [faceX(w, 0.62), 100]]);
  });
  const torso = sheet(512, 512, '#5e2a8c', (g, w, h) => {
    fillPoly(g, '#141018', [[w * 0.3, 0], [w * 0.7, 0], [w * 0.5, h * 0.62]]);   // open collar
    g.strokeStyle = '#ece6d8'; g.lineWidth = 14; for (const y of [0.14, 0.27, 0.4]) { g.beginPath(); g.moveTo(w * (0.36 + y * 0.2), h * y); g.lineTo(w * (0.64 - y * 0.2), h * y); g.stroke(); }
    g.fillStyle = '#ece6d8'; g.fillRect(w * 0.48, 0, w * 0.04, h * 0.5);
    stroke(g, '#e0b040', 16, [[w * 0.28, 0], [w * 0.5, h * 0.66], [w * 0.72, 0]]); g.fillStyle = '#e0b040'; g.fillRect(w * 0.47, h * 0.62, w * 0.06, h * 0.38);
    g.fillStyle = '#3a1a5a'; g.fillRect(0, h * 0.9, w, h * 0.1);
  });
  const skirt = sheet(256, 256, '#5e2a8c', (g, w, h) => { g.fillStyle = '#e0b040'; g.fillRect(w * 0.44, 0, w * 0.12, h); g.fillRect(0, h * 0.86, w, h * 0.08); });
  const { f, headY0, shY } = figure({ k: 0.068, skin: C.BONE, legs: C.DPURPLE, hips: C.DPURPLE, torso, arms: C.PURPLE, hands: C.BONE, face, skirt: { c: skirt, h: FIG.legH + FIG.hipH, wB: 21 } });
  const top = headY0 + FIG.headH, R = FIG.headR;
  // glowing soul eyes in the sockets
  for (const s of [-1, 1]) f.add('head', new THREE.SphereGeometry(1.1, 12, 10), transGlow(0x7affb0), [s * R * 0.42 * 0.95, headY0 + 4.9, R * 0.86]);
  // hood: a shell open at the front
  const hood = new THREE.LatheGeometry([[R + 0.9, -0.6], [R + 1.3, FIG.headH * 0.5], [R + 1.0, FIG.headH + 0.5], [R * 0.6, FIG.headH + 1.8], [0.01, FIG.headH + 2.3]].map(([x, y]) => new THREE.Vector2(x, y)), 32, 0.75, Math.PI * 2 - 1.5);
  const hm = plastic(C.DPURPLE).clone(); hm.side = THREE.DoubleSide; f.add('head', hood, hm, [0, headY0, 0]);
  // crown with spikes and a soul gem
  f.add('hat', new THREE.CylinderGeometry(R + 0.3, R + 0.5, 1.6, 24, 1, true), plastic(C.GOLD), [0, top + 2.2, 0]);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; f.add('hat', new THREE.ConeGeometry(0.7, 2.6, 8), plastic(C.GOLD), [Math.sin(a) * (R + 0.4), top + 4.2, Math.cos(a) * (R + 0.4)]); }
  f.add('hat', new THREE.OctahedronGeometry(1, 0), transGlow(0x7affb0), [0, top + 2.2, R + 0.7]);
  // spiked pauldrons
  for (const [b, x] of [['shL', 1], ['shR', -1]] as const) {
    f.add(b, rbox(6.4, 3.2, 8.2, 1.2), plastic(C.DGREY), [x * (FIG.shoulderX + 0.6), shY + 1.4, 0]);
    for (let i = 0; i < 3; i++) f.add(b, new THREE.ConeGeometry(0.6, 2.6, 8), plastic(C.BONE), [x * (FIG.shoulderX - 0.6 + i * 1.4), shY + 4.1, -1.5 + i]);
  }
  // staff: dark haft along +z, a bone cage around a glowing gem
  const wx = -FIG.shoulderX - 1.4, wy = shY - 11.4, wz = FIG.handZ;
  const haft = tube(0.8, 34); haft.rotateX(-Math.PI / 2); f.add('weapon', haft, plastic(C.DBROWN), [wx, wy, wz - 8]);
  f.add('weapon', new THREE.IcosahedronGeometry(2.2, 0), transGlow(0x6affa0), [wx, wy, wz + 29]);
  for (const [dx, dy] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) { const b = tube(0.45, 7); b.rotateX(-Math.PI / 2); f.add('weapon', b, plastic(C.BONE), [wx + dx, wy + dy, wz + 25.5]); }
  return f;
}

// ================================================================== 食尸鬼
function ghoul(): V {
  const face = sheet(512, 256, '#7a9a62', (g, w) => {
    fillPoly(g, '#4a6a3e', [[faceX(w, -0.95), 70], [faceX(w, 0.95), 70], [faceX(w, 0.85), 98], [faceX(w, -0.85), 98]]);   // heavy brow
    for (const s of [-1, 1]) { g.fillStyle = '#2a0a08'; g.beginPath(); g.ellipse(faceX(w, s * 0.42), 120, 20, 16, 0, 0, 7); g.fill(); }
    g.fillStyle = '#2a1010'; g.fillRect(faceX(w, -0.12), 145, 8, 14); g.fillRect(faceX(w, 0.06), 145, 8, 14);
    g.fillStyle = '#4a0a10'; g.fillRect(faceX(w, -0.7), 172, faceX(w, 0.7) - faceX(w, -0.7), 40);
    g.fillStyle = '#f0e8d0'; for (const x of [-0.6, -0.3, 0.25, 0.55]) fillPoly(g, '#f0e8d0', [[faceX(w, x), 172], [faceX(w, x + 0.12), 172], [faceX(w, x + 0.06), 196]]);
    fillPoly(g, '#f0e8d0', [[faceX(w, -0.5), 212], [faceX(w, -0.38), 212], [faceX(w, -0.44), 192]]); fillPoly(g, '#f0e8d0', [[faceX(w, 0.38), 212], [faceX(w, 0.5), 212], [faceX(w, 0.44), 192]]);
  });
  const torso = sheet(512, 512, '#7a9a62', (g, w, h) => {
    g.strokeStyle = '#4a6a3e'; g.lineWidth = 12; for (const y of [0.2, 0.33, 0.46]) { g.beginPath(); g.moveTo(w * 0.2, h * y); g.quadraticCurveTo(w * 0.5, h * (y + 0.08), w * 0.8, h * y); g.stroke(); }
    fillPoly(g, '#4a3a2a', [[0, h * 0.78], [w, h * 0.74], [w, h], [w * 0.7, h * 0.9], [w * 0.45, h], [w * 0.2, h * 0.88], [0, h]]);
  });
  const { f, headY0, shY } = figure({ k: 0.046, skin: C.GREEN, legs: C.GREEN, boots: C.DGREEN, hips: 0x4a3a2a, torso, arms: C.GREEN, hands: C.DGREEN, face });
  const R = FIG.headR;
  for (const s of [-1, 1]) {
    f.add('head', new THREE.SphereGeometry(1.0, 12, 10), transGlow(0xff4a2a), [s * R * 0.42 * 0.95, headY0 + 4.9, R * 0.9]);
    f.add('head', new THREE.ConeGeometry(1.2, 4, 8), plastic(C.GREEN), [s * (R + 1.2), headY0 + 6, -0.5], [0, 0, -s * 1.1]);
  }
  // claws on the ring hands
  for (const [b, x] of [['handL', 1], ['handR', -1]] as const) for (let i = 0; i < 3; i++) f.add(b, new THREE.ConeGeometry(0.45, 2.4, 6), plastic(C.BLACK), [x * (FIG.shoulderX + 0.4 + i), shY - 13.6, FIG.handZ + 0.6], [Math.PI, 0, 0]);
  return f;
}

export const FIGS: ModelDef[] = [
  { id: 'fig_warrior', name: '嗜血狂战', group: '职业', role: '人仔版', line: '', kind: 'biped', attack: 'swing', build: warrior },
  { id: 'fig_lich', name: '枯骨巫妖', group: '首领', role: '人仔版', line: '', kind: 'robe', attack: 'cast', build: lich, hover: 0.35 },
  { id: 'fig_ghoul', name: '食尸鬼', group: '普通', role: '人仔版', line: '', kind: 'biped', attack: 'claw', build: ghoul },
];
export const figCast = (): Cast => ({ hero: () => new BattleActor(FIGS[0]), lich: () => new BattleActor(FIGS[1]), ghoul: () => new BattleActor(FIGS[2]) });
void headGeo; void taperBox; void printed;
