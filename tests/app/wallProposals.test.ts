import { describe, expect, it } from 'vitest';
import { computeWallProposals } from '../../src/app/rules/wallProposals';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { designWithExtensions } from '../domains/extensionFixtures';
import { doorOn } from '../domains/openingFixtures';

describe('knapparna under en vägg, räknade vid sidan av', () => {
  it('ger sektion, fönster och dörr på en tom vägg, men ingen skorsten', () => {
    const result = computeWallProposals({ id: 7, design: designWithExtensions(), parentId: 'S1', socketId: 'gable-front' }, gingerbreadDomain, (key) => key);
    expect(result).toMatchObject({ requestId: 7, wallKey: 'S1|gable-front' });
    expect(result.states.map((state) => [state.objectTypeId, state.canAdd])).toEqual([
      ['gb.section', true],
      ['gb.window', true],
      ['gb.door', true],
    ]);
  });

  it('säger varför en andra dörr inte går', () => {
    const result = computeWallProposals({ id: 1, design: designWithExtensions(doorOn('gable-front')), parentId: 'S1', socketId: 'gable-front' }, gingerbreadDomain, (key) => key);
    expect(result.states.find((state) => state.objectTypeId === 'gb.door')).toEqual({ objectTypeId: 'gb.door', canAdd: false, blockingMessage: 'rule.oneDoorPerWall' });
  });
});
