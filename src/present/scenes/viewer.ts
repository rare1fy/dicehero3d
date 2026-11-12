// Scene browser (web page): every chapter-1 scene with a hero and a few of its enemies standing where a battle would put them,
// seen from the landscape battle camera, or orbited freely.
import { V3, onUpdate } from '../engine/world';
import { shot } from '../director';
import { SCENES } from './defs';
import { showStage, type Stage } from './stage';
import { BActor } from '../bestiary/bactor';
import { ROSTER } from '../bestiary/models';
import { GRADE } from '../look/post';

/** the landscape battle framing (also used by the battle in landscape) */
export const BATTLE_CAM = { base: V3(0.3, 12.6, 14.6), look: V3(0, -0.2, -3.0), fov: 42 };

const css = `
.sv{position:fixed;inset:0;pointer-events:none;font:13px/1.45 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#efe6d4;-webkit-user-select:none;user-select:none}
.sv *{box-sizing:border-box}
.sv .pane{pointer-events:auto;background:rgba(14,12,22,.8);border:1px solid rgba(232,200,140,.22);border-radius:12px;backdrop-filter:blur(6px)}
.sv .info{position:absolute;left:max(12px,env(safe-area-inset-left,0px));top:calc(env(safe-area-inset-top,0px) + 12px);padding:10px 14px;max-width:min(440px,calc(100vw - 260px))}
.sv .info .t{font-size:11px;letter-spacing:.12em;color:#c8b48a}
.sv .info .n{font-size:21px;font-weight:700;margin:2px 0;color:#fff3d6}
.sv .info .r{font-size:12px;color:#b8a8d8}
.sv .info .q{margin-top:6px;color:#d8cdb8}
.sv .list{position:absolute;right:max(12px,env(safe-area-inset-right,0px));top:calc(env(safe-area-inset-top,0px) + 12px);bottom:70px;width:220px;overflow:auto;padding:8px}
.sv .grp{font-size:11px;letter-spacing:.12em;color:#c8b48a;margin:8px 6px 4px}
.sv .it{display:flex;justify-content:space-between;width:100%;padding:6px 9px;margin:2px 0;border:0;border-radius:8px;background:transparent;color:#efe6d4;font:inherit;text-align:left;cursor:pointer}
.sv .it:hover{background:rgba(255,230,170,.08)} .sv .it.on{background:rgba(255,200,90,.2);color:#fff3d6} .sv .it small{color:#9a8cb8;font-size:11px}
.sv .bar{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 14px);display:flex;gap:6px;padding:7px;flex-wrap:wrap;justify-content:center}
.sv .b{border:1px solid rgba(232,200,140,.3);background:rgba(255,240,210,.06);color:#efe6d4;font:600 13px system-ui,"PingFang SC","Microsoft YaHei",sans-serif;padding:7px 12px;border-radius:9px;cursor:pointer}
.sv .b:hover{background:rgba(255,240,210,.14)} .sv .b.on{background:#d89a3a;border-color:#ffd08a;color:#1a1020}
@media (max-width:720px){ .sv .list{top:auto;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 58px);width:auto;display:flex;overflow-x:auto;gap:4px;border-radius:0} .sv .grp{display:none} .sv .it{flex:0 0 auto;width:auto;flex-direction:column} .sv .info{max-width:calc(100vw - 24px)} }`;

