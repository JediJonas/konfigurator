import { describe, expect, it } from 'vitest';
import type { Design } from '../../../src/core/model/design';
import { addChildInstance, findInstance } from '../../../src/core/model/instanceTree';
import { listViolations } from '../../../src/core/rules/evaluateDesign';
import { setParamWithinRules } from '../../../src/core/rules/paramAdjustment';
import { proposeChild } from '../../../src/core/rules/placement';
import { gingerbreadDomain } from '../../../src/domains/gingerbread';
import { SECTION_TYPE_ID } from '../../../src/domains/gingerbread/objects/section';
import { simpleHousePreset } from '../../../src/domains/gingerbread/presets/simpleHouse';

/** Ursprungsläget med en föreslagen tillbyggnad (sadeltak 45°) på främre gaveln. */
function startWithFrontExtension(): Design {
  const design = simpleHousePreset.create();
  const proposal = proposeChild(design, gingerbreadDomain, { parentId: 'S1', socketId: 'gable-front', objectTypeId: SECTION_TYPE_ID });
  return { ...design, root: addChildInstance(design.root, 'S1', proposal.instance) };
}

function setExtensionParam(design: Design, key: string, value: unknown): Design {
  return setParamWithinRules(design, gingerbreadDomain, { instanceId: 'S2', key, value });
}

function listErrors(design: Design): string[] {
  return listViolations(design, gingerbreadDomain, (key) => key)
    .filter((violation) => violation.level === 'error')
    .map((violation) => violation.message);
}

function paramsOf(design: Design): Record<string, unknown> {
  return findInstance(design.root, 'S2')?.params ?? {};
}

describe('byte av taktyp med en ärvd lutning', () => {
  it('ger pulpettaket på gaveln den brantaste lutningen som ryms', () => {
    const design = setExtensionParam(startWithFrontExtension(), 'roof', 'shed');
    const roofPitch = paramsOf(design).roofPitch as number;
    expect(paramsOf(design).roof).toBe('shed');
    expect(listErrors(design)).toEqual([]);
    expect(roofPitch).toBeLessThan(45);
    // En grad brantare går inte, så det är den närmaste lutningen som klarar reglerna.
    expect(listErrors(setExtensionParam(design, 'roofPitch', roofPitch + 1))).not.toEqual([]);
  });

  it('behåller lutningen när den nya taktypen ryms med den', () => {
    for (const roof of ['hip', 'mansard', 'flat']) {
      const design = setExtensionParam(startWithFrontExtension(), 'roof', roof);
      expect(paramsOf(design)).toMatchObject({ roof, roofPitch: 45 });
      expect(listErrors(design)).toEqual([]);
    }
  });

  it('ändrar bara fältet när ett tal ändras', () => {
    const design = setExtensionParam(startWithFrontExtension(), 'roofPitch', 60);
    expect(paramsOf(design)).toMatchObject({ roof: 'gable', roofPitch: 60 });
  });

  it('ställer sektionen bredvid väggen när taktypen bara går på fatet', () => {
    const design = setExtensionParam(startWithFrontExtension(), 'roof', 'spire4');
    expect(paramsOf(design)).toMatchObject({ roof: 'spire4' });
    expect(findInstance(design.root, 'S2')?.attachment?.socketId).toBe('beside-gable-front');
    expect(listErrors(design)).toEqual([]);
  });
});
