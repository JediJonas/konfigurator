import { describe, expect, it } from 'vitest';
import { overlapArea, subtractRegion } from '../../src/core/geometry/clipping';
import { convexHull, isPointInPolygon } from '../../src/core/geometry/hull';
import { signedArea } from '../../src/core/geometry/polygon';
import { vec2 } from '../../src/core/geometry/vector';

const square = (x: number, y: number, size: number) => [vec2(x, y), vec2(x + size, y), vec2(x + size, y + size), vec2(x, y + size)];

describe('borttagning av områden', () => {
  const wall = { outline: [vec2(0, 0), vec2(100, 0), vec2(100, 50), vec2(0, 50)], holes: [] };

  it('ger ett hål när området ligger inne i delen', () => {
    const [piece, ...rest] = subtractRegion(wall, square(40, 10, 20));
    expect(rest).toEqual([]);
    expect(piece?.holes).toHaveLength(1);
    expect(signedArea(piece?.holes[0] ?? [])).toBeLessThan(0);
  });

  it('ger ett hack i konturen när området går genom kanten', () => {
    const [piece] = subtractRegion(wall, [vec2(40, -1), vec2(60, -1), vec2(60, 30), vec2(40, 30)]);
    expect(piece?.holes).toEqual([]);
    expect(piece?.outline).toHaveLength(8);
    expect(signedArea(piece?.outline ?? [])).toBeCloseTo(100 * 50 - 20 * 30);
  });

  it('delar delen när området går tvärs över', () => {
    expect(subtractRegion(wall, [vec2(40, -1), vec2(60, -1), vec2(60, 51), vec2(40, 51)])).toHaveLength(2);
  });

  it('mäter överlapp och räknar nuddande former som noll', () => {
    expect(overlapArea(square(0, 0, 10), square(5, 5, 10))).toBeCloseTo(25);
    expect(overlapArea(square(0, 0, 10), square(10, 0, 10))).toBe(0);
  });
});

describe('konvext hölje', () => {
  it('tar bort punkter inne i höljet', () => {
    const hull = convexHull([...square(0, 0, 10), vec2(5, 5), vec2(5, 0)]);
    expect(hull).toHaveLength(4);
    expect(signedArea(hull)).toBeCloseTo(100);
  });

  it('räknar punkter på kanten som innanför', () => {
    expect(isPointInPolygon(vec2(10.01, 5), square(0, 0, 10), 0.05)).toBe(true);
    expect(isPointInPolygon(vec2(10.5, 5), square(0, 0, 10), 0.05)).toBe(false);
    expect(isPointInPolygon(vec2(5, 5), square(0, 0, 10), 0.05)).toBe(true);
  });
});
