// Bestiary viewer (web page): every chapter-1 creature and the three classes, rendered with the game's own look (toon + ink + bloom,
// moonlit graveyard). Pick a model, orbit (drag), zoom (wheel / pinch), play its actions; or line everyone up to compare sizes.
import * as THREE from 'three';
import { scene, camera, view, V3, onUpdate } from '../engine/world';
import { shot } from '../director';
import { ROSTER, type ModelDef } from './models';
import { BActor } from './bactor';
import type { Env } from '../look/env';
import { toon } from '../look/toon';
import { GRADE } from '../look/post';

const STAGE = V3(0, 0, 2.2);
const css = `
.bv{position:fixed;inset:0;pointer-events:none;font:13px/1.45 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#efe6d4;-webkit-user-select:none;user-select:none}
.bv *{box-sizing:border-box}
.bv .pane{pointer-events:auto;background:rgba(18,14,28,.78);border:1px solid rgba(232,200,140,.22);border-radius:12px;backdrop-filter:blur(6px)}
.bv .info{position:absolute;left:max(12px,env(safe-area-inset-left,0px));top:calc(env(safe-area-inset-top,0px) + 12px);padding:10px 14px;max-width:min(420px,calc(100vw - 24px))}
.bv .info .t{font-size:11px;letter-spacing:.12em;color:#c8b48a}
.bv .info .n{font-size:22px;font-weight:700;margin:2px 0 2px;color:#fff3d6}
.bv .info .r{font-size:12px;color:#b8a8d8}
.bv .info .q{margin-top:6px;color:#d8cdb8;font-style:italic}
.bv .list{position:absolute;right:max(12px,env(safe-area-inset-right,0px));top:calc(env(safe-area-inset-top,0px) + 12px);bottom:84px;width:200px;overflow:auto;padding:8px}
.bv .grp{font-size:11px;letter-spacing:.12em;color:#c8b48a;margin:8px 6px 4px}
.bv .it{display:flex;justify-content:space-between;align-items:center;width:100%;padding:6px 9px;margin:2px 0;border:0;border-radius:8px;background:transparent;color:#efe6d4;font:inherit;text-align:left;cursor:pointer}
.bv .it:hover{background:rgba(255,230,170,.08)}
.bv .it.on{background:rgba(255,200,90,.2);color:#fff3d6}
.bv .it small{color:#9a8cb8;font-size:11px}
.bv .bar{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 14px);display:flex;gap:6px;padding:7px;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 24px)}
.bv .b{border:1px solid rgba(232,200,140,.3);background:rgba(255,240,210,.06);color:#efe6d4;font:600 13px system-ui,"PingFang SC","Microsoft YaHei",sans-serif;padding:7px 12px;border-radius:9px;cursor:pointer}
.bv .b:hover{background:rgba(255,240,210,.14)}
.bv .b.on{background:#d89a3a;border-color:#ffd08a;color:#1a1020}
.bv .hint{position:absolute;left:max(12px,env(safe-area-inset-left,0px));bottom:calc(env(safe-area-inset-bottom,0px) + 18px);color:rgba(239,230,212,.55);font-size:12px}
.bv .lab{position:absolute;transform:translate(-50%,-100%);padding:2px 7px;border-radius:7px;background:rgba(18,14,28,.72);border:1px solid rgba(232,200,140,.25);font-size:12px;white-space:nowrap;pointer-events:auto;cursor:pointer}
.bv .lab small{color:#c8b48a;margin-left:4px}
@media (max-width:720px){
 .bv .list{top:auto;right:0;left:0;bottom:calc(env(safe-area-inset-bottom,0px) + 94px);width:auto;height:auto;max-height:none;display:flex;overflow-x:auto;overflow-y:hidden;gap:4px;padding:6px max(10px,env(safe-area-inset-left,0px));border-radius:0;border-left:0;border-right:0}
 .bv .grp{display:none}
 .bv .it{flex:0 0 auto;width:auto;flex-direction:column;align-items:flex-start;padding:5px 9px}
 .bv .info{max-width:calc(100vw - 24px)}
 .bv .info .n{font-size:18px}
 .bv .hint{display:none}
 .bv .bar{bottom:calc(env(safe-area-inset-bottom,0px) + 8px);padding:5px;gap:4px}
 .bv .b{padding:6px 9px;font-size:12px}
}`;

