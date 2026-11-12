#!/usr/bin/env node
// Boot the built mini-game (dist/wechat/game.js) in pxui's no-DOM sandbox: a Web Worker with a fake wx/tt and an OffscreenCanvas,
// no document/window/CSS. Checks it boots, renders 3D + UI, and that taps reach the right place. Writes a screenshot.
// Usage: node tools/minigame-sandbox.mjs [--api tt] [--out out/sandbox]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PXUI = path.resolve(ROOT, '../pxui');
const { launch, sleep } = await import(pathToFileURL(path.join(PXUI, 'tools/cdp.mjs')).href);
const args = process.argv.slice(2), get = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const api = get('--api') || 'wx';
const dist = path.join(ROOT, 'dist', api === 'tt' ? 'douyin' : 'wechat'), outDir = path.resolve(ROOT, get('--out') || 'out/sandbox');
if (!fs.existsSync(path.join(dist, 'game.js'))) { console.error('先构建：npm run build:minigame'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = p.startsWith('/dist/') ? path.join(dist, p.slice(6)) : path.join(PXUI, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const host = `http://127.0.0.1:${srv.address().port}`;

const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const br = await launch();
try {
  const p = await br.newPage(); await p.viewport(412, 860, 1, true); await p.goto(host + '/test/sandbox/sandbox.html', 'window.sb');
  const boot = await p.eval(`sb.boot({ gameJs: '${host}/dist/game.js', base: '${host}/dist/', w: 412, h: 860, dpr: 1, fixedTime: 1.5, api: '${api}' })`, 60000);
  const b = boot.before || {};
  ok('沙盒里没有 document / window / DOM / CSS', b.document === 'undefined' && b.window === 'undefined' && b.HTMLElement === 'undefined' && b.getComputedStyle === 'undefined', JSON.stringify(b));
  ok(`game.js 在假 ${api} 里启动`, boot.booted, boot.err ? String(boot.err).slice(0, 400) : '');
  if (boot.booted) {
    await sleep(500);
    const st = await p.eval(`sb.eval("({ platform: __dh.info().platform, frames: __dh.frames(), stats: __dh.stats() })")`);
    ok('3D 和 UI 都在出帧', st.platform === api && st.frames > 3 && st.stats.calls >= 1 && st.stats.ui && st.stats.ui.quads > 20, JSON.stringify(st));
    const r = await p.eval(`sb.eval("PXUI.rect('b_play')")`);
    if (r) { await p.eval(`sb.tap(${Math.round(r.x + r.w / 2)}, ${Math.round(r.y + r.h / 2)})`); await sleep(150); }
    const last = await p.eval(`sb.eval("__dh.last()")`);
    ok('点「出牌」按钮，游戏收到', last === 'play', JSON.stringify({ rect: r, last }));
    await p.eval('sb.tap(206, 300)'); await sleep(120);
    const last2 = await p.eval(`sb.eval("__dh.last()")`);
    ok('点空白场景，UI 不吞掉', last2 === 'scene', String(last2));
    await p.eval('sb.show(412, 860)'); await p.shot(path.join(outDir, `sandbox_${api}.png`), { x: 0, y: 0, width: 412, height: 860 });
  }
  fs.writeFileSync(path.join(outDir, `sandbox_${api}.json`), JSON.stringify({ results, logs: p.logs }, null, 1));
} finally { await br.close(); srv.close(); }
const failed = results.filter(r => !r.pass).length;
console.log(failed ? `${failed} 项失败` : '全部通过');
process.exit(failed ? 1 : 0);
