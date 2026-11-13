import type { Overlay } from './overlay';
import { worldToUi } from '../ui3d/layer';
import type { Vector3 } from 'three';
import { animP } from '../engine/clock';
import { ST_GLYPH } from './hud/plates';
import { statusIcon } from './hud/draw';
import type { StatusV2 } from '../../core/v2/types';

// 图标沿屏幕弧线落入状态行，结束后调用方才提交该状态。
export async function statusFlight(ov: Overlay, type: StatusV2, from: Vector3, to: () => { x: number; y: number }, k: number) {
  const p = ov.pane(25, true), S = ST_GLYPH[type], a = worldToUi(from);
  p.paint(type, 44, 44, (g, d) => statusIcon(g, 22, 22, 18, d, { glyph: S.g, col: S.col, arc: '#ff6a50', frac: 1, n: '' }));
  p.scale = k;
  try { await animP(0.32, t => { const b = to(); p.at(a.x + (b.x - a.x) * t - 22, a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 45 * k - 22); p.visible = true; }); }
  finally { ov.drop(p); }
}
