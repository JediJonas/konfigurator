import { describe, expect, it } from 'vitest';
import { slabFromFaces, doSlabsOverlap } from '../../src/core/geometry/slabOverlap';
import { vec3 } from '../../src/core/geometry/vector';
import type { Vec3 } from '../../src/core/geometry/vector';

const TOLERANCE_MM = 0.05;

/** En liggande platta 10 × 10 mm och 1 mm tjock, med undersidan på höjden `y`. */
function flatSlab(x: number, y: number, z: number) {
  const bottom: Vec3[] = [vec3(x, y, z), vec3(x + 10, y, z), vec3(x + 10, y, z + 10), vec3(x, y, z + 10)];
  return slabFromFaces(bottom, bottom.map((point) => vec3(point.x, point.y + 1, point.z)));
}

/** En platta som lutar 45° längs x. */
function tiltedSlab(y: number) {
  const bottom: Vec3[] = [vec3(0, y, 0), vec3(0, y, 10), vec3(10, y + 10, 10), vec3(10, y + 10, 0)];
  const lift = Math.SQRT1_2;
  return slabFromFaces(bottom, bottom.map((point) => vec3(point.x - lift, point.y + lift, point.z)));
}

describe('plattor som går in i varandra', () => {
  it('räknar plattor som ligger på varandra som att de bara nuddar', () => {
    expect(doSlabsOverlap(flatSlab(0, 0, 0), flatSlab(0, 1, 0), TOLERANCE_MM)).toBe(false);
    expect(doSlabsOverlap(flatSlab(0, 0, 0), flatSlab(10, 0, 0), TOLERANCE_MM)).toBe(false);
  });

  it('hittar plattor som går in i varandra', () => {
    expect(doSlabsOverlap(flatSlab(0, 0, 0), flatSlab(5, 0.5, 5), TOLERANCE_MM)).toBe(true);
  });

  it('hittar en lutande platta som går genom en liggande', () => {
    expect(doSlabsOverlap(tiltedSlab(0), flatSlab(0, 5, 0), TOLERANCE_MM)).toBe(true);
    expect(doSlabsOverlap(tiltedSlab(0), flatSlab(0, 20, 0), TOLERANCE_MM)).toBe(false);
  });

  it('skiljer plattor som bara skulle mötas om de vore större, åt sidan av lutningen', () => {
    // Den liggande plattan ligger ovanför den lutande plattans låga ände men vid sidan av den höga.
    expect(doSlabsOverlap(tiltedSlab(0), flatSlab(-12, 2, 0), TOLERANCE_MM)).toBe(false);
  });
});
