import type { Vec3 } from './vector';

/**
 * 4 × 4-matris i kolumnordning, samma ordning som three.js `Matrix4.fromArray`,
 * så att 3D-vyn kan använda den direkt utan att räkna om något.
 */
export type Matrix4 = readonly number[];

export function identityMatrix(): Matrix4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export function translationMatrix(offset: Vec3): Matrix4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, offset.x, offset.y, offset.z, 1];
}

export function rotationYMatrix(radians: number): Matrix4 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [cos, 0, -sin, 0, 0, 1, 0, 0, sin, 0, cos, 0, 0, 0, 0, 1];
}

/** Matris som tar delens lokala axlar (u, v, normal) och origo till världen. */
export function basisMatrix(u: Vec3, v: Vec3, normal: Vec3, origin: Vec3): Matrix4 {
  return [u.x, u.y, u.z, 0, v.x, v.y, v.z, 0, normal.x, normal.y, normal.z, 0, origin.x, origin.y, origin.z, 1];
}

/** a × b: först b, sedan a. */
export function multiplyMatrices(a: Matrix4, b: Matrix4): Matrix4 {
  const result: number[] = new Array<number>(16).fill(0);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += at(a, k * 4 + row) * at(b, column * 4 + k);
      result[column * 4 + row] = sum;
    }
  }
  return result;
}

export function transformPoint(matrix: Matrix4, point: Vec3): Vec3 {
  return {
    x: at(matrix, 0) * point.x + at(matrix, 4) * point.y + at(matrix, 8) * point.z + at(matrix, 12),
    y: at(matrix, 1) * point.x + at(matrix, 5) * point.y + at(matrix, 9) * point.z + at(matrix, 13),
    z: at(matrix, 2) * point.x + at(matrix, 6) * point.y + at(matrix, 10) * point.z + at(matrix, 14),
  };
}

function at(matrix: Matrix4, index: number): number {
  return matrix[index] ?? 0;
}
