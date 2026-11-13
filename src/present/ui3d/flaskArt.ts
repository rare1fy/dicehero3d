// R6 心形血瓶的像素美术（UX_V3 §5b / §6b）：一颗「挤出的像素画」心形玻璃瓶。每个体素 = 1 美术像素：心形 32×28 格，轮廓只走横竖和
// 正 45°（两个切角八边形的瓣 + 1:1 台阶的 V 形瓶底），厚 12 格（≥ 宽的 35%）。正面三级台阶：最外圈 1 格深色描边（低 2 格）、1 格玻璃
// 边（低 1 格）、内部瓶身。瓶身颜色由着色器按「格」逐行决定：液面以下是血（平涂 2～4 档：液面 1 行亮红、右下 2 格暗边、DoT 预扣那截
// 更暗并慢闪、刚掉的血留一截浅色残影），液面以上是深色玻璃（左上内沿亮一档）；侧面同一套色往暗走两档（血的侧面也看得到血）。玻璃
// 高光是 1～2 格的白块，残血裂纹是横竖折线。液面晃动按列取整成台阶，静止时是一条平直的像素线。瓶颈、金箍、木塞是另一个挤出件。
import * as THREE from 'three';
import { buildPix, pixFlat, type PCell } from './pixMesh';
import { uiCol, ramp, mixHex } from './pixelGrid';

/** 心形宽高（格）、心形上方瓶颈 + 木塞的行数、总高、厚度 */
export const HW = 32, HH = 28, NECK = 9, FH = HH + NECK, DEPTH = 12;
/** 模型坐标：x 列 → X、行（心形第 0 行在最上，瓶塞是负行）→ Y；模型中心 = 整个外框的中心 */
const X = (x: number) => x - HW / 2, Y = (r: number) => (HH - NECK) / 2 - r;

export function inHeart(x: number, y: number) {
  if (y < 0 || y >= HH || x < 0 || x >= HW) return false;
  if (y < 5) return (x >= 5 - y && x < 11 + y) || (x >= 21 - y && x < 27 + y);   // two chamfered lobes
  if (y <= 12) return true;
  const k = y - 12; return x >= k && x < HW - k;                                   // the 1:1 V to the tip
}
/** 4 邻接到外面的距离（外面 = 0，最外圈 = 1） */
const DIST: number[] = (() => {
  const D = new Array(HW * HH).fill(0), q: number[] = [];
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) {
    if (!inHeart(x, y)) continue;
    if (!inHeart(x - 1, y) || !inHeart(x + 1, y) || !inHeart(x, y - 1) || !inHeart(x, y + 1)) { D[y * HW + x] = 1; q.push(y * HW + x); } else D[y * HW + x] = 99;
  }
  for (let i = 0; i < q.length; i++) {
    const c = q[i], x = c % HW, y = (c - x) / HW;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (!inHeart(xx, yy)) continue; const j = yy * HW + xx; if (D[j] > D[c] + 1) { D[j] = D[c] + 1; q.push(j); } }
  }
  return D;
})();
export const hdist = (x: number, y: number) => (inHeart(x, y) ? DIST[y * HW + x] : 0);
/** 0 描边、1 玻璃边、2 瓶身 */
const kindOf = (x: number, y: number) => { const d = hdist(x, y); return d <= 1 ? 0 : d === 2 ? 1 : 2; };
const HGT = [DEPTH - 2, DEPTH - 1, DEPTH];
const hAt = (x: number, y: number) => (inHeart(x, y) ? HGT[kindOf(x, y)] : 0);

// glass highlights (1～2 格的白块): a 2-wide streak and a 2×2 block on the left lobe (touching only at a 45° corner), a 2×1 on the right
const HL = new Set(['4,5', '5,5', '4,6', '5,6', '4,7', '5,7', '4,8', '5,8', '6,3', '7,3', '6,4', '7,4', '25,3', '26,3']);
// low-HP cracks: orthogonal zig-zags, two stages
const CRACKS: Array<Array<[number, number]>> = [
  [[10, 9], [10, 12], [13, 12], [13, 15], [15, 15]], [[24, 7], [24, 10], [21, 10], [21, 13]],
  [[6, 13], [10, 13], [10, 16], [13, 16], [13, 19]], [[19, 18], [23, 18], [23, 15]],
];
const CRACK = new Map<string, number>();
CRACKS.forEach((p, i) => { for (let j = 1; j < p.length; j++) { const [x0, y0] = p[j - 1], [x1, y1] = p[j]; for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) if (kindOf(x, y) === 2) CRACK.set(x + ',' + y, i < 2 ? 1 : 2); } });

