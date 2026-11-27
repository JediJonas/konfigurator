import { multiplyMatrices, transformPoint, translationMatrix } from '../../core/geometry/matrix';
import { vec3 } from '../../core/geometry/vector';
import type { Vec3 } from '../../core/geometry/vector';
import type { Part } from '../../core/model/part';
import type { PickArea } from './pickAreas';

/** Hur mycket huset flyttas längs golvet i 3D-vyn (x och z i världen), i mm. */
export interface FloorOffset {
  x: number;
  z: number;
}

const NO_OFFSET: FloorOffset = { x: 0, z: 0 };

/**
 * Flytten som ställer husets mitt sett uppifrån, med alla tillbyggnader,
 * sektioner och takutsprång, mitt på fatet. Mitten är mitten av rutan runt
 * alla delar, så att huset har lika långt till fatets kant åt båda hållen.
 */
export function measurePlateCenteringOffset(parts: readonly Part[]): FloorOffset {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const part of parts) {
    for (const point of part.outline) {
      for (const depth of [0, part.thickness]) {
        const world = transformPoint(part.transform, vec3(point.x, point.y, depth));
        minX = Math.min(minX, world.x);
        maxX = Math.max(maxX, world.x);
        minZ = Math.min(minZ, world.z);
        maxZ = Math.max(maxZ, world.z);
      }
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minZ)) return NO_OFFSET;
  return { x: -(minX + maxX) / 2, z: -(minZ + maxZ) / 2 };
}

/** Delarna flyttade längs golvet; bara 3D-vyn använder dem, ritningen påverkas inte. */
export function shiftParts(parts: Part[], offset: FloorOffset): Part[] {
  if (offset.x === 0 && offset.z === 0) return parts;
  const shift = translationMatrix(vec3(offset.x, 0, offset.z));
  return parts.map((part) => ({ ...part, transform: multiplyMatrices(shift, part.transform) }));
}

export function shiftPickAreas(areas: PickArea[], offset: FloorOffset): PickArea[] {
  if (offset.x === 0 && offset.z === 0) return areas;
  return areas.map((area) => ({ ...area, region: area.region.map((point) => shiftPoint(point, offset)) }));
}

function shiftPoint(point: Vec3, offset: FloorOffset): Vec3 {
  return vec3(point.x + offset.x, point.y, point.z + offset.z);
}
