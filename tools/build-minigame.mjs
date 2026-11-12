#!/usr/bin/env node
// Export WeChat / Douyin mini-game projects: dist/wechat, dist/douyin.
//   game.js = pxui's minigame-adapter (three r162 globals) + one esbuild IIFE of src/main.ts with three, cannon-es, pxui, layout, font.
// Mirrors pxui/tools/build-minigame.mjs (which only takes a main.js entry). Main package limit is 4 MB on both platforms.
// Usage: node tools/build-minigame.mjs [--target wechat|douyin|all] [--no-minify]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stamp = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`; };   // local time
const PXUI = path.resolve(ROOT, '../pxui');
const MAIN_LIMIT = 4 * 1024 * 1024;
const kb = n => (n / 1024).toFixed(0) + ' KB';
const args = process.argv.slice(2), get = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const target = get('--target') || 'all', minify = !args.includes('--no-minify');
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'pxui.game.json'), 'utf8'));
function dirSize(d) { let n = 0; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); n += e.isDirectory() ? dirSize(p) : fs.statSync(p).size; } return n; }

const r = await build({
  entryPoints: [path.join(ROOT, 'src/main.ts')], bundle: true, format: 'iife', target: 'es2017', minify, write: false,
  legalComments: 'none', logLevel: 'warning', metafile: true,
  define: { __DEV__: 'false', __BUILD__: JSON.stringify(stamp()) },
  alias: { three: path.join(ROOT, 'node_modules/three/build/three.module.js') },
  plugins: [{ name: 'pxui', setup(b) { b.onResolve({ filter: /^pxui\// }, a => ({ path: path.join(PXUI, 'src', a.path.slice(5)) })); } }],
});
const adapter = fs.readFileSync(path.join(PXUI, 'src/platform/minigame-adapter.js'), 'utf8');
const code = `${adapter}\n${r.outputFiles[0].text}`;
const top = Object.entries(r.metafile.inputs).map(([f, i]) => [f.replace(/\\/g, '/').replace(/^.*node_modules\//, ''), i.bytes]).sort((a, b) => b[1] - a[1]).slice(0, 5);

for (const t of target === 'all' ? ['wechat', 'douyin'] : [target]) {
  const out = path.join(ROOT, 'dist', t);
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'game.js'), code);
  fs.writeFileSync(path.join(out, 'game.json'), JSON.stringify({ deviceOrientation: meta.orientation || 'portrait', showStatusBar: false, networkTimeout: { request: 10000, downloadFile: 10000 } }, null, 2));
  const pc = t === 'wechat'
    ? { description: meta.title, compileType: 'game', libVersion: meta.wechatLibVersion || '3.4.10', appid: meta.wechat?.appid || 'touristappid', projectname: meta.name,
        setting: { urlCheck: false, es6: true, enhance: false, postcss: false, minified: true, newFeature: true, coverView: false, nodeModules: false, autoAudits: false, uglifyFileName: false, checkInvalidKey: true, checkSiteMap: false, uploadWithSourceMap: true },
        condition: {}, editorSetting: { tabIndent: 'insertSpaces', tabSize: 2 } }
    : { appid: meta.douyin?.appid || 'testappid', projectname: meta.name, compileType: 'game', setting: { urlCheck: false, es6: true, minified: true }, description: meta.title };
  fs.writeFileSync(path.join(out, 'project.config.json'), JSON.stringify(pc, null, 2));
  fs.writeFileSync(path.join(out, 'README.txt'), `${meta.title}：${t === 'wechat' ? '微信' : '抖音'}小游戏工程，由 tools/build-minigame.mjs 生成，勿手改。\n用开发者工具「导入项目」选择本目录。主包上限 4 MB。\n`);
  const total = dirSize(out);
  console.log(`${t}: game.js ${kb(code.length)}，总计 ${kb(total)}${total > MAIN_LIMIT ? '  ⚠ 超过 4 MB 主包上限' : ''}`);
}
console.log('最大的输入：' + top.map(([f, n]) => `${f} ${kb(n)}`).join('，'));
