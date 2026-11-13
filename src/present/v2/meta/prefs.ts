// Player settings (console-style options menu): stored on the device (localStorage in browsers, wx / tt storage in mini games),
// applied live. Every field has a safe default, so a missing or broken store never blocks the game.
import { PX, setPixel } from '../../look/pixel';
import { FX } from '../../engine/clock';
import { audio } from '../../../audio/audio';
import { VIBE } from '../../../platform';

export interface Prefs {
  /** scene art-pixel size: 1 = crisp voxels, 2 / 3 = chunky pixels (user: 「2x 还是太不清晰了在手机上，把这个参数后续放在设置里面」) */
  pixel: 1 | 2 | 3;
  /** screen shake: 0 off, 1 weak, 2 normal */
  shake: 0 | 1 | 2;
  /** 0..10 */
  master: number; music: number; sfx: number; voice: number;
  /** battle speed multiplier index: 1×, 1.5×, 2× */
  speed: 0 | 1 | 2;
  /** end the turn by itself when no legal play is left */
  autoEnd: boolean;
  /** first-time hints (tutorial) */
  tips: boolean;
  /** haptics on phones */
  vibrate: boolean;
}

const KEY = 'dh3d.prefs.v1';
export const SPEEDS = [1, 1.5, 2] as const;

function defaults(): Prefs {
  return { pixel: (PX.size as 1 | 2 | 3) || 1, shake: 2, master: 9, music: 7, sfx: 8, voice: 9, speed: 0, autoEnd: true, tips: true, vibrate: true };
}

/** tiny key-value store: wx / tt storage in mini games, localStorage in browsers, memory otherwise */
const mem = new Map<string, string>();
export const store = {
  get(k: string): string | null {
    try {
      const g = globalThis as any, mini = g.wx ?? g.tt;
      if (mini?.getStorageSync) { const v = mini.getStorageSync(k); return typeof v === 'string' && v ? v : null; }
      if (g.localStorage) return g.localStorage.getItem(k);
    } catch { /* blocked storage: fall back to memory */ }
    return mem.get(k) ?? null;
  },
  set(k: string, v: string) {
    mem.set(k, v);
    try {
      const g = globalThis as any, mini = g.wx ?? g.tt;
      if (mini?.setStorageSync) { mini.setStorageSync(k, v); return; }
      g.localStorage?.setItem(k, v);
    } catch { /* best effort */ }
  },
  del(k: string) {
    mem.delete(k);
    try { const g = globalThis as any, mini = g.wx ?? g.tt; if (mini?.removeStorageSync) { mini.removeStorageSync(k); return; } g.localStorage?.removeItem(k); } catch { /* best effort */ }
  },
};

export const PREFS: Prefs = defaults();
let loaded = false;
/** read once at boot (after the URL pixel flag, which stays a debug override for this page load) */
export function loadPrefs(urlPixelOverride = false) {
  if (loaded) return PREFS; loaded = true;
  const raw = store.get(KEY);
  if (raw) { try { Object.assign(PREFS, sanitize(JSON.parse(raw))); } catch { /* keep defaults */ } }
  if (urlPixelOverride) PREFS.pixel = (PX.size as 1 | 2 | 3) || PREFS.pixel;
  applyPrefs();
  return PREFS;
}
function sanitize(o: Partial<Prefs>): Partial<Prefs> {
  const out: Partial<Prefs> = {}, d = defaults();
  const int = (v: unknown, lo: number, hi: number, def: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : def);
  out.pixel = int(o.pixel, 1, 3, d.pixel) as 1 | 2 | 3; out.shake = int(o.shake, 0, 2, d.shake) as 0 | 1 | 2; out.speed = int(o.speed, 0, 2, d.speed) as 0 | 1 | 2;
  for (const k of ['master', 'music', 'sfx', 'voice'] as const) out[k] = int(o[k], 0, 10, d[k]);
  for (const k of ['autoEnd', 'tips', 'vibrate'] as const) out[k] = typeof o[k] === 'boolean' ? o[k] : d[k];
  return out;
}
export function savePrefs() { store.set(KEY, JSON.stringify(PREFS)); }
export function resetPrefs() { Object.assign(PREFS, defaults(), { pixel: PX.size }); applyPrefs(); savePrefs(); }

/** shake multiplier read by clock.shake() */
export const SHAKE_K = [0, 0.5, 1];
let audioApplied = false;
export function applyPrefs() {
  setPixel(true, PREFS.pixel);
  FX.speed = SPEEDS[PREFS.speed];
  FX.shakeScale = SHAKE_K[PREFS.shake]; VIBE.on = PREFS.vibrate;
  audioApplied = false; applyAudio();
}
function applyAudio() {
  if (!audio.ctx || !audio.master) return;
  const v = (n: number) => (n / 10) * (n / 10);   // perceptual-ish curve
  audio.master.gain.value = 0.9 * v(PREFS.master); audio.music.gain.value = 0.42 * v(PREFS.music);
  audio.sfx.gain.value = 0.8 * v(PREFS.sfx); audio.voice.gain.value = 1.0 * v(PREFS.voice);
  audioApplied = true;
}
/** call every frame: the audio graph only exists after the first tap, so volumes are applied as soon as it does */
export function tickPrefs() { if (!audioApplied) applyAudio(); }
