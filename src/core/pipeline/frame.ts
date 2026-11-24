import type { Matrix4 } from '../geometry/matrix';
import { basisMatrix, transformPoint } from '../geometry/matrix';
import type { Vec2, Vec3 } from '../geometry/vector';
import { cross3, dot3, subtract3 } from '../geometry/vector';
import type { Frame3 } from '../model/objectType';

/** Lokalt x → u, lokalt y → normal, lokalt z → u × normal. */
export function frameMatrix(frame: Frame3): Matrix4 {
  return basisMatrix(frame.u, frame.normal, frameV(frame), frame.origin);
}

/** Kopplingspunktens andra riktning i planet, u × normal. */
export function frameV(frame: Frame3): Vec3 {
  return cross3(frame.u, frame.normal);
}

/** Flyttar en kopplingspunkts koordinatsystem med en placering, t.ex. från ägarens koordinater till världen. */
export function transformFrame(matrix: Matrix4, frame: Frame3): Frame3 {
  const origin = transformPoint(matrix, frame.origin);
  const along = (direction: Vec3) => subtract3(transformPoint(matrix, { x: frame.origin.x + direction.x, y: frame.origin.y + direction.y, z: frame.origin.z + direction.z }), origin);
  return { origin, u: along(frame.u), normal: along(frame.normal) };
}

/** En punkt i världen uttryckt i kopplingspunktens (u, v). */
export function projectOntoFrame(frame: Frame3, point: Vec3): Vec2 {
  const offset = subtract3(point, frame.origin);
  return { x: dot3(offset, frame.u), y: dot3(offset, frameV(frame)) };
}
