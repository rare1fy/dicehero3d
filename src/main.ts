// Boot: platform → renderer + post → the graveyard arena → the battle show (actors, director, HUD, relic bar, audio).
import { initPlatform, G } from './platform/index';
import { readFlags } from './debug/flags';
import { dh } from './debug/dh';
import { createGfx } from './present/engine/gfx';
import { initParticles } from './present/engine/particles';
import { initPrims } from './present/engine/prims';
import { FX } from './present/engine/clock';
import { buildEnv } from './present/look/env';
import { BattleShow, SHOTS } from './present/show';
import { Vector3 } from 'three';
import { actorGallery } from './present/actors/gallery';
import { loadKK, kkCast } from './present/actors/kk';
import { proceduralCast } from './present/actors/cast';
import { setLook, LOOK } from './present/look/voxel';
import type { Env } from './present/look/env';
import './present/director';
import './audio/audio';

const TEST: { fixedTime?: number; preserve?: boolean } = G.__PXUI_TEST || {};
const platform = initPlatform();
const flags = readFlags(k => platform.query(k));
const canvas = platform.createCanvas();
const gfx = createGfx(platform, canvas, { preserve: !!TEST.preserve });
initParticles('soft'); initPrims();
let env: Env | null = null;
let show: BattleShow | null = null, frames = 0;

dh.add({
  info: () => ({ build: __BUILD__, dev: __DEV__, platform: platform.name, flags }),
  stats: () => ({ calls: gfx.stats.calls, tris: gfx.stats.tris, ms: Math.round(gfx.stats.ms * 10) / 10 }),
  frames: () => frames,
  battle: () => show?.b,
  show: () => show,
  bot: (on = true) => show?.bot(on),
  idle: () => !!show && show.idle(),
  select: (uids: number[]) => show?.selectUids(uids),
  act: (k: 'reroll' | 'play' | 'end') => show?.act(k),
  speed: (s: number) => { FX.speed = s; },
  last: () => '',
  /** tune a director shot live: __dh.setShot('battle', [x,y,z], [x,y,z], fov) */
  /** switch between the smooth KayKit look and its voxel twin: __dh.look(true) */
  look: (v: boolean) => setLook(v),
  setShot: (name: string, base: number[], look: number[], fov: number) => { const m = SHOTS as Record<string, unknown>; m[name] = () => ({ base: new Vector3(...base), look: new Vector3(...look), fov }); show?.refreshShot(); },
});
dh.install();

const hash = typeof location !== 'undefined' ? location.hash.slice(1) : '';   // artifact links only pass a plain #name
if (hash === 'voxel' || platform.query('look') === 'voxel') setLook(true);
loadKK().catch(e => { platform.log('[boot] model load failed, using the stand-in cast: ' + ((e && e.stack) || e)); return null; }).then(kk => {
  env = buildEnv(kk);
  const cast = kk ? kkCast(kk) : proceduralCast();
  if (kk) lookToggle();
  if (flags.view === 'actors' || hash === 'actors' || hash === 'hero') {
    G.__actors = actorGallery(hash === 'hero' ? 'hero' : platform.query('shot'), cast);
    gfx.start(() => {}, () => { frames++; });
  } else {
    show = new BattleShow(platform, env, cast, flags.seed ?? undefined);
    gfx.start(() => {}, () => { show!.relics.render(gfx.renderer); show!.hud.render(gfx.renderer); frames++; });
    show.start();
  }
  dh.ready();
}).catch(e => { platform.log('[boot] ' + ((e && e.stack) || e)); dh.fail(e); });

/** web only: a small switch between the KayKit look and its voxel twin (also the V key) */
function lookToggle() {
  if (typeof document === 'undefined' || !document.body) return;
  const b = document.createElement('button');
  const label = () => { b.textContent = LOOK.voxel ? '体素版  ⇄  原版' : '原版  ⇄  体素版'; };
  Object.assign(b.style, { position: 'fixed', right: 'max(10px, env(safe-area-inset-right, 0px))', top: 'calc(env(safe-area-inset-top, 0px) + 64px)', zIndex: '20', padding: '6px 10px', font: '600 12px system-ui, sans-serif', color: '#f4ecd8', background: 'rgba(24,20,36,0.72)', border: '1px solid rgba(232,210,160,0.45)', borderRadius: '14px', cursor: 'pointer', letterSpacing: '0.04em' });
  const flip = () => { setLook(!LOOK.voxel); label(); };
  b.addEventListener('pointerdown', e => { e.stopPropagation(); }); b.addEventListener('click', e => { e.stopPropagation(); flip(); });
  addEventListener('keydown', e => { if (e.key === 'v' || e.key === 'V') flip(); });
  label(); document.body.appendChild(b);
}
