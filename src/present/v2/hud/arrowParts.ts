// R6 瞄准箭头的像素件（UX_V3 §3 / §6b）：人字节（V 形，指向 +x）、箭头头部（➤ 形，带后凹口）、挂锁、头部的阶梯发光圈。
// 全是挤出的像素画：1 格 = 1 美术像素，正面 2～3 档平涂（上半亮、下半暗 = 光从上方来），外圈 1 格深色描边且低 1 格（倒角台阶），
// 侧面按朝向往暗走（描边的外墙：上侧暗一档、左右暗两档、下侧墨色）。只走横竖和正 45°（1:1 台阶）。
// 调色板统一五档：[高光, 本色, 暗一档, 暗两档, 墨色描边]，换状态（待机 / 悬停 / 被嘲讽挡住）只换调色板。
import * as THREE from 'three';
import { buildPix, pixFlat, type PixModel } from '../../ui3d/pixMesh';

const INK = 4;
export const ARROW_PAL = {
  idle: [0xffd068, 0xff9426, 0xe0661a, 0x9a3a0c, 0x240a04],
  hot: [0xfff2a8, 0xffb630, 0xff8020, 0xb84a0a, 0x2a0c02],
  blocked: [0xd6dae2, 0x9aa0ac, 0x787e8a, 0x4c505a, 0x121318],
};
/** 头部：待机同箭身；悬停转成炽红橙（和敌人的红圈呼应） */
export const HEAD_PAL = {
  idle: ARROW_PAL.idle,
  hot: [0xffe0a0, 0xff6a28, 0xe03c16, 0x8a1a08, 0x2a0402],
  blocked: ARROW_PAL.blocked,
};
export const LOCK_PAL = [0xf4f0e0, 0xc8c2b0, 0x948e80, 0x5e5a52, 0x141210];

/** 一张「色阶或空」的格子图（x 向右、y 向下） */
type Tones = (x: number, y: number) => number | null;

/** 把色阶图加 1 格墨色描边（4 邻接，45° 处自然是 1:1 台阶）挤成浮雕：本体高 D，描边高 D−1 */
function extrudeOutlined(W: number, H: number, core: Tones, D: number, pal: number[]): PixModel {
  const W2 = W + 2, H2 = H + 2, c = (x: number, y: number) => (x >= 1 && y >= 1 && x <= W && y <= H ? core(x - 1, y - 1) : null);
  return buildPix(W2, H2, (x, y) => {
    const t = c(x, y); if (t != null) return { g: 0, t, h: D };
    if (c(x - 1, y) != null || c(x + 1, y) != null || c(x, y - 1) != null || c(x, y + 1) != null) return { g: 0, t: INK, h: D - 1 };
    return null;
  }, [pal], { side: (cell, _x, _y, dir) => (cell.t === INK ? { g: 0, t: dir === 2 ? 2 : dir === 3 ? 4 : 3 } : null) });
}
/** 同一张色阶图（带描边）的占位遮罩，发光圈用 */
function outlinedMask(W: number, H: number, core: Tones) {
  const W2 = W + 2, H2 = H + 2, c = (x: number, y: number) => (x >= 1 && y >= 1 && x <= W && y <= H ? core(x - 1, y - 1) : null);
  return { W: W2, H: H2, on: (x: number, y: number) => c(x, y) != null || c(x - 1, y) != null || c(x + 1, y) != null || c(x, y - 1) != null || c(x, y + 1) != null };
}

// ---------------------------------------------------------------- 人字节
/** 人字节尺寸（格）：臂粗 T（沿 x）、半高 HH；加描边后 = (HH+T+2) × (2HH+3) */
export const CHEV = { T: 3, HH: 3, D: 3 };
export const chevW = () => CHEV.HH + CHEV.T + 2;
function chevTones(): { W: number; H: number; f: Tones } {
  const { T, HH } = CHEV, W = HH + T, H = 2 * HH + 1;
  // 节会沿曲线转到任意方向，所以明暗做成对称的：前沿（朝目标）高光、中间本色、后沿暗一档 = 「往前冲」的亮边
  return { W, H, f: (x, y) => { const a = x - HH + Math.abs(y - HH); return a < 0 || a > T - 1 ? null : a === T - 1 ? 0 : a === 0 ? 2 : 1; } };
}
/** V 形人字节，尖朝 +x；模型中心 = 格子中心 */
export function chevronPix(pal = ARROW_PAL.idle) { const c = chevTones(); return extrudeOutlined(c.W, c.H, c.f, CHEV.D, pal); }

// ---------------------------------------------------------------- 箭头头部
/** 头部：半高 R（尖到后角 45°）、后凹口深 N；加描边后 = (R+3) × (2R+3) */
export const HEAD = { R: 6, N: 2, D: 4 };
export const headW = () => HEAD.R + 3;
function headTones(): { W: number; H: number; f: Tones } {
  const { R, N } = HEAD, W = R + 1, H = 2 * R + 1;
  const core = (x: number, y: number) => { if (x < 0 || y < 0 || x >= W || y >= H) return false; const d = Math.abs(y - R); return x >= Math.max(0, N - d) && x <= R - d; };
  // 对称明暗（头部也随切线转）：两条前斜边 1 格高光、本体本色、后沿（凹口与倒钩）暗一档
  return { W, H, f: (x, y) => (!core(x, y) ? null : !core(x + 1, y) ? 0 : !core(x - 1, y) ? 2 : 1) };
}
export function headPix(pal = HEAD_PAL.idle) { const c = headTones(); return extrudeOutlined(c.W, c.H, c.f, HEAD.D, pal); }
/** 头部外的阶梯发光圈（3 圈，逐圈变暗；叠加混合）。中心与 headPix 相同 */
export function headGlow(rings = 3) {
  const c = headTones(), m = outlinedMask(c.W, c.H, c.f), W = m.W + rings * 2, H = m.H + rings * 2, lv = [1, 0.5, 0.22];
  // 4 邻接距离（菱形扩张 = 正 45° 台阶）
  const dist = new Int16Array(W * H).fill(-1), q: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m.on(x - rings, y - rings)) { dist[y * W + x] = 0; q.push(x, y); }
  for (let i = 0; i < q.length; i += 2) {
    const x = q[i], y = q[i + 1], d = dist[y * W + x]; if (d >= rings) continue;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) if (nx >= 0 && ny >= 0 && nx < W && ny < H && dist[ny * W + nx] < 0) { dist[ny * W + nx] = d + 1; q.push(nx, ny); }
  }
  return pixFlat(W, H, (x, y) => { const d = dist[y * W + x]; return d > 0 ? lv[d - 1] : null; });
}

// ---------------------------------------------------------------- 挂锁（被嘲讽保护的敌人）
const LOCK_ROWS = [
  '..ooooo..',
  '.oo...oo.',
  '.o.....o.',
  '.o.....o.',
  'hhhhhhhhh',
  'hbbbbbbbh',
  'bbbb.bbbb',
  'bbbb.bbbb',
  'ddddddddd',
];
const LOCK_T: Record<string, number> = { o: 1, h: 0, b: 1, d: 2 };
export function lockPix() {
  const W = LOCK_ROWS[0].length, H = LOCK_ROWS.length;
  return extrudeOutlined(W, H, (x, y) => { const ch = LOCK_ROWS[y][x]; return ch in LOCK_T ? LOCK_T[ch] : null; }, 3, LOCK_PAL);
}

/** 叠加发光平面的颜色（> 1 进泛光） */
export function setGlow(m: THREE.Mesh, hex: number, k: number) { (m.material as THREE.MeshBasicMaterial).color.setHex(hex).multiplyScalar(k); }
