// R6 「挤出的像素画」（UX_V3 §5b / §6b）：把一张美术像素格（每格：色组、色阶、正面高度）挤成 3D 体素浮雕。每格 = 1 美术像素，
// 正面平涂（不受光照，像素画的 2～4 档明暗原样显示），侧面按朝向自动往暗走（上侧 +1 档、左右 +2 档、下侧 +3 档 =「侧面比正面暗
// 两档」），台阶之间露出 1 格高的小侧面 = 倒角台阶。同色同高的格子按行合并，顶点少。颜色按色组调色板实时可换（金边 / 铁边 /
// 血红…），乘色做暗化和发光（> 1 进 UI 泛光）。另有平面版 pixFlat：阶梯发光圈、接触投影这类不需要厚度的层。
import * as THREE from 'three';
import { uiCol } from './pixelGrid';

/** 一格：g 色组、t 色阶（0 高光 / 1 本色 / 2..4 往暗）、h 正面高度（格）、b 底（默认 0） */
export interface PCell { g: number; t: number; h: number; b?: number }
/** 侧面配色覆盖：返回该段侧面用的色组、色阶（不返回 = 默认规则） */
export type SideFn = (c: PCell, x: number, y: number, dir: number, z0: number, z1: number) => { g: number; t: number } | null | undefined;

const SIDE_SHIFT = [2, 2, 1, 3];   // dir: 0 −x(左) 1 +x(右) 2 上（屏幕上方） 3 下

export interface PixGroup { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; tones: Uint8Array; pal: number[]; glow: number }

