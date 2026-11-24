import { describe, expect, it } from 'vitest';
import { basisMatrix, invertRigidMatrix, multiplyMatrices, rotationYMatrix, transformPoint, translationMatrix } from '../../src/core/geometry/matrix';
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

describe('invers av en placering', () => {
  it('tar tillbaka en punkt till delens eget plan', () => {
    const matrix = basisMatrix({ x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 66, y: 0, z: 86 });
    const point = { x: 12, y: 34, z: 4 };
    const back = transformPoint(invertRigidMatrix(matrix), transformPoint(matrix, point));
    expect(back.x).toBeCloseTo(point.x);
    expect(back.y).toBeCloseTo(point.y);
    expect(back.z).toBeCloseTo(point.z);
  });
});
