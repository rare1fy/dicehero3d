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
import { loadFishman } from './present/actors/fishman';
import './present/director';
import './audio/audio';

const TEST: { fixedTime?: number; preserve?: boolean } = G.__PXUI_TEST || {};
const platform = initPlatform();
const flags = readFlags(k => platform.query(k));
const canvas = platform.createCanvas();
const gfx = createGfx(platform, canvas, { preserve: !!TEST.preserve });
initParticles('soft'); initPrims();
const env = buildEnv();
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
  setShot: (name: string, base: number[], look: number[], fov: number) => { const m = SHOTS as Record<string, unknown>; m[name] = () => ({ base: new Vector3(...base), look: new Vector3(...look), fov }); show?.refreshShot(); },
});
dh.install();

const hash = typeof location !== 'undefined' ? location.hash.slice(1) : '';   // artifact links only pass a plain #name
loadFishman().catch(e => { platform.log('[boot] model load failed, using the stand-in hero: ' + ((e && e.stack) || e)); return null; }).then(model => {
  if (flags.view === 'actors' || hash === 'actors' || hash === 'fishman') {
    if (!model) throw new Error('fishman model failed to load');
    G.__actors = actorGallery(hash === 'fishman' ? 'hero' : platform.query('shot'), model);
    gfx.start(() => {}, () => { frames++; });
  } else {
    show = new BattleShow(platform, env, model, flags.seed ?? undefined);
    gfx.start(() => {}, () => { show!.relics.render(gfx.renderer); show!.hud.render(gfx.renderer); frames++; });
    show.start();
  }
  dh.ready();
}).catch(e => { platform.log('[boot] ' + ((e && e.stack) || e)); dh.fail(e); });
