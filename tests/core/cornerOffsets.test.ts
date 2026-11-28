import { describe, expect, it } from 'vitest';
import { shiftIntoCorners } from '../../src/core/geometry/cornerOffsets';
import { vec3 } from '../../src/core/geometry/vector';

describe('shiftIntoCorners', () => {
  const ownerNormal = vec3(1, 0, 0);
  const segment = { start: vec3(0, 0, 0), end: vec3(40, 0, 0) };
  it('flyttar en sträcka i ett hörn en strängradie ut från den andra ytan', () => {
    const shifted = shiftIntoCorners(segment, ownerNormal, () => vec3(0, 0, 1), 2);
    expect(shifted).toEqual([{ start: vec3(2, 0, 2), end: vec3(42, 0, 2) }]);
  });

  it('lämnar sträckan där den inte ligger i ett hörn och delar den där hörnet slutar', () => {
    const shifted = shiftIntoCorners(segment, ownerNormal, (point) => (point.x < 20 ? vec3(0, 0, 1) : undefined), 2);
    expect(shifted).toHaveLength(2);
    expect(shifted[0]?.start).toEqual(vec3(2, 0, 2));
    expect(shifted[1]?.end).toEqual(vec3(40, 0, 0));
  });

  it('lyfter en uppåtvänd yta rakt upp i stället för längs normalen, så att en nock inte glider isär', () => {
    const tilted = (x: number) => vec3(x, 0.7, 0.7);
    const left = shiftIntoCorners(segment, tilted(-0.7), () => vec3(0, 0, 1), 2);
    const right = shiftIntoCorners(segment, tilted(0.7), () => vec3(0, 0, 1), 2);
    expect(left).toEqual(right);
    expect(left[0]?.start).toEqual(vec3(0, 2, 2));
  });
});
