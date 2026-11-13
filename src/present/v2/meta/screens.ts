// The out-of-battle screens a console game ships with: title (continue / new run / codex / settings / credits), settings, pause,
// confirm dialogs, controls help, credits. Built on the menu kit (menu.ts); the host (show2) supplies the actions.
import type { Menu, MenuItem } from './menu';
import { PREFS, savePrefs, applyPrefs, resetPrefs } from './prefs';
import { peekRun, saveSummary } from './save';

export interface MetaHost {
  menu: Menu;
  /** start a new run (goes to class select) */
  newRun(): void;
  /** continue the saved run */
  continueRun(): void;
  /** back to the title from anywhere (the run stays saved at its last node) */
  toTitle(): void;
  /** give up the current run (deletes the save) */
  abandonRun(): void;
  /** close the pause menu and go on */
  resume(): void;
  /** codex (图鉴) / current build — optional screens */
  /** Esc / B on the title list: back to the 「按任意键开始」 attract state */
  titleBack?(): void;
  openCodex?(back: () => void): void;
  openBuild?(back: () => void): void;
}

const onOff = ['关', '开'];
const vol = Array.from({ length: 11 }, (_, i) => (i === 0 ? '静音' : String(i)));

export function titleMenu(h: MetaHost, focus?: string) {
  const save = peekRun();
  const items: MenuItem[] = [];
  if (save) items.push({ kind: 'btn', id: 'cont', label: '继续旅程', sub: saveSummary(save), on: () => h.continueRun() });
  items.push({ kind: 'btn', id: 'new', label: save ? '新的旅程' : '开始旅程', sub: save ? '会覆盖当前存档' : '选择职业，踏入幽暗森林', on: () => (save ? confirm(h, '开始新的旅程？', '当前存档会被覆盖。', '开始', () => h.newRun(), () => titleMenu(h, 'new')) : h.newRun()) });
  if (h.openCodex) items.push({ kind: 'btn', id: 'codex', label: '图鉴', sub: '职业技能 · 骰子 · 遗物 · 敌人', on: () => h.openCodex!(() => titleMenu(h, 'codex')) });
  items.push({ kind: 'btn', id: 'set', label: '设置', on: () => settingsMenu(h, () => titleMenu(h, 'set')) });
  items.push({ kind: 'btn', id: 'cred', label: '制作人员', on: () => creditsMenu(h, () => titleMenu(h, 'cred')) });
  h.menu.open({ title: '六面史诗', subtitle: '第一章 · 幽暗森林', items, layout: 'title', dim: 0.12, onBack: h.titleBack }, focus);
}

export function pauseMenu(h: MetaHost, focus?: string) {
  const items: MenuItem[] = [
    { kind: 'btn', id: 'resume', label: '继续', on: () => h.resume() },
  ];
  if (h.openBuild) items.push({ kind: 'btn', id: 'build', label: '查看构筑', sub: '技能 · 遗物 · 天赋', on: () => h.openBuild!(() => pauseMenu(h, 'build')) });
  if (h.openCodex) items.push({ kind: 'btn', id: 'codex', label: '图鉴', on: () => h.openCodex!(() => pauseMenu(h, 'codex')) });
  items.push(
    { kind: 'btn', id: 'set', label: '设置', on: () => settingsMenu(h, () => pauseMenu(h, 'set')) },
    { kind: 'btn', id: 'keys', label: '操作说明', on: () => controlsMenu(h, () => pauseMenu(h, 'keys')) },
    { kind: 'btn', id: 'title', label: '回到标题', sub: '下次从这一关开始', on: () => confirm(h, '回到标题？', '这一场战斗的进度不保存，下次从这一关开始。', '回到标题', () => h.toTitle(), () => pauseMenu(h, 'title')) },
    { kind: 'btn', id: 'quit', label: '放弃本局', danger: true, on: () => confirm(h, '放弃本局？', '存档会被删除，无法恢复。', '放弃', () => h.abandonRun(), () => pauseMenu(h, 'quit')) },
  );
  h.menu.open({ title: '暂停', items, onBack: () => h.resume(), dim: 0.62 }, focus);
}

