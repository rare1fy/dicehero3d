// Condition matching and tier lookup (SPEC_v2.1 1.5: each row writes its own steps).
import { matchCond, matchRow, tierOf, stepOf, isStraight } from '../../src/core/v2/cond';
import { CLASSES, rowDef } from '../../src/core/v2/data';
import { steps } from '../../src/core/v2/data/util';
import type { ClassId, Face } from '../../src/core/v2/types';

const F = (cls: ClassId, ...vals: number[]): Face[] => vals.map(v => ({ value: v, suit: CLASSES[cls].suitOf(v) }));

describe('tier steps (v2.1)', () => {
  it('steps(): min = number before ～ / +', () => {
    expect(steps(['2', 'single'], ['4～5', 'area'], ['6+', 'ultimate'])).toEqual([
      { min: 2, tier: 'single', label: '2' }, { min: 4, tier: 'area', label: '4～5' }, { min: 6, tier: 'ultimate', label: '6+' },
    ]);
  });
  it('a count lands on the last step whose min it reaches; below the first step is nothing', () => {
    const r = { steps: steps(['2', 'single'], ['3', 'feed'], ['4～5', 'area'], ['6', 'ultimate']) };
    expect([1, 2, 3, 4, 5, 6].map(n => tierOf(r, n))).toEqual([null, 'single', 'feed', 'area', 'area', 'ultimate']);
    expect(stepOf(r, 5)).toMatchObject({ idx: 2, label: '4～5' });
  });
  it('rows write their own early tiers (no global rare / ace rule)', () => {
    expect([1, 2, 3, 4].map(n => tierOf(rowDef('w_blood').tierRule, n))).toEqual(['single', 'feed', 'feed', 'area']);
    expect([1, 2, 3].map(n => tierOf(rowDef('w_fury').tierRule, n))).toEqual(['single', 'feed', 'ultimate']);
    expect([1, 2, 3, 4].map(n => tierOf(rowDef('m_sun').tierRule, n))).toEqual(['single', 'feed', 'area', 'area']);
    expect([3, 4, 5, 6].map(n => tierOf(rowDef('m_mix').tierRule, n))).toEqual([null, 'area', 'earn', 'ultimate']);
  });
  it('fixed-count rows only fire with that many dice', () => {
    const r = { steps: steps(['4', 'area']), fixedCount: 4 };
    expect(tierOf(r, 4)).toBe('area');
    expect(tierOf(r, 5)).toBeNull();
  });
  it('countBonus (降维) shifts the step by one', () => {
    expect(tierOf(rowDef('m_straight').tierRule, 3)).toBe('feed');
    expect(tierOf({ ...rowDef('m_straight').tierRule, countBonus: 1 }, 3)).toBe('area');
  });
});

