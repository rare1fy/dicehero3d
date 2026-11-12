#!/usr/bin/env node
// Download the FREE tier of name-your-own-price itch.io asset packs (the same steps as clicking "No thanks, just take me to the downloads").
// Usage: node tools/itch_free.mjs <outDir> <user> <slug> [<slug> ...] [--list] [--pick substring]
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2); const listOnly = args.includes('--list');
const pi = args.indexOf('--pick'); const pick = pi >= 0 ? args[pi + 1].toLowerCase() : null;
const pos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--pick');
const [outDir, user, ...slugs] = pos;
fs.mkdirSync(outDir, { recursive: true });
let cookies = '';
async function req(url, o = {}) {
  const r = await fetch(url, { ...o, redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0', Cookie: cookies, ...(o.headers || {}) } });
  const sc = r.headers.getSetCookie?.() || []; for (const c of sc) { const kv = c.split(';')[0]; const k = kv.split('=')[0]; cookies = cookies.split('; ').filter(x => x && !x.startsWith(k + '=')).concat(kv).join('; '); }
  return r;
}
const csrf = html => (html.match(/name="csrf_token" value="([^"]+)"/) || [])[1];
for (const slug of slugs) {
  const base = `https://${user}.itch.io/${slug}`;
  const page = await (await req(base)).text(); const t1 = csrf(page);
  const du = await (await req(base + '/download_url', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Referer: base }, body: 'csrf_token=' + encodeURIComponent(t1) })).json();
  if (!du.url) { console.log(slug, 'no download_url', JSON.stringify(du)); continue; }
  const dl = await (await req(du.url)).text(); const t2 = csrf(dl) || t1;
  const ups = [...dl.matchAll(/data-upload_id="(\d+)"[\s\S]*?<strong title="([^"]*)" class="name"[\s\S]*?file_size"><span>([^<]*)/g)].map(m => ({ id: m[1], name: m[2], size: m[3] }));
  console.log(slug, ups.map(u => `${u.id}:${u.name} (${u.size})`).join(' | '));
  if (listOnly) continue;
  const want = ups.filter(u => (pick ? u.name.toLowerCase().includes(pick) : true));
  for (const u of want.length ? want : ups.slice(0, 1)) {
    const fr = await (await req(`${base}/file/${u.id}?source=view_game&as_props=1&after_download_lightbox=true`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Referer: base }, body: 'csrf_token=' + encodeURIComponent(t2) })).json();
    if (!fr.url) { console.log('  no file url', u.name, JSON.stringify(fr)); continue; }
    const bin = await fetch(fr.url); const buf = Buffer.from(await bin.arrayBuffer());
    const cd = bin.headers.get('content-disposition') || ''; const fname = (cd.match(/filename="?([^";]+)"?/) || [])[1] || `${slug}_${u.id}.zip`;
    const outP = path.join(outDir, `${slug}__${fname}`); fs.writeFileSync(outP, buf); console.log('  saved', outP, (buf.length / 1048576).toFixed(1) + ' MB');
  }
}
