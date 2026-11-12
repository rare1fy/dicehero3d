// Class talents (SPEC_v2.1 2.1 / 2.2 / 2.3 talent tables). Each has two levels; the engine reads `talents[id]` (1 | 2).
// v2.1: `validFor` says whether the talent does anything for a loadout; Run2 only offers valid ones.
import type { Loadout, TalentDef } from '../types';

const all = () => true;
const onTablet = (id: string) => (l: Loadout) => l.tablets.some(t => t.tabletId === id);
const hasRow = (id: string) => (l: Loadout) => l.tablets.some(t => t.slots.some(s => s.rowId === id));

export const TALENTS: TalentDef[] = [
  // warrior
  { id: 't_wildblood', classId: 'warrior', name: '狂血', desc: ['血怒第 2 层就出怒火骰', '第 2 层出怒火骰，第 4 层再出 1 颗'], validFor: hasRow('w_fury') },
  { id: 't_bloodbath', classId: 'warrior', name: '浴血', desc: ['每层血怒，交出的骰子点数 +1（最多 +3）', '最多 +5'], validFor: all },
  { id: 't_mountain', classId: 'warrior', name: '不动如山', desc: ['回合开始护甲只清一半', '只清 1/3'], validFor: onTablet('w_suit') },
  { id: 't_overdrive', classId: 'warrior', name: '过载', desc: ['溢出每颗 +20%', '每颗 +30%'], validFor: all },
  { id: 't_instinct', classId: 'warrior', name: '嗜血本能', desc: ['每回合第一次卖血免费', '前两次免费'], validFor: all },
  { id: 't_ember', classId: 'warrior', name: '余烬怒火', desc: ['怒火骰可以留 2 回合', '可以同时留 2 颗'], validFor: hasRow('w_fury') },
  // mage
  { id: 't_deepchant', classId: 'mage', name: '深吟', desc: ['每个吟唱周期第一次吟唱 +2 格', '第一、二次各 +2 格'], validFor: all },
  { id: 't_lightspell', classId: 'mage', name: '轻咒', desc: ['只交 1 颗的奥术弹不打断吟唱，屏障减半', '屏障不减半'], validFor: all },
  { id: 't_steadyvein', classId: 'mage', name: '法脉稳固', desc: ['屏障完全挡下的那一下不叠反噬', '每个吟唱周期第一次被打穿也不叠'], validFor: all },
  { id: 't_supernova', classId: 'mage', name: '超新星', desc: ['超载窗口 2 → 3 回合', '窗口里第一回合 +1 次免费重投'], validFor: all },
  { id: 't_prism', classId: 'mage', name: '棱镜聚焦', desc: ['出手后下回合新骰至少 1 颗是本次出手的花色', '至少 2 颗'], validFor: onTablet('m_suit') },
  { id: 't_reverse', classId: 'mage', name: '逆转', desc: ['每回合 1 次，把 1 颗骰翻到对面', '每回合 2 次'], validFor: all },
  // rogue
  { id: 't_shadowbox', classId: 'rogue', name: '影匣', desc: ['发生过职业产残时可留的残骰 1 → 2', '→ 3'], validFor: all },
  { id: 't_dualmaster', classId: 'rogue', name: '双刃精通', desc: ['第二刀加成 +35%', '+50%'], validFor: all },
  { id: 't_precision', classId: 'rogue', name: '精准大师', desc: ['精准连击 +40%', '+55%'], validFor: onTablet('r_suit') },
  { id: 't_markmaster', classId: 'rogue', name: '标记精通', desc: ['完成飞刀标记的那一刀 +30%', '完成标记时再 +1 次免费重投'], validFor: hasRow('r_knife') },
  { id: 't_phantom', classId: 'rogue', name: '幻影', desc: ['残骰掷出 1～2 时按 3 算', '按 4 算'], validFor: all },
  { id: 't_whet', classId: 'rogue', name: '磨砺', desc: ['击杀补 1 颗残骰（每回合 1 次）', '每回合 2 次'], validFor: all },
  { id: 't_triple', classId: 'rogue', name: '三连闪', desc: ['第 3 刀之后再 +1 刀（每回合 1 次）', '第 3 刀 +30%'], validFor: hasRow('r_dance') },
];

/** filler cards when fewer than 3 valid talents (SPEC 3.5) */
export const TALENT_FILLERS = {
  grind: { id: 't_grind', name: '磨炼', desc: '+40 经验', xp: 40 },
  gold: { id: 't_gold', name: '横财', desc: '+30 金', gold: 30 },
};

export const talentDef = (id: string) => { const t = TALENTS.find(x => x.id === id); if (!t) throw new Error('unknown talent ' + id); return t; };
