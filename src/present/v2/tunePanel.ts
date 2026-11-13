// In-game tuning panel (user 11-14: 「你把这个参数放到游戏里我自己来调试，调试结果显示在界面上一串文字，我觉得OK了会截图给你」).
// A small 「调参」 button at the top centre opens sliders for the battle camera and the UI perspective; every change applies at once,
// and one line of text shows all current values (the user screenshots it). Values persist per device (localStorage).
// Browser only (a DOM debug overlay); on portrait phones it turns with the canvas (platform/rotate.ts).
import type { UiLayer } from '../ui3d/layer';
import { CAMERA_TUNE } from './battleCamera';
import { screenTurned } from '../../platform/rotate';

interface Host { L: UiLayer; layout(): void; flask?: { depthK: number }; hud?: { bar?: { spacing: number; relayout(): void } } }
interface Param { key: string; cn: string; min: number; max: number; step: number; get(): number; set(v: number): void; camera?: boolean; digits: number }

const STORE = 'dh_tune_v1';
const BACK_LEN = Math.hypot(12.8, 18.0);   // the camera back vector's length (dist scales it)

export function installTunePanel(host0: unknown) {
  if (typeof document === 'undefined' || !document.body) return;
  const host = host0 as Host, T = CAMERA_TUNE;
  const pitchOf = () => Math.atan2(T.back[1], T.back[2]) * 180 / Math.PI;
  const setPitch = (deg: number) => { const r = deg * Math.PI / 180; T.back = [0.3, BACK_LEN * Math.sin(r), BACK_LEN * Math.cos(r)]; };
  const P: Param[] = [
    { key: 'pitch', cn: '镜头俯角', min: 20, max: 60, step: 0.1, digits: 1, camera: true, get: pitchOf, set: setPitch },
    { key: 'dist', cn: '镜头距离', min: 0.45, max: 1.2, step: 0.01, digits: 2, camera: true, get: () => T.dist, set: v => { T.dist = v; } },
    { key: 'lookZ', cn: '看点前后', min: -7, max: 2, step: 0.1, digits: 1, camera: true, get: () => T.lookZ, set: v => { T.lookZ = v; } },
    { key: 'lookY', cn: '看点高低', min: -2.5, max: 2, step: 0.1, digits: 1, camera: true, get: () => T.lookY, set: v => { T.lookY = v; } },
    { key: 'fov', cn: '镜头视野', min: 28, max: 65, step: 1, digits: 0, camera: true, get: () => T.fov, set: v => { T.fov = v; } },
    { key: 'camZ', cn: 'UI镜距', min: 10, max: 60, step: 1, digits: 0, get: () => host.L.camZ, set: v => host.L.setLens(v) },
    { key: 'tilt', cn: 'UI转角', min: 0, max: 1.6, step: 0.02, digits: 2, get: () => host.L.tilt, set: v => { host.L.tilt = v; } },
    { key: 'sway', cn: 'UI摆动', min: 0, max: 0.12, step: 0.005, digits: 3, get: () => host.L.sway, set: v => { host.L.sway = v; } },
    { key: 'flask', cn: '血瓶厚度', min: 1, max: 2.6, step: 0.05, digits: 2, get: () => host.flask?.depthK ?? 1, set: v => { if (host.flask) host.flask.depthK = v; } },
    { key: 'spacing', cn: '技能间距', min: 0.8, max: 1.6, step: 0.02, digits: 2, get: () => host.hud?.bar?.spacing ?? 1, set: v => { const b = host.hud?.bar; if (b) { b.spacing = v; b.relayout(); } } },
  ];
  const DEF: Record<string, number> = Object.fromEntries(P.map(p => [p.key, p.get()]));

  // ---- persistence (a convenience only: the game runs fine without it)
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(Object.fromEntries(P.map(p => [p.key, p.get()])))); } catch { /* private mode */ } };
  try { const s = JSON.parse(localStorage.getItem(STORE) || 'null') as Record<string, number> | null; if (s) for (const p of P) if (typeof s[p.key] === 'number') p.set(s[p.key]); } catch { /* ignore */ }

  let relayoutQueued = false;
  const relayout = () => { if (relayoutQueued) return; relayoutQueued = true; requestAnimationFrame(() => { relayoutQueued = false; try { host.layout(); } catch { /* not in a battle yet */ } }); };

  // ---- DOM
  const css = (el: HTMLElement, s: Partial<CSSStyleDeclaration>) => Object.assign(el.style, s);
  const root = document.createElement('div'); root.id = 'dh-tune';
  css(root, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '50', fontFamily: '"Microsoft YaHei UI","Microsoft YaHei","PingFang SC",sans-serif' });
  const bar = document.createElement('div');
  css(bar, { position: 'absolute', left: '28%', top: '6px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', pointerEvents: 'none', maxWidth: '68%' });
  const btn = document.createElement('button'); btn.textContent = '调参';
  css(btn, { pointerEvents: 'auto', font: '600 13px inherit', fontFamily: 'inherit', color: '#ffe6a0', background: 'rgba(20,18,28,0.85)', border: '1px solid #8a6a3a', borderRadius: '0', padding: '3px 10px', cursor: 'pointer' });
  const line = document.createElement('div');
  css(line, { pointerEvents: 'auto', color: '#fff4dc', background: 'rgba(10,8,16,0.82)', border: '1px solid #5a4a2c', padding: '3px 8px', fontSize: '12px', lineHeight: '1.4', whiteSpace: 'normal', textAlign: 'left', userSelect: 'text', display: 'none' });
  const panel = document.createElement('div');
  const short = Math.min(innerWidth, innerHeight) < 500;
  css(panel, { pointerEvents: 'auto', display: 'none', background: 'rgba(16,14,22,0.88)', border: '1px solid #8a6a3a', padding: short ? '3px 8px' : '6px 10px', color: '#ece6f2', fontSize: short ? '11px' : '12px', maxHeight: '70vh', overflowY: 'auto', width: short ? '440px' : '300px', boxSizing: 'border-box' });
  const grid = document.createElement('div'); css(grid, { display: 'grid', gridTemplateColumns: short ? '1fr 1fr' : '1fr', columnGap: '12px' }); panel.append(grid);
  bar.append(btn, line, panel); root.append(bar); document.body.append(root);

  const fmt = (p: Param) => p.get().toFixed(p.digits);
  const text = () => `镜头 俯角${fmt(P[0])} 距离${fmt(P[1])} 看点Z${fmt(P[2])} Y${fmt(P[3])} 视野${fmt(P[4])} ｜ UI 镜距${fmt(P[5])} 转角${fmt(P[6])} 摆动${fmt(P[7])} 血瓶厚${fmt(P[8])} 技能间距${fmt(P[9])}`;
  const vals: HTMLSpanElement[] = [], inputs: HTMLInputElement[] = [];
  const refresh = () => { line.textContent = text(); P.forEach((p, i) => { vals[i].textContent = fmt(p); inputs[i].value = String(p.get()); }); };
  for (const p of P) {
    const row = document.createElement('label'); css(row, { display: 'grid', gridTemplateColumns: short ? '52px 1fr 36px' : '64px 1fr 44px', alignItems: 'center', gap: '4px', margin: short ? '0' : '3px 0' });
    const name = document.createElement('span'); name.textContent = p.cn;
    const inp = document.createElement('input'); inp.type = 'range'; inp.min = String(p.min); inp.max = String(p.max); inp.step = String(p.step); inp.value = String(p.get());
    css(inp, { width: '100%', touchAction: 'none' });
    const v = document.createElement('span'); css(v, { textAlign: 'right', color: '#ffd884' });
    inp.addEventListener('input', () => { p.set(Number(inp.value)); if (p.camera || p.key === 'camZ') relayout(); save(); refresh(); });
    row.append(name, inp, v); grid.append(row); vals.push(v); inputs.push(inp);
  }
  const btns = document.createElement('div'); css(btns, { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' });
  const mk = (t: string, fn: () => void) => { const b = document.createElement('button'); b.textContent = t; css(b, { font: '12px inherit', fontFamily: 'inherit', color: '#ece6f2', background: '#24202e', border: '1px solid #5a4a2c', padding: '2px 10px', cursor: 'pointer' }); b.addEventListener('click', fn); return b; };
  btns.append(
    mk('恢复默认', () => { for (const p of P) p.set(DEF[p.key]); relayout(); save(); refresh(); }),
    mk('收起', () => { panel.style.display = 'none'; }),
    mk('关闭', () => { panel.style.display = 'none'; line.style.display = 'none'; }),
  );
  panel.append(btns);
  btn.addEventListener('click', () => { const open = panel.style.display === 'none'; panel.style.display = open ? 'block' : 'none'; line.style.display = 'block'; refresh(); });
  refresh();

  // portrait phones: the canvas is turned 90° (platform/rotate.ts); turn the overlay the same way so it reads in landscape
  const orient = () => {
    if (screenTurned()) css(root, { left: innerWidth + 'px', top: '0', width: innerHeight + 'px', height: innerWidth + 'px', transformOrigin: '0 0', transform: 'rotate(90deg)' });
    else css(root, { left: '0', top: '0', width: '100vw', height: '100vh', transformOrigin: '', transform: '' });
  };
  orient(); addEventListener('resize', orient);
  // stored camera values apply on the first battle framing; nudge once in case a battle is already up
  relayout();
}
