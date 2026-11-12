import { checkHands, handMultiplier, handTier, handCandidates } from '../src/core/hands';

const H = (...v: number[]) => checkHands(v.map(value => ({ value })));

describe('checkHands', () => {
  it.each([
    [[5], ['普通攻击']], [[2, 5], ['普通攻击']], [[4, 4], ['对子']], [[3, 4, 5], ['顺子']], [[2, 2, 2], ['三条']],
    [[1, 1, 6, 6], ['连对']], [[3, 4, 5, 6], ['4顺']], [[6, 6, 6, 6], ['四条']], [[2, 2, 2, 5, 5], ['葫芦']],
    [[1, 2, 3, 4, 5], ['5顺']], [[1, 1, 2, 2, 3, 3], ['三连对']], [[1, 2, 3, 4, 5, 6], ['6顺']], [[4, 4, 4, 1, 1, 1], ['大葫芦']],
    [[6, 6, 6, 6, 2, 2], ['大葫芦']], [[3, 3, 3, 3, 3], ['五条']], [[1, 1, 1, 1, 1, 1], ['六条']],
  ])('%j → %j', (v, hands) => { expect(H(...(v as number[])).activeHands).toEqual(hands); });

  // v6 counts n over all selected dice, so an ignored die breaks the pair; waiting for docs/规则对照_阶段1.md to confirm the original
  it.todo('ignoreForHandType: does an ignored die still count toward n?');
  it('multiplier and tier', () => {
    expect(handMultiplier(H(4, 4))).toBeCloseTo(1.8);
    expect(handMultiplier(H(1, 2, 3, 4, 5, 6))).toBeCloseTo(3.5);
    expect(handTier(H(6))).toBe(0); expect(handTier(H(6, 6))).toBe(1); expect(handTier(H(6, 6, 6, 6))).toBe(4);
  });
});

describe('handCandidates', () => {
  it('marks pairs and 3+ runs', () => {
    expect([...handCandidates([1, 4, 4, 6])].sort()).toEqual([1, 2]);
    expect([...handCandidates([2, 3, 4, 6])].sort()).toEqual([0, 1, 2]);
    expect(handCandidates([1, 3, 6]).size).toBe(0);
  });
});
