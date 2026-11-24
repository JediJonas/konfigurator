import type { Matrix4 } from '../../../core/geometry/matrix';
import { basisMatrix } from '../../../core/geometry/matrix';
import type { Polygon } from '../../../core/geometry/polygon';
import type { Mm, Vec2, Vec3 } from '../../../core/geometry/vector';
import { cross3, vec3 } from '../../../core/geometry/vector';
import type { Part } from '../../../core/model/part';

/** En del innan den har fått objektets id, tjocklek och hål. */
export type PartDraft = Omit<Part, 'sourceInstanceId' | 'holes' | 'thickness'>;

const UP = vec3(0, 1, 0);

/** Delens plan: lokalt x längs `u`, lokalt y längs `v`, tjockleken längs u × v. */
export function planeMatrix(u: Vec3, v: Vec3, origin: Vec3): Matrix4 {
  return basisMatrix(u, v, cross3(u, v), origin);
}

export function rectangle(width: Mm, height: Mm): Polygon {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}

export interface UprightLine {
  /** Ytterkantens början och slut sett uppifrån (y är z). Utsidan ligger till höger om linjen sett uppifrån med z nedåt, dvs. längs u × upp. */
  outerStart: Vec2;
  outerEnd: Vec2;
}

/** Riktningen längs linjen och utåt, i 3D. */
export function uprightDirections(line: UprightLine): { along: Vec3; outward: Vec3; length: Mm } {
  const dx = line.outerEnd.x - line.outerStart.x;
  const dz = line.outerEnd.y - line.outerStart.y;
  const length = Math.hypot(dx, dz);
  const along = vec3(dx / length, 0, dz / length);
  return { along, outward: cross3(along, UP), length };
}

/**
 * Placering för en upprätt del, t.ex. en vägg, som står med ytterkanten längs
 * linjen och tjockleken inåt. Konturens x går längs linjen från början och y uppåt från `base`.
 */
export function uprightTransform(line: UprightLine, thickness: Mm, base: Mm): Matrix4 {
  const { along, outward } = uprightDirections(line);
  const origin = vec3(line.outerStart.x - outward.x * thickness, base, line.outerStart.y - outward.z * thickness);
  return planeMatrix(along, UP, origin);
}
