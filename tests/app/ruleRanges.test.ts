import { describe, expect, it } from 'vitest';
import type { RangeResult } from '../../src/app/rules/ruleRanges';
import { computeRanges, createLatestRequests, OFFSET_KEY } from '../../src/app/rules/ruleRanges';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { designWithExtensions, extension } from '../domains/extensionFixtures';

const request = {
  id: 1,
  design: designWithExtensions(extension('side-right')),
  instanceId: 'S2',
  offset: { currentU: 0, maxReachMm: 140 },
  fields: [
    { param: 'wallHeight', current: 40, step: 5, min: 20, max: 300 },
    { param: 'width', current: 80, step: 5, min: 60, max: 400 },
  ],
};

describe('fältens gränser vid sidan av', () => {
  it('ger läget först och sedan fälten i ordning, ett i taget', async () => {
    const results: RangeResult[] = [];
    await computeRanges(request, gingerbreadDomain, (result) => results.push(result), async () => false);
    expect(results.map((result) => result.key)).toEqual([OFFSET_KEY, 'wallHeight', 'width']);
    expect(results[0]?.range).toEqual({ min: -125, max: 125, gaps: [] });
  });

  it('slutar när en ny begäran tar över', async () => {
    const results: RangeResult[] = [];
    await computeRanges(request, gingerbreadDomain, (result) => results.push(result), async () => true);
    expect(results.map((result) => result.key)).toEqual([OFFSET_KEY]);
  });

  it('låter en ny begäran för sektionen ta över bara sektionens, inte fönstrets på väggen', () => {
    const latest = createLatestRequests();
    const window = { id: 1, instanceId: 'F1' };
    const section = { id: 2, instanceId: 'S1' };
    latest.mark(window);
    latest.mark(section);
    expect(latest.isOutdated(window)).toBe(false);
    expect(latest.isOutdated(section)).toBe(false);
    latest.mark({ id: 3, instanceId: 'S1' });
    expect(latest.isOutdated(section)).toBe(true);
    expect(latest.isOutdated(window)).toBe(false);
  });
});
