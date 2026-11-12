#!/usr/bin/env node
// Bake the pixel font into ui/font.js with pxui's baker. pxui's own scanner only reads *.js/*.json and would walk _ref/ (136 MB),
// so the character scan is done here: GB2312 level-1 + ASCII + every non-ASCII char in src/**/*.ts and ui/layout.json.
// Usage: node tools/bake-font.mjs [--extra "字符"]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PXUI = path.resolve(ROOT, '../pxui');
const { gb2312Level1, bakeFont, fontModule } = await import(pathToFileURL(path.join(PXUI, 'tools/bake-font.mjs')).href);
const { BASE_CHARS } = await import(pathToFileURL(path.join(PXUI, 'src/core/text.js')).href);

export function scanGameChars() {
  const out = new Set();
  const add = f => { for (const ch of fs.readFileSync(f, 'utf8')) if (ch.codePointAt(0) > 0x7e) out.add(ch); };
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|js|json)$/.test(e.name)) add(p); } };
  walk(path.join(ROOT, 'src')); add(path.join(ROOT, 'ui', 'layout.json'));
  return [...out].join('');
}

const args = process.argv.slice(2), xi = args.indexOf('--extra');
const scanned = scanGameChars();
const chars = [...new Set([...BASE_CHARS, ...gb2312Level1(), ...scanned, ...(xi >= 0 ? args[xi + 1] : '')])].join('');
console.log(`字库: 烘焙 ${[...chars].length} 字（游戏内扫到 ${[...scanned].length} 个非 ASCII 字符）…`);
const r = await bakeFont(chars);
const out = path.join(ROOT, 'ui', 'font.js');
fs.writeFileSync(out, fontModule(r, 'Baked by dicehero3d tools/bake-font.mjs.'));
console.log(`ui/font.js: ${r.count} 字, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
process.exit(0);