export function settingsMenu(h: MetaHost, back: () => void, focus?: string) {
  const set = <K extends keyof typeof PREFS>(k: K, v: (typeof PREFS)[K]) => { PREFS[k] = v; applyPrefs(); savePrefs(); };
  const items: MenuItem[] = [
    { kind: 'head', label: '画面' },
    { kind: 'opt', id: 'pixel', label: '场景像素', values: ['高清 1×', '像素 2×', '像素 3×'], get: () => PREFS.pixel - 1, set: i => set('pixel', (i + 1) as 1 | 2 | 3) },
    { kind: 'opt', id: 'shake', label: '屏幕震动', values: ['关', '弱', '标准'], get: () => PREFS.shake, set: i => set('shake', i as 0 | 1 | 2) },
    { kind: 'head', label: '声音' },
    { kind: 'opt', id: 'master', label: '总音量', values: vol, get: () => PREFS.master, set: i => set('master', i) },
    { kind: 'opt', id: 'music', label: '音乐', values: vol, get: () => PREFS.music, set: i => set('music', i) },
    { kind: 'opt', id: 'sfx', label: '音效', values: vol, get: () => PREFS.sfx, set: i => set('sfx', i) },
    { kind: 'opt', id: 'voice', label: '语音', values: vol, get: () => PREFS.voice, set: i => set('voice', i) },
    { kind: 'head', label: '游戏' },
    { kind: 'opt', id: 'speed', label: '战斗速度', values: ['1×', '1.5×', '2×'], get: () => PREFS.speed, set: i => set('speed', i as 0 | 1 | 2) },
    { kind: 'opt', id: 'autoEnd', label: '无牌可出时自动结束回合', values: onOff, get: () => +PREFS.autoEnd, set: i => set('autoEnd', !!i) },
    { kind: 'opt', id: 'tips', label: '教学提示', values: onOff, get: () => +PREFS.tips, set: i => set('tips', !!i) },
    { kind: 'opt', id: 'vibrate', label: '震动反馈（手机）', values: onOff, get: () => +PREFS.vibrate, set: i => set('vibrate', !!i) },
    { kind: 'head', label: '' },
    { kind: 'btn', id: 'keys', label: '操作说明', on: () => controlsMenu(h, () => settingsMenu(h, back, 'keys')) },
    { kind: 'btn', id: 'reset', label: '恢复默认', on: () => confirm(h, '恢复默认设置？', '画面、声音和游戏选项都回到默认值。', '恢复', () => { resetPrefs(); settingsMenu(h, back, 'reset'); }, () => settingsMenu(h, back, 'reset')) },
    { kind: 'btn', id: 'back', label: '返回', on: back },
  ];
  h.menu.open({ title: '设置', items, layout: 'side', onBack: back }, focus);
}

export function controlsMenu(h: MetaHost, back: () => void) {
  h.menu.open({
    title: '操作说明', layout: 'side', onBack: back,
    items: [{ kind: 'btn', id: 'back', label: '返回', on: back }],
    notes: [
      '触屏：点骰子选中，点重投重投选中的骰子；按住出牌按钮拖向敌人出手，松在空处取消。',
      '　　　长按出牌按钮或技能槽看说明；点敌人或它的牌切换目标；右上角暂停。',
      '键盘：数字键 1～9 选骰子　R 重投　空格 出牌　E 结束回合 / 吟唱　Tab 换目标',
      '　　　Esc 暂停 / 返回　方向键 + Enter 在菜单里移动和确认',
      '手柄：A 确认 / 选骰　X 重投　Y 出牌　RB 结束回合　LB 换目标　B 返回　Start 暂停',
    ],
  });
}

export function creditsMenu(h: MetaHost, back: () => void) {
  h.menu.open({
    title: '制作人员', layout: 'side', onBack: back,
    items: [{ kind: 'btn', id: 'back', label: '返回', on: back }],
    notes: [
      '原作与设计：《六面史诗》作者',
      '3D 化：作者与 AI 协作开发（程序、体素美术、演出、界面）',
      '引擎：three.js　物理：cannon-es　界面字体：Fusion Pixel（OFL）',
      '音效：本地生成　语音：本地语音合成',
      '感谢游玩。',
    ],
  });
}

/** a two-button confirm dialog; Esc / B = cancel */
export function confirm(h: MetaHost, title: string, body: string, yes: string, onYes: () => void, onNo: () => void) {
  h.menu.open({
    title, notes: [body], onBack: onNo,
    items: [{ kind: 'btn', id: 'no', label: '取消', on: onNo }, { kind: 'btn', id: 'yes', label: yes, danger: true, on: onYes }],
  }, 'no');
}
