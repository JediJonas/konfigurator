import { describe, expect, it } from 'vitest';
import { growPolygon } from '../../src/core/geometry/growPolygon';
import { vec2 } from '../../src/core/geometry/vector';

describe('growPolygon', () => {
  it('flyttar kanterna ut åt alla håll, oavsett riktning på punkterna', () => {
    const square = [vec2(0, 0), vec2(10, 0), vec2(10, 10), vec2(0, 10)];
    const expected = [vec2(-2, -2), vec2(12, -2), vec2(12, 12), vec2(-2, 12)];
    expect(growPolygon(square, 2)).toEqual(expected);
    expect(growPolygon([...square].reverse(), 2)).toEqual([...expected].reverse());
  });

  it('förminskar polygonen när avståndet är negativt', () => {
    const square = [vec2(0, 0), vec2(10, 0), vec2(10, 10), vec2(0, 10)];
    expect(growPolygon(square, -2)).toEqual([vec2(2, 2), vec2(8, 2), vec2(8, 8), vec2(2, 8)]);
  });
});
