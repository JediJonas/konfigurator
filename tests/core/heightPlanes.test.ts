import { describe, expect, it } from 'vitest';
import { clipByHalfPlanes, halfPlaneLeftOf, shrinkHalfPlane } from '../../src/core/geometry/halfPlane';
import type { HeightPlane } from '../../src/core/geometry/heightPlanes';
import { heightPlaneThrough, lowestPlaneRegion, lowestProfileAlong } from '../../src/core/geometry/heightPlanes';
import { signedArea } from '../../src/core/geometry/polygon';
import { vec2, vec3 } from '../../src/core/geometry/vector';

const square = [vec2(-50, -50), vec2(50, -50), vec2(50, 50), vec2(-50, 50)];

describe('halvplan', () => {
  it('klipper en konvex polygon och flyttar gränsen inåt vinkelrätt', () => {
    // Under linjen från (50, 0) till (−50, 0), flyttad 10 mm nedåt.
    const below = shrinkHalfPlane(halfPlaneLeftOf(vec2(50, 0), vec2(-50, 0)), 10);
    const clipped = clipByHalfPlanes(square, [below]);
    expect(Math.max(...clipped.map((point) => point.y))).toBeCloseTo(-10);
    expect(Math.abs(signedArea(clipped))).toBeCloseTo(100 * 40);
  });

  it('ger ingenting när halvplanen inte möts', () => {
    expect(clipByHalfPlanes(square, [{ normal: vec2(1, 0), offset: -60 }])).toEqual([]);
  });
});

describe('höjdplan', () => {
  // Två plan som ett sadeltak: 45° ner åt båda håll från en nock på 50 mm.
  const right: HeightPlane = { slopeX: -1, slopeZ: 0, height: 50 };
  const left: HeightPlane = { slopeX: 1, slopeZ: 0, height: 50 };

  it('delar planen där varje plan är lägst', () => {
    const region = lowestPlaneRegion([right, left], 0, square);
    expect(Math.min(...region.map((point) => point.x))).toBeCloseTo(0);
    expect(Math.max(...region.map((point) => point.y))).toBeCloseTo(50);
    for (const point of region) expect(point.y).toBeCloseTo(50 - point.x);
  });

  it('ger brytpunkterna längs en linje, med nocken mitt på', () => {
    const profile = lowestProfileAlong([right, left], vec2(-50, 0), vec2(50, 0));
    expect(profile).toHaveLength(3);
    expect(profile[1]?.x).toBeCloseTo(50);
    expect(profile[1]?.y).toBeCloseTo(50);
    expect(profile[0]?.y).toBeCloseTo(0);
  });

  it('ger en rak linje när ett plan är lägst hela vägen', () => {
    expect(lowestProfileAlong([right, left], vec2(10, -50), vec2(10, 50)).map((point) => point.y)).toEqual([40, 40]);
  });

  it('räknar ut planet genom tre punkter', () => {
    const plane = heightPlaneThrough(vec3(0, 10, 0), vec3(10, 20, 0), vec3(0, 10, 10));
    expect(plane.slopeX).toBeCloseTo(1);
    expect(plane.slopeZ).toBeCloseTo(0);
    expect(plane.height).toBeCloseTo(10);
  });
});
