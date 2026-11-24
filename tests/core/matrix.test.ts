import { describe, expect, it } from 'vitest';
import { basisMatrix, multiplyMatrices, rotationYMatrix, transformPoint, translationMatrix } from '../../src/core/geometry/matrix';
import { vec3 } from '../../src/core/geometry/vector';

describe('matriser', () => {
  it('flyttar en punkt', () => {
    expect(transformPoint(translationMatrix(vec3(1, 2, 3)), vec3(1, 1, 1))).toEqual(vec3(2, 3, 4));
  });

  it('vrider moturs sett uppifrån runt y', () => {
    const turned = transformPoint(rotationYMatrix(Math.PI / 2), vec3(1, 0, 0));
    expect(turned.x).toBeCloseTo(0);
    expect(turned.z).toBeCloseTo(-1);
  });

  it('gör först högra matrisen i en produkt', () => {
    const moveThenTurn = multiplyMatrices(rotationYMatrix(Math.PI / 2), translationMatrix(vec3(1, 0, 0)));
    const point = transformPoint(moveThenTurn, vec3(0, 0, 0));
    expect(point.x).toBeCloseTo(0);
    expect(point.z).toBeCloseTo(-1);
  });

  it('tar lokala axlar till basens axlar', () => {
    const matrix = basisMatrix(vec3(0, 0, 1), vec3(0, 1, 0), vec3(-1, 0, 0), vec3(5, 0, 0));
    expect(transformPoint(matrix, vec3(1, 0, 0))).toEqual(vec3(5, 0, 1));
    expect(transformPoint(matrix, vec3(0, 0, 1))).toEqual(vec3(4, 0, 0));
  });
});
