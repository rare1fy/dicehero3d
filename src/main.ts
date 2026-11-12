// Boot: platform → three renderer → pxui (same WebGL context) → scene → loop. Runs unchanged in browsers and mini-games.
// Step-2 scaffold: a neutral placeholder scene proves the pipeline; the battle arrives with steps 3–4.
import * as THREE from 'three';
import { createUI } from 'pxui/core/pxui.js';
import font from '../ui/font.js';
import layout from '../ui/layout.json';
import { initPlatform, G } from './platform/index';
import { readFlags } from './debug/flags';
import { dh } from './debug/dh';

const TEST: { fixedTime?: number; preserve?: boolean } = G.__PXUI_TEST || {};
const platform = initPlatform();
const flags = readFlags(k => platform.query(k));
const canvas = platform.createCanvas();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!TEST.preserve });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const UI = createUI({ platform, gl: renderer.getContext(), three: renderer, font });

// ---- placeholder scene (neutral; replaced by the look packs in step 5)
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101218);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
camera.position.set(0, 9, 12); camera.lookAt(0, 0.6, 0);
scene.add(new THREE.HemisphereLight(0x9aa6c8, 0x1a120c, 1.2));
const sun = new THREE.DirectionalLight(0xffe2b8, 2.2); sun.position.set(4, 10, 5); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);
const die = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.5 }));
die.position.y = 1.2; scene.add(die);

function fit() {
  const s = platform.canvasSize();
  renderer.setPixelRatio(Math.min(platform.dpr(), 2));
  renderer.setSize(s.w, s.h, false);
  camera.aspect = s.w / s.h;
  camera.fov = camera.aspect < 0.7 ? 38 : 28;
  camera.updateProjectionMatrix();
}
fit(); platform.onResize(fit);

// ---- UI bindings (by node id only; the layout decides the look)
let lastAction = '';
const act = (name: string, msg: string) => () => { lastAction = name; UI.node('toast').flash(900, msg); platform.vibrate('light'); };
function bindUI() {
  UI.node('look_chip').set({ vars: { look: flags.look } });
  UI.node('b_reroll').on('tap', act('reroll', '重投'));
  UI.node('b_play').on('tap', act('play', '出牌'));
  UI.node('b_end').on('tap', act('end', '结束回合'));
}
UI.registerState('main', { label: '主界面', setup() { UI.only('hud', 'toast'); } });
UI.onPointer(ev => { if (ev.type === 'down') lastAction = 'scene'; });

// ---- debug handle
let frames = 0, lastStats: Record<string, unknown> = {};
dh.add({
  info: () => ({ build: __BUILD__, dev: __DEV__, platform: platform.name, flags }),
  stats: () => lastStats,
  last: () => lastAction,
  frames: () => frames,
});
dh.install();

// ---- loop
const t0 = platform.now();
function frame() {
  platform.raf(frame);
  const t = TEST.fixedTime != null ? TEST.fixedTime : (platform.now() - t0) / 1000;
  die.rotation.set(t * 0.7, t * 1.1, 0);
  renderer.render(scene, camera);
  const calls = renderer.info.render.calls, tris = renderer.info.render.triangles;
  const ui = UI.render();
  G.__pxuiStats = ui;
  lastStats = { calls, tris, ui };
  frames++;
}

UI.load(layout).then(() => {
  bindUI();
  if (!platform.query('state')) UI.setState('main');
  dh.ready();
  frame();
}).catch(e => { platform.log('[boot] ' + ((e && e.stack) || e)); dh.fail(e); });
