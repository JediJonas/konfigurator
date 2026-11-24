import type { Matrix4 } from '../geometry/matrix';
import { basisMatrix } from '../geometry/matrix';
import type { Vec3 } from '../geometry/vector';
import type { Frame3 } from '../model/objectType';

/** Lokalt x → u, lokalt y → normal, lokalt z → u × normal. */
export function frameMatrix(frame: Frame3): Matrix4 {
  return basisMatrix(frame.u, frame.normal, cross(frame.u, frame.normal), frame.origin);
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
