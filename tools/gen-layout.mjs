#!/usr/bin/env node
// One-off generator for the first battle layout (no designer edits exist yet). Once the designer touches ui/layout.json,
// change it only through pxui merge proposals (pxui/AGENTS.md).
import fs from 'node:fs';
const L = JSON.parse(fs.readFileSync('ui/layout.json', 'utf8'));
if (JSON.stringify(L).includes('_designer')) { console.error('layout has designer edits: use a merge proposal instead'); process.exit(1); }
const txt = (id, text, o = {}) => ({ id, type: 'text', text, fontSize: 24, color: 'cream', outline: 'ink', ...o });
L.screens = {
  plates: { attach: 'viewport', visible: true, z: 5, children: [
    { id: 'enemy_plate', type: 'world', name: '敌人信息牌', pivot: [0.5, 1], x: 0, y: -2, clamp: 4, preview: [50, 30], layout: { dir: 'column', gap: 1, align: 'center' }, children: [
      txt('ep_name', '{name}', { mock: { name: '枯骨巫妖' }, frame: 'plate', pad: [2, 0] }),
      { id: 'ep_hp', type: 'bar', frame: 'plate', w: 56, h: 12, value: 216, max: 216, ticks: 0, fontSize: 12, showValue: true, label: '{value}/{max}' },
      txt('ep_info', '{info}', { mock: { info: '施法' }, fontSize: 12, color: 'parch' }),
    ] },
    { id: 'hero_plate', type: 'world', name: '英雄信息牌', pivot: [0.5, 0], x: 0, y: 2, clamp: 4, preview: [50, 80], layout: { dir: 'column', gap: 1, align: 'center' }, children: [
      { id: 'hp_bar', type: 'bar', frame: 'plate', w: 60, h: 12, value: 120, max: 120, ticks: 0, fontSize: 12, showValue: true, label: '{value}/{max}' },
      txt('hp_extra', '{extra}', { mock: { extra: '护甲 4' }, fontSize: 12, color: 'parch' }),
    ] },
  ] },
  hud: { attach: 'column', visible: true, z: 10, safe: true, children: [
    { id: 'top_bar', type: 'group', ax: 'stretch', x: 4, r: 4, y: 4, h: 'hug', layout: { dir: 'row', gap: 2, align: 'center', justify: 'between' }, children: [
      txt('turn_chip', '第 {turn} 回合', { mock: { turn: 1 }, frame: 'plate', pad: [2, 0] }),
      txt('pile_chip', '骰袋 {bag}  弃骰 {disc}', { mock: { bag: 7, disc: 0 }, fontSize: 12, frame: 'plate', pad: [2, 1] }),
    ] },
    txt('preview', '{text}', { mock: { text: '对称打击  预计 42' }, ax: 'center', ay: 'bottom', y: 44, align: 'center', frame: 'plate', pad: [3, 1], visible: false }),
    txt('hint', '{text}', { mock: { text: '点骰子选中 · 按住滑过多选' }, fontSize: 12, color: 'parch', ax: 'center', ay: 'bottom', y: 38, align: 'center' }),
    { id: 'actions', type: 'group', name: '操作按钮', ax: 'center', ay: 'bottom', y: 4, layout: { dir: 'row', gap: 4, align: 'center' }, children: [
      { id: 'b_reroll', type: 'button', frame: 'wood', framePressed: 'pressed', label: '重投', sub: '{cost}', mock: { cost: '免费' }, w: 56, h: 32 },
      { id: 'b_play', type: 'button', frame: 'blood', framePressed: 'pressed', label: '出牌', w: 64, h: 32 },
      { id: 'b_end', type: 'button', frame: 'brass', framePressed: 'pressed', label: '结束回合', w: 56, h: 32 },
    ] },
  ] },
  banner: { attach: 'column', visible: true, z: 25, children: [
    txt('banner', '{text}', { mock: { text: '第二阶段' }, fontSize: 48, color: 'gold', ax: 'center', ay: 'center', y: -60, align: 'center', visible: false }),
  ] },
  toast: { attach: 'column', visible: true, z: 30, children: [
    txt('toast', '提示', { frame: 'plate', pad: [2, 0], ax: 'center', ay: 'center', y: -20, visible: false }),
  ] },
};
fs.writeFileSync('ui/layout.json', JSON.stringify(L, null, 2) + '\n');
console.log('layout written');