describe('conditions', () => {
  it('suit: all handed dice must be that suit; fury row takes up to 2 companions that do not count', () => {
    const fury = rowDef('w_fury');
    expect(matchRow(fury, F('warrior', 6, 1, 2))).toMatchObject({ count: 1, companions: 2, tier: 'single' });
    expect(matchRow(fury, F('warrior', 6, 1, 2, 3))).toBeNull();
    expect(matchRow(fury, F('warrior', 6, 6, 6))).toMatchObject({ count: 3, tier: 'ultimate' });
    expect(matchRow(rowDef('w_axe'), F('warrior', 1, 2, 4))).toBeNull();
    expect(matchRow(rowDef('w_axe'), F('warrior', 1))).toBeNull();
    expect(matchRow(rowDef('w_axe'), F('warrior', 1, 2, 3))).toMatchObject({ count: 3, tier: 'feed' });
  });
  it('same value: pair / triple / four; mixed values fail', () => {
    expect(matchRow(rowDef('w_same'), F('warrior', 3, 3))).toMatchObject({ tier: 'single' });
    expect(matchRow(rowDef('w_same'), F('warrior', 3, 3, 3))).toMatchObject({ tier: 'feed' });
    expect(matchRow(rowDef('w_same'), F('warrior', 3, 3, 3, 3))).toMatchObject({ tier: 'area' });
    expect(matchRow(rowDef('w_same'), F('warrior', 3, 4))).toBeNull();
  });
  it('万象归一 (loose): 2 same + 1 odd counts as a triple', () => {
    expect(matchCond({ t: 'sameValue' }, F('mage', 2, 2, 5), [], { loose: true })).toMatchObject({ count: 3 });
    expect(matchCond({ t: 'sameValue' }, F('mage', 2, 2, 5))).toBeNull();
  });
  it('straight by value, any order', () => {
    expect(isStraight([4, 2, 3])).toBe(true);
    expect(isStraight([1, 3])).toBe(false);
    expect(isStraight([2, 2, 3])).toBe(false);
    expect(matchRow(rowDef('w_straight'), F('warrior', 5, 6, 4, 3, 2))).toMatchObject({ tier: 'area' });
    expect(matchRow(rowDef('m_straight'), F('mage', 1, 2))).toBeNull();
  });
  it('sumAtLeast (千钧行): 2 dice ≥9, 3 ≥14, 4 ≥18; 1 or 5 dice never', () => {
    const h = rowDef('w_heavy');
    expect(matchRow(h, F('warrior', 4, 5))).toMatchObject({ tier: 'single' });
    expect(matchRow(h, F('warrior', 4, 4))).toBeNull();
    expect(matchRow(h, F('warrior', 6, 5, 3))).toMatchObject({ tier: 'feed' });
    expect(matchRow(h, F('warrior', 6, 5, 2))).toBeNull();
    expect(matchRow(h, F('warrior', 6, 5, 4, 3))).toMatchObject({ tier: 'area' });
    expect(matchRow(h, F('warrior', 6))).toBeNull();
    expect(matchRow(h, F('warrior', 6, 6, 6, 6, 6))).toBeNull();
  });
  it('mixedRelease (元素交汇): ≥4 dice, two suits with ≥2 each, the rest may ride along', () => {
    const mx = rowDef('m_mix');
    expect(matchRow(mx, F('mage', 1, 2, 3, 4))).toMatchObject({ count: 4, tier: 'area' });          // 2 star + 2 moon
    expect(matchRow(mx, F('mage', 1, 2, 3, 5))).toBeNull();                                          // only star ×2
    expect(matchRow(mx, F('mage', 1, 2, 3, 4, 5))).toMatchObject({ count: 5, tier: 'earn' });       // + sun rides along
    expect(matchRow(mx, F('mage', 1, 2, 3, 4, 5, 6))).toMatchObject({ count: 6, tier: 'ultimate' });
    expect(matchRow(mx, F('mage', 1, 1, 6))).toBeNull();
    // 元素之心: four suits ×1 also fires
    const heart = mx.evolutions[1].apply(mx);
    expect(matchRow(heart, F('mage', 1, 3, 5, 6))).toMatchObject({ count: 4 });
  });
  it('every value paired (mage)', () => {
    expect(matchRow(rowDef('m_pairs'), F('mage', 2, 2, 5, 5))).toMatchObject({ tier: 'area' });
    expect(matchRow(rowDef('m_pairs'), F('mage', 2, 2, 5))).toBeNull();
  });
  it('suit mix: 战吼 exactly axe+blood+fury; 铁血 2 axe + 2 blood', () => {
    expect(matchRow(rowDef('w_warcry'), F('warrior', 1, 4, 6))).toMatchObject({ tier: 'feed' });
    expect(matchRow(rowDef('w_warcry'), F('warrior', 1, 2, 6))).toBeNull();
    expect(matchRow(rowDef('w_ironblood'), F('warrior', 1, 2, 4, 5))).toMatchObject({ tier: 'area' });
  });
  it('two pair and full house', () => {
    expect(matchRow(rowDef('w_twin'), F('warrior', 2, 2, 5, 5))).toMatchObject({ tier: 'area' });
    expect(matchRow(rowDef('w_twin'), F('warrior', 2, 2, 2, 2))).toBeNull();
    expect(matchRow(rowDef('w_verdict'), F('warrior', 3, 3, 3, 6, 6))).toMatchObject({ tier: 'earn' });
  });
  it('cursed dice (0) satisfy nothing; cracked dice have no suit but count for point shapes', () => {
    const cursed: Face = { value: 0, suit: 'none' }, cracked: Face = { value: 2, suit: 'none' };
    expect(matchRow(rowDef('w_same'), [cursed, cursed], ['cursed', 'cursed'])).toBeNull();
    expect(matchRow(rowDef('w_same'), [cracked, { value: 2, suit: 'axe' }], ['cracked', 'normal'])).toMatchObject({ tier: 'single' });
    expect(matchRow(rowDef('w_axe'), [cracked, { value: 2, suit: 'axe' }], ['cracked', 'normal'])).toBeNull();
  });
  it('rogue rows: 1 shadow / blade is a single; group effects from 4 dice; knife is exactly 1 blade', () => {
    expect(matchRow(rowDef('r_shadow'), F('rogue', 5))).toMatchObject({ tier: 'single' });
    expect(matchRow(rowDef('r_shadow'), F('rogue', 5, 6, 5))).toMatchObject({ tier: 'feed' });
    expect(matchRow(rowDef('r_shadow'), F('rogue', 5, 6, 5, 6))).toMatchObject({ tier: 'area' });
    // v2.2: the blade row tops out at the 3-dice step
    expect(matchRow(rowDef('r_blade'), F('rogue', 2, 3, 4, 2))).toMatchObject({ tier: 'feed' });
    expect(rowDef('r_blade').tierRule.steps).toHaveLength(2);
    expect(matchRow(rowDef('r_poison'), F('rogue', 1, 1, 1))).toMatchObject({ tier: 'feed' });
    expect(matchRow(rowDef('r_dance'), F('rogue', 5))).toBeNull();
    expect(matchRow(rowDef('r_knife'), F('rogue', 3))).toMatchObject({ tier: 'single' });
    expect(matchRow(rowDef('r_knife'), F('rogue', 3, 3))).toBeNull();
  });
});

describe('v2.2 tierCount', () => {
  it("元素交汇 counts every die handed in ('all'); 怒行 companions do not raise the tier", () => {
    expect(rowDef('m_mix').tierCount).toBe('all');
    expect(matchRow(rowDef('m_mix'), F('mage', 1, 2, 3, 4, 5))).toMatchObject({ count: 5 });
    expect(rowDef('w_fury').tierCount).toBe('matching');
    const m = matchRow(rowDef('w_fury'), F('warrior', 6, 1, 2));
    if (m) expect(m.count).toBe(1);
  });
});
