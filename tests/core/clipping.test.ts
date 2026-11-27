import { describe, expect, it } from 'vitest';
import { addRegion, overlapArea, subtractRegion, subtractRegions } from '../../src/core/geometry/clipping';
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

  it('lämnar ingen udd utan yta där två områden nästan möts', () => {
    const [piece, ...rest] = subtractRegions(wall, [
      [vec2(-1, 20), vec2(50, 20), vec2(50, 60), vec2(-1, 60)],
      [vec2(50 + 1e-9, 20), vec2(101, 20), vec2(101, 60), vec2(50 + 1e-9, 60)],
    ]);
    expect(rest).toEqual([]);
    expect(piece?.outline).toHaveLength(4);
    expect(signedArea(piece?.outline ?? [])).toBeCloseTo(100 * 20);
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

describe('borttagning av flera områden', () => {
  const wall = { outline: [vec2(0, 0), vec2(100, 0), vec2(100, 50), vec2(0, 50)], holes: [] };

  it('tar bort alla områden och hoppar över de som saknar yta', () => {
    const pieces = subtractRegions(wall, [square(-1, -1, 11), square(90, 40, 20), [vec2(50, 0), vec2(60, 0)]]);
    expect(pieces).toHaveLength(1);
    expect(signedArea(pieces[0]?.outline ?? [])).toBeCloseTo(100 * 50 - 10 * 10 - 10 * 10);
  });
});

describe('addRegion', () => {
  it('förlänger en rektangel med ett område som möter den', () => {
    const shape = { outline: [vec2(0, 0), vec2(10, 0), vec2(10, 5), vec2(0, 5)], holes: [] };
    const extended = addRegion(shape, [vec2(10, 0), vec2(14, 0), vec2(14, 5), vec2(10, 5)]);
    expect(extended.outline).toHaveLength(4);
    expect(Math.max(...extended.outline.map((point) => point.x))).toBeCloseTo(14);
  });

  it('ger tillbaka formen när området inte når fram', () => {
    const shape = { outline: [vec2(0, 0), vec2(10, 0), vec2(10, 5), vec2(0, 5)], holes: [] };
    expect(addRegion(shape, [vec2(20, 0), vec2(24, 0), vec2(24, 5), vec2(20, 5)]).outline).toEqual(shape.outline);
  });
});
