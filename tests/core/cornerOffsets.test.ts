import { describe, expect, it } from 'vitest';
import { shiftIntoCorners } from '../../src/core/geometry/cornerOffsets';
import { vec3 } from '../../src/core/geometry/vector';

describe('shiftIntoCorners', () => {
  const segment = { start: vec3(0, 0, 0), end: vec3(40, 0, 0) };
  const ownerNormal = vec3(0, 1, 0);

  it('flyttar en sträcka i ett hörn en strängradie från varje yta', () => {
    const shifted = shiftIntoCorners(segment, ownerNormal, () => vec3(0, 0, 1), 2);
    expect(shifted).toEqual([{ start: vec3(0, 2, 2), end: vec3(40, 2, 2) }]);
  });

  it('lämnar sträckan där den inte ligger i ett hörn och delar den där hörnet slutar', () => {
    const shifted = shiftIntoCorners(segment, ownerNormal, (point) => (point.x < 20 ? vec3(0, 0, 1) : undefined), 2);
    expect(shifted).toHaveLength(2);
    expect(shifted[0]?.start).toEqual(vec3(0, 2, 2));
    expect(shifted[1]?.end).toEqual(vec3(40, 0, 0));
  });
});
