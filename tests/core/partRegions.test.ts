import { describe, expect, it } from 'vitest';
import { identityMatrix } from '../../src/core/geometry/matrix';
import { vec2, vec3 } from '../../src/core/geometry/vector';
import type { Part } from '../../src/core/model/part';
import { regionOnPart, regionThroughPart } from '../../src/core/pipeline/partRegions';

const PLATE: Part = {
  id: 'P',
  sourceInstanceId: 'P',
  labelKey: 'P',
  outline: [vec2(0, 0), vec2(20, 0), vec2(20, 20), vec2(0, 20)],
  holes: [],
  thickness: 4,
  transform: identityMatrix(),
  buildStep: 0,
};

/** En kropp med en sned sida, x + z ≥ 12, och ovansidan z ≤ 1, mitt i plattans tjocklek. */
const SLANTED_BODY = [
  { normal: vec3(-1, 0, -1), offset: -12 },
  { normal: vec3(0, 0, 1), offset: 1 },
];

describe('område genom en del', () => {
  it('fångar en kropp som går in genom sidan och ut genom ovansidan mitt i tjockleken', () => {
    const minX = (region: { x: number }[]) => Math.min(...region.map((point) => point.x));
    // Prövad på sidorna var för sig når kroppen bara x = 12 på undersidan och inte alls på ovansidan.
    expect(minX(regionOnPart(PLATE, SLANTED_BODY.map((space) => ({ ...space, depth: 0 }))))).toBeCloseTo(12);
    expect(regionOnPart(PLATE, SLANTED_BODY.map((space) => ({ ...space, depth: 4 }))).length).toBeLessThan(3);
    // Genom tjockleken når den x = 11, där z = 1.
    expect(minX(regionThroughPart(PLATE, SLANTED_BODY))).toBeCloseTo(11);
  });

  it('är tomt när kroppen ligger helt ovanför delen', () => {
    expect(regionThroughPart(PLATE, [{ normal: vec3(0, 0, -1), offset: -5 }]).length).toBeLessThan(3);
  });
});
