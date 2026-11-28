import { describe, expect, it } from 'vitest';
import { evaluateDesign } from '../../../src/core/rules/evaluateDesign';
import { gingerbreadDomain } from '../../../src/domains/gingerbread';
import { sectionParams } from '../../../src/domains/gingerbread/objects/sectionParams';
import { simpleHousePreset } from '../../../src/domains/gingerbread/presets/simpleHouse';

describe('mallens hus', () => {
  it('bygger utan fel och varje bit ryms på plåten', () => {
    const { parts, violations } = evaluateDesign(simpleHousePreset.create(), gingerbreadDomain, (key) => key);
    expect(parts.length).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });

  it('är större än schemats standardmått, som sparade hus och länkar räknar med', () => {
    const params = simpleHousePreset.create().root.children[0]?.params;
    const defaults = sectionParams.parse({});
    expect(params).toEqual({ width: 170, depth: 215, wallHeight: 120 });
    expect(defaults).toMatchObject({ width: 140, depth: 180, wallHeight: 100 });
  });
});
