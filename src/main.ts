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
import { voxelCast } from './present/actors/voxcast';
import { bestiaryViewer } from './present/bestiary/viewer';
import { sceneViewer } from './present/scenes/viewer';
import { bestiaryCast } from './present/bestiary/battle';
import { legoCast } from './present/bestiary/lego';
import { initLegoEnv, legoEnvTex } from './present/look/legokit';
import { figCast, setFigEnv } from './present/bestiary/figs';
import { GRADE } from './present/look/post';
import { PX, PXU, readPixelFlag, installPixelKeys, setPixel } from './present/look/pixel';
import type { Env } from './present/look/env';
import './present/director';
import './audio/audio';

const TEST: { fixedTime?: number; preserve?: boolean } = G.__PXUI_TEST || {};
const platform = initPlatform();
const flags = readFlags(k => platform.query(k));
const canvas = platform.createCanvas();
// the 3D-pixel render style (look/pixel.ts): #px / #px3 / #bestiary&px or ?px / ?px=1|2|3; P toggles, [ ] pixel size
const hash = readPixelFlag(typeof location !== 'undefined' ? location.hash.slice(1) : '', k => platform.query(k));   // artifact links only pass a plain #name
const gfx = createGfx(platform, canvas, { preserve: !!TEST.preserve });
installPixelKeys();
initParticles('soft'); initPrims();
let env: Env | null = null;
let show: BattleShow | null = null, frames = 0;

dh.add({
  info: () => ({ build: __BUILD__, dev: __DEV__, platform: platform.name, flags }),
  stats: () => ({ calls: gfx.stats.calls, tris: gfx.stats.tris, ms: Math.round(gfx.stats.ms * 10) / 10, px: PX.on ? PX.size : 0 }),
  /** the pixel render style: __dh.px(true, 2) / __dh.px(false) */
  px: (on = true, size?: number) => setPixel(on, size),
  /** live tuning of the pixel look: __dh.pxLook.ink = 0.6 … (see look/pixel.ts PX) */
  pxLook: PX, pxU: PXU,
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
  setShot: (name: string, base: number[], look: number[], fov: number) => { const m = SHOTS as Record<string, unknown>; m[name] = () => ({ base: new Vector3(...base), look: new Vector3(...look), fov }); show?.refreshShot(); },
});
dh.install();

// the moonlit graveyard (procedural) + the original chunky-voxel cast. (The KayKit cast in actors/kk.ts is kept in the repo, not booted.)
Promise.resolve().then(() => {
  // the voxel graveyard + the bestiary cast (#classic: the smooth graveyard with the show-04 cast, for comparison)
  const entry0 = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_ENTRY;
  const classic = hash === 'classic', brick = hash === 'brick' || entry0 === 'brick', fig = hash === 'fig' || entry0 === 'fig';
  if (entry0 === 'scenes' || hash === 'scenes') {   // the scene browser builds its own stages (no default arena)
    G.__sv = sceneViewer();
    gfx.start(() => {}, () => { frames++; });
    dh.ready(); return;
  }
  if (brick || fig) { initLegoEnv(gfx.renderer); setFigEnv(legoEnvTex()); GRADE.bloomThreshold = 1.15; }   // white plastic should shine, not bloom
  // toy bricks belong in the smooth graveyard; the voxel cast in the voxel one
  env = buildEnv(null, { voxel: !classic && !brick && !fig });
  const cast = fig ? figCast() : brick ? legoCast() : classic ? voxelCast() : bestiaryCast();
  // the model viewer page: a separate build (VITE_ENTRY=bestiary) or #bestiary on the game build
  const entry = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_ENTRY;
  if (entry === 'bestiary' || hash === 'bestiary') {
    G.__bv = bestiaryViewer(env);
    gfx.start(() => {}, () => { frames++; });
  } else if (flags.view === 'actors' || hash === 'actors' || hash === 'hero') {
    G.__actors = actorGallery(hash === 'hero' ? 'hero' : platform.query('shot'), cast);
    gfx.start(() => {}, () => { frames++; });
  } else {
    show = new BattleShow(platform, env, cast, flags.seed ?? undefined);
    gfx.start(() => {}, () => { show!.hud.render(gfx.renderer); show!.relics.render(gfx.renderer); frames++; });
    show.start();
  }
  dh.ready();
}).catch(e => { platform.log('[boot] ' + ((e && e.stack) || e)); dh.fail(e); });