export function sceneViewer() {
  if (typeof document === 'undefined') return;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const ui = document.createElement('div'); ui.className = 'sv'; document.body.appendChild(ui);
  ui.innerHTML = `<div class="pane info"><div class="t">第一章 · 幽暗森林 · 场景预览</div><div class="n"></div><div class="r"></div><div class="q"></div></div>
    <div class="pane list"></div>
    <div class="pane bar"><button class="b on" data-c="battle">战斗视角</button><button class="b" data-c="orbit">自由环视</button><button class="b" data-c="fight">让他们打一下</button></div>`;
  const $ = (s: string) => ui.querySelector(s) as HTMLElement, list = $('.list');
  let lastG = '';
  for (const d of SCENES) {
    if (d.group !== lastG) { lastG = d.group; const g = document.createElement('div'); g.className = 'grp'; g.textContent = d.group === '普通' ? '普通战斗（随机池）' : d.group === '首领' ? '首领（固定）' : '其他节点'; list.appendChild(g); }
    const b = document.createElement('button'); b.className = 'it'; b.dataset.id = d.id; b.innerHTML = `<span>${d.name}</span><small>${d.kind}</small>`; b.onclick = () => select(d.id); list.appendChild(b);
  }
  let stage: Stage | null = null, actors: BActor[] = [], mode: 'battle' | 'orbit' = 'battle';
  const orbit = { yaw: 0, pitch: 0.55, dist: 17, target: V3(0, 0.5, -2.4) };
  const byId = (id: string) => ROSTER.find(d => d.id === id)!;
  function select(id: string) {
    const d = SCENES.find(s => s.id === id)!;
    for (const a of actors) a.root.parent?.remove(a.root); actors = [];
    stage = showStage(d);
    // the hero front-left, enemies on their lanes (a boss on its mark at the back)
    const hero = new BActor(byId('warrior')); hero.place(V3(-2, 0, 3)); hero.faceToward(V3(0, 0, -3)); actors.push(hero);
    const foes = d.foes ?? [];
    foes.forEach((f, i) => {
      const a = new BActor(byId(f)), boss = byId(f).group === '首领';
      const p = boss ? V3(0, f === 'boss_lich_forest' ? 0.56 : 0, -4.7) : [V3(-2.6, 0, -2.4), V3(2.8, 0, -2.8), V3(0.4, 0, -4.6)][i];
      a.place(p); a.faceToward(V3(-2, 0, 3)); actors.push(a);
    });
    $('.n').textContent = d.name; $('.r').textContent = `${d.group === '普通' ? '普通战斗 · 随机池' : d.group === '首领' ? '首领 · 固定场景' : '其他节点'} · ${d.kind}`; $('.q').textContent = d.blurb;
    list.querySelectorAll('.it').forEach(e => e.classList.toggle('on', (e as HTMLElement).dataset.id === id));
    (list.querySelector(`[data-id="${id}"]`) as HTMLElement)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  const setMode = (m: 'battle' | 'orbit') => { mode = m; ui.querySelectorAll('[data-c]').forEach(e => e.classList.toggle('on', (e as HTMLElement).dataset.c === m)); };
  $('[data-c="battle"]').onclick = () => setMode('battle');
  $('[data-c="orbit"]').onclick = () => setMode('orbit');
  $('[data-c="fight"]').onclick = () => { actors.forEach((a, i) => { if (i === 0) a.attack(); else setTimeout(() => a.attack(), 500 + i * 300); }); };
  // orbit input
  const cv = document.querySelector('canvas') as HTMLCanvasElement; cv.style.touchAction = 'none';
  const pts = new Map<number, { x: number; y: number }>(); let pinch = 0;
  cv.addEventListener('pointerdown', e => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.setPointerCapture(e.pointerId); if (pts.size === 2) { const [p, q] = [...pts.values()]; pinch = Math.hypot(p.x - q.x, p.y - q.y); } });
  cv.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 1) { if (mode === 'battle') setMode('orbit'); orbit.yaw -= (e.clientX - p.x) * 0.006; orbit.pitch = Math.max(0.08, Math.min(1.3, orbit.pitch + (e.clientY - p.y) * 0.005)); }
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch > 0) orbit.dist = Math.max(4, Math.min(40, orbit.dist * (pinch / d))); pinch = d; }
  });
  const up = (e: PointerEvent) => { pts.delete(e.pointerId); pinch = 0; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); if (mode === 'battle') setMode('orbit'); orbit.dist = Math.max(4, Math.min(40, orbit.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
  shot('scenes', () => mode === 'battle' ? { base: BATTLE_CAM.base.clone(), look: BATTLE_CAM.look.clone(), fov: BATTLE_CAM.fov }
    : { base: V3(orbit.target.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist, orbit.target.y + Math.sin(orbit.pitch) * orbit.dist, orbit.target.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist), look: orbit.target.clone(), fov: 38 }, { speed: 10, cut: true });
  onUpdate(dt => { for (const a of actors) a.update(dt); });
  GRADE.bloomThreshold = 0.95;
  select(SCENES[0].id);
  return { select, setMode, orbit, get stage() { return stage; } };
}
