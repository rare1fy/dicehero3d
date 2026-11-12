// Platform layer: pxui's platform (browser / WeChat / Douyin, picked at runtime) plus the few extras the game needs.
// Game code never touches window/document directly; anything platform-specific goes through here.
import { createPlatform, type PxPlatform } from 'pxui/platform/index.js';

/** The global object: GameGlobal in mini-games, globalThis elsewhere (also the worker sandbox). */
export const G: any = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;

export type VibeLevel = 'light' | 'medium' | 'heavy';

export interface Platform extends PxPlatform {
  /** Short haptic pulse for heavy hits / crits. No-op where unsupported. */
  vibrate(level: VibeLevel): void;
}

export function initPlatform(): Platform {
  const p = createPlatform() as Platform;
  const mini = p.name === 'wx' ? wx : p.name === 'tt' ? tt : null;
  p.vibrate = (level: VibeLevel) => {
    try {
      if (mini && mini.vibrateShort) { mini.vibrateShort({ type: level }); return; }
      const nav: any = G.navigator;
      if (nav && typeof nav.vibrate === 'function') nav.vibrate(level === 'heavy' ? 40 : level === 'medium' ? 22 : 10);
    } catch { /* haptics are best-effort */ }
  };
  return p;
}
