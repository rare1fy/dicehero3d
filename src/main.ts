// Boot: platform → renderer + frame loop → pxui (same WebGL context) → battle set → battle controller. Same code in browsers and mini-games.
import { createUI } from 'pxui/core/pxui.js';
import font from '../ui/font.js';
import layout from '../ui/layout.json';
import { initPlatform, G } from './platform/index';
import { readFlags } from './debug/flags';
import { dh } from './debug/dh';
import { createGfx } from './present/engine/gfx';
import { initParticles } from './present/engine/particles';
import { initPrims } from './present/engine/prims';
import { FX } from './present/engine/clock';
import { buildSet } from './present/battle/stageSet';
import { BattleController } from './present/battle/controller';

const TEST: { fixedTime?: number; preserve?: boolean } = G.__PXUI_TEST || {};
const platform = initPlatform();
const flags = readFlags(k => platform.query(k));
const canvas = platform.createCanvas();
const gfx = createGfx(platform, canvas, { preserve: !!TEST.preserve });
const UI = createUI({ platform, gl: gfx.renderer.getContext(), three: gfx.renderer, font });

initParticles('pixel'); initPrims(); buildSet();
let ctl: BattleController | null = null;
let frames = 0;

dh.add({
  info: () => ({ build: __BUILD__, dev: __DEV__, platform: platform.name, flags }),
  stats: () => ({ calls: gfx.stats.calls, tris: gfx.stats.tris, ms: Math.round(gfx.stats.ms * 10) / 10, ui: G.__pxuiStats }),
  frames: () => frames,
  battle: () => ctl?.b,
  ctl: () => ctl,
  bot: (on = true) => ctl?.bot(on),
  idle: () => !!ctl && ctl.idle(),
  restart: (seed?: number) => ctl?.start(seed),
  select: (uids: number[]) => ctl?.selectUids(uids),
  act: (k: 'reroll' | 'play' | 'end') => ctl?.act(k),
  speed: (s: number) => { FX.speed = s; },
  last: () => '',
});
dh.install();

UI.registerState('battle', { label: '战斗', group: '战斗', setup() { UI.only('plates', 'hud', 'banner', 'toast'); } });

UI.load(layout).then(() => {
  UI.only('plates', 'hud', 'banner', 'toast');
  ctl = new BattleController(UI, platform, flags.seed ?? undefined);
  gfx.start(() => {}, () => { G.__pxuiStats = UI.render(); frames++; });
  ctl.start();
  dh.ready();
}).catch(e => { platform.log('[boot] ' + ((e && e.stack) || e)); dh.fail(e); });