export class PixModel extends THREE.Group {
  groups: PixGroup[] = [];
  constructor(public W: number, public H: number, public D: number) { super(); }
  /** 换某个色组的调色板（sRGB 十六进制，[高光, 本色, 暗1, 暗2, 暗3]）；glow > 1 发光 */
  setPal(gi: number, pal: number[], glow = 1) {
    const G = this.groups[gi]; if (!G) return;
    if (G.glow === glow && G.pal.length === pal.length && G.pal.every((c, i) => c === pal[i])) return;
    G.pal = pal.slice(); G.glow = glow;
    const attr = G.mesh.geometry.getAttribute('color') as THREE.BufferAttribute, arr = attr.array as Float32Array, cols = pal.map(c => uiCol(c, glow));
    for (let i = 0; i < G.tones.length; i++) { const c = cols[Math.min(cols.length - 1, G.tones[i])]; arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    attr.needsUpdate = true;
  }
  /** 整组乘色（暗化 < 1、发光 > 1） */
  tint(gi: number, k: number) { const G = this.groups[gi]; if (G) G.mat.color.setScalar(k); }
  tintAll(k: number) { for (const G of this.groups) G.mat.color.setScalar(k); }
  dispose() { for (const G of this.groups) { G.mesh.geometry.dispose(); G.mat.dispose(); } }
}

/**
 * 挤出一张 W×H 的像素画。at(x, y)：x 向右、y 向下（第 0 行在最上）。模型中心在正面中心的 (0, 0)，z 从 0（底）到 h（正面），
 * 1 格 = 1 单位；调用方再按「1 格 = 1 美术像素」缩放。pals[g] = 每个色组的初始调色板。
 */
export function buildPix(W: number, H: number, at: (x: number, y: number) => PCell | null, pals: number[][], o: { side?: SideFn; bands?: number[]; transparent?: boolean } = {}) {
  const D = (() => { let m = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = at(x, y); if (c) m = Math.max(m, c.h); } return m; })();
  const M = new PixModel(W, H, D), n = pals.length;
  const P: number[][] = Array.from({ length: n }, () => []), T: number[][] = Array.from({ length: n }, () => []), I: number[][] = Array.from({ length: n }, () => []);
  const grid: (PCell | null)[] = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) grid.push(at(x, y));
  const cell = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? null : grid[y * W + x]);
  const X = (x: number) => x - W / 2, Y = (y: number) => H / 2 - y;
  const quad = (g: number, t: number, a: number[], b: number[], c: number[], d: number[]) => {   // a b c d counter-clockwise seen from outside
    const p = P[g], base = p.length / 3; p.push(...a, ...b, ...c, ...d); T[g].push(t, t, t, t); I[g].push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  // fronts: runs along x with the same group / tone / height
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const c = cell(x, y); if (!c) { x++; continue; }
      let e = x + 1; while (e < W) { const d = cell(e, y); if (!d || d.g !== c.g || d.t !== c.t || d.h !== c.h) break; e++; }
      quad(c.g, c.t, [X(x), Y(y + 1), c.h], [X(e), Y(y + 1), c.h], [X(e), Y(y), c.h], [X(x), Y(y), c.h]);
      x = e;
    }
  }
  // sides: wherever a neighbour is lower (or missing), split at the band heights
  const bands = (o.bands || []).slice().sort((a, b) => a - b);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = cell(x, y); if (!c) continue;
    const nb = [cell(x - 1, y), cell(x + 1, y), cell(x, y - 1), cell(x, y + 1)];
    for (let dir = 0; dir < 4; dir++) {
      const m = nb[dir], top = c.h, bot = Math.max(c.b ?? 0, m ? m.h : 0); if (top <= bot) continue;
      const cuts = [bot, ...bands.filter(z => z > bot && z < top), top];
      for (let i = 0; i < cuts.length - 1; i++) {
        const z0 = cuts[i], z1 = cuts[i + 1], ov = o.side?.(c, x, y, dir, z0, z1), g = ov ? ov.g : c.g;
        const t = ov ? ov.t : Math.min(4, Math.max(1, c.t) + SIDE_SHIFT[dir]);
        if (dir === 0) quad(g, t, [X(x), Y(y + 1), z0], [X(x), Y(y + 1), z1], [X(x), Y(y), z1], [X(x), Y(y), z0]);
        else if (dir === 1) quad(g, t, [X(x + 1), Y(y + 1), z0], [X(x + 1), Y(y), z0], [X(x + 1), Y(y), z1], [X(x + 1), Y(y + 1), z1]);
        else if (dir === 2) quad(g, t, [X(x), Y(y), z0], [X(x), Y(y), z1], [X(x + 1), Y(y), z1], [X(x + 1), Y(y), z0]);
        else quad(g, t, [X(x), Y(y + 1), z0], [X(x + 1), Y(y + 1), z0], [X(x + 1), Y(y + 1), z1], [X(x), Y(y + 1), z1]);
      }
    }
  }
  for (let g = 0; g < n; g++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P[g], 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(T[g].length * 3), 3));
    geo.setIndex(I[g]); geo.computeBoundingSphere();
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: !!o.transparent });
    const mesh = new THREE.Mesh(geo, mat); mesh.visible = P[g].length > 0; M.add(mesh);
    M.groups.push({ mesh, mat, tones: Uint8Array.from(T[g]), pal: [], glow: -1 });
    M.setPal(g, pals[g]);
  }
  return M;
}

/**
 * 平面像素层（无厚度）：at(x, y) 返回 0～1 的强度（null = 空）。additive = 叠加发光（阶梯光圈）；否则是半透明暗色（接触投影）。
 * 颜色 = mat.color × 强度。中心同 buildPix。
 */
export function pixFlat(W: number, H: number, at: (x: number, y: number) => number | null, o: { additive?: boolean; color?: THREE.ColorRepresentation; opacity?: number } = {}) {
  const P: number[] = [], C: number[] = [], I: number[] = [], X = (x: number) => x - W / 2, Y = (y: number) => H / 2 - y;
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const v = at(x, y); if (v == null || v <= 0) { x++; continue; }
      let e = x + 1; while (e < W && at(e, y) === v) e++;
      const b = P.length / 3; P.push(X(x), Y(y + 1), 0, X(e), Y(y + 1), 0, X(e), Y(y), 0, X(x), Y(y), 0);
      for (let i = 0; i < 4; i++) C.push(v, v, v); I.push(b, b + 1, b + 2, b, b + 2, b + 3); x = e;
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); geo.setIndex(I);
  const add = o.additive !== false;
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, color: o.color ?? 0xffffff, transparent: true, opacity: o.opacity ?? 1, depthWrite: false, toneMapped: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide });
  return new THREE.Mesh(geo, mat);
}
