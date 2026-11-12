#!/usr/bin/env node
// Extract the stage-1 data subset from the archived 3D prototype data (which was itself extracted from the 2D original's src/config and
// src/data, so the numbers are the original's) into src/core/data/gameData.json. Presentation-only fields (pixel art, colours) go to
// src/present/data/visualData.json. Re-run only when the scope changes:  node tools/extract-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, '_ref/px3d/dh3d6_src/01_data.js'), 'utf8');
const DATA = (0, eval)('(' + src.slice(src.indexOf('{')).replace(/;\s*$/, '') + ')');

const CLASSES = ['warrior'];
const ENEMIES = ['boss_lich_forest', 'forest_ghoul'];
const diceIds = Object.keys(DATA.dice).filter(id => id.startsWith('w_') || ['standard', 'cursed', 'cracked', 'blade', 'amplify', 'chaos'].includes(id));
const allEnemies = [...DATA.normals, ...DATA.elites, ...DATA.bosses];

const pickKeys = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
const core = {
  _source: 'dicehero2d src/config + src/data via _ref/px3d/dh3d6_src/01_data.js (tools/extract-data.mjs)',
  classes: Object.fromEntries(CLASSES.map(id => [id, pickKeys(DATA.classes[id], ['id', 'name', 'title', 'desc', 'drawCount', 'maxPlays', 'freeRerolls', 'canBloodReroll', 'keepUnplayed', 'hp', 'maxHp', 'initialDice', 'passive', 'skills', 'multi'])])),
  dice: Object.fromEntries(diceIds.map(id => [id, DATA.dice[id]])),
  relics: Object.fromEntries(Object.entries(DATA.relics).map(([id, r]) => [id, pickKeys(r, ['id', 'name', 'desc', 'rarity', 'trigger'])])),
  enemies: Object.fromEntries(ENEMIES.map(id => [id, allEnemies.find(e => e.id === id)])),
};
const visual = {
  _source: core._source,
  classColors: Object.fromEntries(CLASSES.map(id => [id, pickKeys(DATA.classes[id], ['color', 'colorLight', 'colorDark'])])),
  diceColors: Object.fromEntries(diceIds.filter(id => DATA.diceColors[id]).map(id => [id, DATA.diceColors[id]])),
  dicePat: Object.fromEntries(diceIds.filter(id => DATA.dicePat && DATA.dicePat[id]).map(id => [id, DATA.dicePat[id]])),
  relicPx: Object.fromEntries(Object.entries(DATA.relics).filter(([, r]) => r.px).map(([id, r]) => [id, r.px])),
};
for (const e of ENEMIES) if (!core.enemies[e]) throw new Error('missing enemy ' + e);
fs.mkdirSync(path.join(ROOT, 'src/core/data'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'src/present/data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src/core/data/gameData.json'), JSON.stringify(core, null, 1) + '\n');
fs.writeFileSync(path.join(ROOT, 'src/present/data/visualData.json'), JSON.stringify(visual) + '\n');
console.log(`gameData.json: ${Object.keys(core.dice).length} dice, ${Object.keys(core.relics).length} relics, ${ENEMIES.length} enemies; visualData.json: ${Object.keys(visual.relicPx).length} relic sprites`);
