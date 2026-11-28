import { describe, expect, it } from 'vitest';
import type { Design, Instance } from '../../src/core/model/design';
import { findInstance } from '../../src/core/model/instanceTree';
import { evaluateDesign } from '../../src/core/rules/evaluateDesign';
import { setParamWithinRules } from '../../src/core/rules/paramAdjustment';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { simpleHousePreset } from '../../src/domains/gingerbread/presets/simpleHouse';
import { chimneyOn } from './chimneyFixtures';
import { dormerOn } from './dormerFixtures';

/** Mallens hus med en takkupa med fönster på högra takfallet och en skorsten på det vänstra. */
function houseWithDormerAndChimney(): Design {
  const design = simpleHousePreset.create();
  const window: Instance = { id: 'F1', type: 'gb.window', params: { width: 15, height: 15, sillHeight: 5 }, attachment: { socketId: 'gable-front', u: 0, v: 0, rotationDegrees: 0 }, children: [] };
  design.root.children[0]?.children.push({ ...dormerOn('roof-right'), children: [window] }, chimneyOn('roof-left'));
  return design;
}

function setRoofParam(design: Design, key: string, value: unknown): Design {
  return setParamWithinRules(design, gingerbreadDomain, { instanceId: 'S1', key, value });
}

const socketOf = (design: Design, instanceId: string) => findInstance(design.root, instanceId)?.attachment?.socketId;
const evaluate = (design: Design) => evaluateDesign(design, gingerbreadDomain, (key) => key);

describe('takkupa och skorsten när taket ändras', () => {
  it('flyttar till var sitt takfall när taket vrids 90°, och tillbaka', () => {
    const turned = setRoofParam(houseWithDormerAndChimney(), 'isRoofTurned', true);
    expect(socketOf(turned, 'K1')).toBe('roof-front');
    expect(socketOf(turned, 'SK1')).toBe('roof-back');
    // Fönstret i kupan följer med.
    expect(socketOf(turned, 'F1')).toBe('gable-front');
    expect(() => evaluate(turned)).not.toThrow();
    const back = setRoofParam(turned, 'isRoofTurned', false);
    expect(socketOf(back, 'K1')).toBe('roof-right');
    expect(socketOf(back, 'SK1')).toBe('roof-left');
  });

  it('flyttar till takfallen på en annan taktyp med lutning', () => {
    for (const roof of ['shed', 'mansard', 'hip']) {
      const changed = setRoofParam(houseWithDormerAndChimney(), 'roof', roof);
      expect(findInstance(changed.root, 'K1'), roof).toBeDefined();
      expect(() => evaluate(changed), roof).not.toThrow();
    }
  });

  it('tar bort kupan och skorstenen när taket inte har några takfall', () => {
    for (const roof of ['flat', 'spire4']) {
      const changed = setRoofParam(houseWithDormerAndChimney(), 'roof', roof);
      expect(findInstance(changed.root, 'K1'), roof).toBeUndefined();
      expect(findInstance(changed.root, 'SK1'), roof).toBeUndefined();
      expect(() => evaluate(changed), roof).not.toThrow();
    }
  });
});