export function bestiaryViewer(env: Env) {
  if (typeof document === 'undefined') return;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  GRADE.bloomThreshold = 1.05;   // pale stone and bone should not bloom in close-up; only the glowing cells do
  const ui = document.createElement('div'); ui.className = 'bv'; document.body.appendChild(ui);
  ui.innerHTML = `<div class="pane info"><div class="t">第一章 · 幽暗森林 · 模型预览</div><div class="n"></div><div class="r"></div><div class="q"></div></div>
    <div class="pane list"></div>
    <div class="pane bar">
      <button class="b" data-a="attack">攻击</button><button class="b" data-a="cast">施法</button><button class="b" data-a="hurt">受击</button><button class="b" data-a="roar">怒吼</button>
      <button class="b" data-t="auto">自动演示</button><button class="b" data-t="spin">转台</button><button class="b" data-t="line">全员列队</button>
    </div><div class="hint">拖动旋转 · 滚轮缩放 · 双指缩放</div>`;
  const $ = (s: string) => ui.querySelector(s) as HTMLElement;
  const list = $('.list');

  // a plain dark stone stage for the line-up (the graveyard props would crowd it)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(15, 15.4, 0.2, 48), toon(0x34303e)); disc.position.set(0, -0.1, 0.5); disc.receiveShadow = true; disc.visible = false; scene.add(disc);

  const actors = new Map<string, BActor>();
  const get = (d: ModelDef) => { let a = actors.get(d.id); if (!a) { a = new BActor(d); a.root.visible = false; actors.set(d.id, a); } return a; };
  let cur: BActor | null = null, lineup = false, auto = false, spin = false, autoT = 0, autoI = 0;
  const orbit = { yaw: 0.35, pitch: 0.18, dist: 6, target: V3() };
  const labels = new Map<string, HTMLElement>();

  // list
  let lastG = '';
  for (const d of ROSTER) {
    if (d.group !== lastG) { lastG = d.group; const g = document.createElement('div'); g.className = 'grp'; g.textContent = d.group === '职业' ? '职业' : d.group === '普通' ? '普通敌人' : d.group === '精英' ? '精英' : '首领'; list.appendChild(g); }
    const b = document.createElement('button'); b.className = 'it'; b.dataset.id = d.id; b.innerHTML = `<span>${d.name}</span><small>${d.group}</small>`;
    b.onclick = () => select(d.id); list.appendChild(b);
  }

  function frameFor(a: BActor) {
    const h = a.top, w = Math.max(1.2, a.width * 0.8);
    orbit.dist = Math.max(3.4, Math.max(h, w) * 1.75 + 1.2) * (view.w / Math.max(1, view.h) < 0.8 ? 1.45 : 1); orbit.target.set(STAGE.x, h * 0.48 + (a.def.hover ?? 0), STAGE.z); orbit.pitch = h > 3.5 ? 0.2 : 0.16;
  }
  function select(id: string) {
    const d = ROSTER.find(x => x.id === id)!;
    if (lineup) setLineup(false);
    for (const a of actors.values()) a.root.visible = false;
    cur = get(d); cur.root.visible = true; cur.place(STAGE.clone(), 0); cur.act = null;
    frameFor(cur); orbit.yaw = 0.35;
    $('.n').textContent = d.name; $('.r').textContent = `${d.group} · ${d.role} · 高约 ${cur.top.toFixed(1)} 米`; $('.q').textContent = `「${d.line}」`;
    list.querySelectorAll('.it').forEach(e => e.classList.toggle('on', (e as HTMLElement).dataset.id === id));
    (list.querySelector(`[data-id="${id}"]`) as HTMLElement)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    try { history.replaceState(null, '', '#bestiary'); } catch { /* ignore */ }
  }
  function setLineup(on: boolean) {
    lineup = on; $('[data-t="line"]').classList.toggle('on', on); env.root.visible = !on; disc.visible = on;
    for (const l of labels.values()) l.remove(); labels.clear();
    if (!on) { if (cur) select(cur.def.id); return; }
    // rows from the front: classes + elites, normals (two rows), bosses at the back
    const rows: Array<[ModelDef[], number, number]> = [
      [ROSTER.filter(d => d.group === '职业' || d.group === '精英'), 7.5, 2.6],
      [ROSTER.filter(d => d.group === '普通').slice(0, 5), 3.5, 3.4],
      [ROSTER.filter(d => d.group === '普通').slice(5), -0.5, 3.4],
      [ROSTER.filter(d => d.group === '首领'), -6.5, 5.6],
    ];
    for (const [ds, z, gap] of rows) ds.forEach((d, i) => {
      const a = get(d); a.root.visible = true; a.act = null; a.place(V3((i - (ds.length - 1) / 2) * gap, 0, z), 0);
      const l = document.createElement('div'); l.className = 'lab'; l.innerHTML = `${d.name}<small>${d.group}</small>`; l.onclick = () => select(d.id); ui.appendChild(l); labels.set(d.id, l);
    });
    orbit.target.set(view.w > 720 ? 1.6 : 0, 1.2, 0.5); orbit.dist = view.w > 720 ? 29 : 38; orbit.pitch = 0.45; orbit.yaw = 0;
    $('.n').textContent = '全员列队'; $('.r').textContent = `3 个职业 · 10 普通 · 3 精英 · 4 首领，同一块大小（8 厘米）`; $('.q').textContent = '点名字查看单个模型';
  }
  function act(k: string) {
    const targets = lineup ? [...actors.values()].filter(a => a.root.visible) : cur ? [cur] : [];
    for (const a of targets) { if (k === 'attack') a.attack(); else if (k === 'cast') a.cast(); else if (k === 'hurt') a.hurt(1); else if (k === 'roar') a.roar(); }
  }
  ui.querySelectorAll('[data-a]').forEach(b => ((b as HTMLElement).onclick = () => act((b as HTMLElement).dataset.a!)));
  $('[data-t="auto"]').onclick = () => { auto = !auto; $('[data-t="auto"]').classList.toggle('on', auto); autoT = 0; };
  $('[data-t="spin"]').onclick = () => { spin = !spin; $('[data-t="spin"]').classList.toggle('on', spin); };
  $('[data-t="line"]').onclick = () => setLineup(!lineup);

  // orbit input on the canvas
  const cv = document.querySelector('canvas') as HTMLCanvasElement;
  const pts = new Map<number, { x: number; y: number }>(); let pinch = 0;
  cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', e => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.setPointerCapture(e.pointerId); if (pts.size === 2) { const [p, q] = [...pts.values()]; pinch = Math.hypot(p.x - q.x, p.y - q.y); } });
  cv.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 1) { orbit.yaw -= (e.clientX - p.x) * 0.008; orbit.pitch = Math.max(-0.1, Math.min(1.2, orbit.pitch + (e.clientY - p.y) * 0.006)); }
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch > 0) orbit.dist = Math.max(2, Math.min(40, orbit.dist * (pinch / d))); pinch = d; }
  });
  const up = (e: PointerEvent) => { pts.delete(e.pointerId); pinch = 0; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); orbit.dist = Math.max(2, Math.min(40, orbit.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });

  shot('viewer', () => ({ base: V3(orbit.target.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist, orbit.target.y + Math.sin(orbit.pitch) * orbit.dist, orbit.target.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist), look: orbit.target.clone(), fov: 36 }), { speed: 14, cut: true });

  onUpdate((dt, rdt) => {
    for (const a of actors.values()) if (a.root.visible) a.update(dt);
    if (spin) orbit.yaw += rdt * 0.35;
    if (auto) { autoT -= rdt; if (autoT <= 0) { act(['attack', 'cast', 'hurt', 'roar'][autoI++ % 4]); autoT = 2.4; } }
    if (lineup) for (const [id, l] of labels) { const a = actors.get(id)!; const p = a.root.position.clone().add(V3(0, a.top + 0.25, 0)).project(camera); l.style.left = `${((p.x + 1) / 2) * view.w}px`; l.style.top = `${((1 - p.y) / 2) * view.h}px`; l.style.display = p.z < 1 ? '' : 'none'; }
  });
  select(ROSTER[0].id);
  return { select, setLineup, actors, act, orbit };
}