const VS = `attribute vec4 aI; attribute vec4 aF; varying vec4 vI; varying vec4 vF;
void main(){ vI = aI; vF = aF; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = `uniform vec3 uB[5]; uniform vec3 uG[5]; uniform vec3 uP[5]; uniform vec3 uInk; uniform vec3 uHl; uniform vec3 uCrk;
uniform float uSurf, uGhost, uCut, uAmp, uTime, uCrack, uPulse, uDim; varying vec4 vI; varying vec4 vF;
vec3 tone(vec3 r[5], float t){ return t < 0.5 ? r[0] : t < 1.5 ? r[1] : t < 2.5 ? r[2] : t < 3.5 ? r[3] : r[4]; }
void main(){
  float col = floor(vI.x + 0.5), row = floor(vI.y + 0.5), dir = floor(vI.z + 0.5), kind = floor(vI.w + 0.5), fl = floor(vF.x + 0.5);
  float w = uAmp * (sin(col * 0.8 + uTime * 7.0) + 0.5 * sin(col * 1.9 - uTime * 5.0));
  float s = floor(uSurf + w + 0.5), g = floor(uGhost + 0.5 * w + 0.5), c = floor(uCut + w + 0.5);
  bool liq = row >= s, gh = !liq && row >= g, cut = liq && row < c;
  float t = 1.0;
  if (dir < 0.5) {
    if (kind < 0.5) { gl_FragColor = vec4(uInk * uDim, 1.0); return; }
    float ck = floor(vF.y + 0.5); if (ck > 0.5 && ck <= uCrack) { gl_FragColor = vec4(uCrk * uDim, 1.0); return; }
    if (fl == 1.0) { gl_FragColor = vec4(uHl * uDim, 1.0); return; }
    bool lit = vF.z > 0.5;
    if (liq) {
      if (cut) t = row == s ? 2.0 : 3.0;
      else if (row == s) t = 0.0;
      else if (kind < 1.5) t = lit ? 1.0 : 2.0;
      else t = fl == 2.0 ? 2.0 : 1.0;
    } else if (gh) t = kind < 1.5 ? 2.0 : 1.0;
    else if (kind < 1.5) t = lit ? 0.0 : 1.0;
    else t = fl == 3.0 ? 1.0 : 2.0;
  } else t = dir < 2.5 ? 3.0 : dir < 3.5 ? 2.0 : 4.0;   // sides: left / right two tones down, top one, bottom three
  vec3 o = liq ? tone(uB, t) : gh ? tone(uP, t) : tone(uG, t);
  if (cut && dir < 0.5) o = mix(o, tone(uB, t - 1.0), uPulse);
  gl_FragColor = vec4(o * uDim, 1.0);
}`;

/** 色板（设计色 sRGB）：血、玻璃、残影 */
export const BLOOD = [0xff6a58, 0xc81e2a, 0x92121e, 0x640a16, 0x3c060e];
export const GLASS = [0x7a8cc0, 0x3a4670, 0x283152, 0x1b213a, 0x121628];
export const GHOST = [0xffe0d6, 0xffb4a4, 0xe08676, 0xb05e54, 0x7c3c36];

export interface HeartMesh { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; u: Record<string, THREE.IUniform> }

/** 心形瓶身（正面在 z = 0，背面 z = −DEPTH） */
export function buildHeart(): HeartMesh {
  const P: number[] = [], AI: number[] = [], AF: number[] = [], I: number[] = [];
  const quad = (info: number[], fl: number[], a: number[], b: number[], c: number[], d: number[]) => {
    const base = P.length / 3; P.push(...a, ...b, ...c, ...d); for (let i = 0; i < 4; i++) { AI.push(...info); AF.push(...fl); } I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) {
    if (!inHeart(x, y)) continue;
    const k = kindOf(x, y), h = HGT[k] - DEPTH, key = x + ',' + y;
    const flag = HL.has(key) ? 1 : k === 2 && hdist(x + 1, y + 1) < 3 ? 2 : k === 2 && hdist(x - 1, y - 1) < 3 ? 3 : 0;
    const lit = k === 1 ? (hdist(x - 1, y) === 1 || hdist(x, y - 1) === 1 ? 1 : 0) : 0;
    const fl = [flag, CRACK.get(key) ?? 0, lit, 0];
    const x0 = X(x), x1 = X(x + 1), yT = Y(y), yB = Y(y + 1);
    quad([x, y, 0, k], fl, [x0, yB, h], [x1, yB, h], [x1, yT, h], [x0, yT, h]);
    const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (let dir = 0; dir < 4; dir++) {
      const nh = hAt(nb[dir][0], nb[dir][1]) - DEPTH, z0 = inHeart(nb[dir][0], nb[dir][1]) ? nh : -DEPTH, z1 = h; if (z1 <= z0) continue;
      const info = [x, y, dir + 1, k];
      if (dir === 0) quad(info, fl, [x0, yB, z0], [x0, yB, z1], [x0, yT, z1], [x0, yT, z0]);
      else if (dir === 1) quad(info, fl, [x1, yB, z0], [x1, yT, z0], [x1, yT, z1], [x1, yB, z1]);
      else if (dir === 2) quad(info, fl, [x0, yT, z0], [x0, yT, z1], [x1, yT, z1], [x1, yT, z0]);
      else quad(info, fl, [x0, yB, z0], [x1, yB, z0], [x1, yB, z1], [x0, yB, z1]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('aI', new THREE.Float32BufferAttribute(AI, 4)); geo.setAttribute('aF', new THREE.Float32BufferAttribute(AF, 4));
  geo.setIndex(I); geo.computeBoundingSphere();
  const cols = (a: number[]) => a.map(c => uiCol(c));
  const u: Record<string, THREE.IUniform> = {
    uB: { value: cols(BLOOD) }, uG: { value: cols(GLASS) }, uP: { value: cols(GHOST) }, uInk: { value: uiCol(0x140a12) }, uHl: { value: uiCol(0xf4f8ff) }, uCrk: { value: uiCol(0xd8e6ff) },
    uSurf: { value: 2 }, uGhost: { value: 2 }, uCut: { value: -99 }, uAmp: { value: 0 }, uTime: { value: 0 }, uCrack: { value: 0 }, uPulse: { value: 0 }, uDim: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: u });
  return { mesh: new THREE.Mesh(geo, mat), mat, u };
}
/** HP 比例 → 液面所在行（该行及以下是血）；f = 0 时在瓶外 */
export const levelRow = (f: number) => HH - f * (HH - 2);

/** 瓶颈（玻璃）+ 金箍 + 木塞：同一套格子，正面比瓶身缩进 3 格 */
export function buildNeck() {
  const R0 = -NECK, rows = NECK + 5;   // rows −9 … 4 (the neck runs down into the lobes' dip)
  const G = 0, GOLD = 1, CORK = 2;
  const at = (x: number, yy: number): PCell | null => {
    const r = yy + R0; if (inHeart(x, r)) return null;
    if (r === -9) return x >= 14 && x < 18 ? { g: CORK, t: 0, h: DEPTH - 3, b: 3 } : null;
    if (r <= -6) return x >= 13 && x < 19 ? { g: CORK, t: x === 13 ? 0 : x === 18 ? 2 : r === -6 ? 2 : 1, h: DEPTH - 3, b: 3 } : null;
    if (r <= -4) return x >= 12 && x < 20 ? { g: GOLD, t: r === -5 ? 0 : x === 19 ? 2 : 1, h: DEPTH - 2, b: 2 } : null;
    return x >= 13 && x < 19 ? { g: G, t: x === 13 ? 1 : x === 14 ? 2 : x === 18 ? 4 : 3, h: DEPTH - 3, b: 3 } : null;
  };
  const m = buildPix(HW, rows, at, [GLASS, ramp(0xb08838, { hi: 0xf0d080, dark: 0x2a1404 }), ramp(0x8a5a34, { hi: 0xc08a58, dark: 0x1e0e06 })]);
  // buildPix centres on its own grid: shift so its rows line up with the heart's (row r at Y(r))
  m.position.set(0, Y(R0) - rows / 2, -DEPTH);
  return m;
}

/** 屏障：心形外扩的 3 圈阶梯光（加色平面） */
export function buildDome() {
  const pad = 5, W = HW + pad * 2, H = FH + pad * 2;
  const solid = (x: number, y: number) => { const hx = x - pad, r = y - pad - NECK; return inHeart(hx, r) || (r >= -NECK && r < 5 && hx >= 12 && hx < 20 && !inHeart(hx, r)); };
  const D = new Array(W * H).fill(99), q: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (solid(x, y)) { D[y * W + x] = 0; q.push(y * W + x); }
  for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = (c - x) / W; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (D[j] > D[c] + 1) { D[j] = D[c] + 1; q.push(j); } } }
  const lv = [0, 0, 1, 0.55, 0.25];
  const m = pixFlat(W, H, (x, y) => { const d = D[y * W + x]; return d >= 2 && d <= 4 ? lv[d] : null; });
  m.position.set(0, Y(-NECK - pad) - H / 2, 0.5);
  return m;
}

/** 护甲：挂在瓶右下的像素铁盾（10×12 格，厚 4 格，外圈低 1 格） */
export function buildShield() {
  const rows = ['.########.', '#oooooooo#', '#oowwwwoo#', '#oowwwwoo#', '#ooowwooo#', '#ooowwooo#', '.#oowwoo#.', '.#oowwoo#.', '..#oooo#..', '..#oooo#..', '...#oo#...', '....##....'];
  const steel = ramp(0x8a92a4, { hi: 0xd8deea, dark: 0x10121a }), map: Record<string, [number, number]> = { '#': [0, 3], o: [0, 1], w: [0, 0] };
  return buildPix(10, rows.length, (x, y) => { const ch = rows[y][x]; if (ch === '.') return null; const [g, t] = map[ch]; return { g, t, h: ch === '#' ? 3 : 4 }; }, [steel]);
}
export const shieldTint = (k: number) => mixHex(0x8a92a4, 0xffffff, k);
