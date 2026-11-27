import { ShapeUtils, Vector2 } from 'three';
import type { Vec3 } from '../../core/geometry/vector';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import { isLeafInstance } from '../ui/socketSelection';

/** En yta i 3D-vyn som öppnar ett objekt när man trycker på den, t.ex. hålet för ett fönster. */
export interface PickArea {
  instanceId: string;
  /** Hörnen i världen, i ordning runt ytan. */
  region: Vec3[];
}

/**
 * Hålen som fönster och dörrar skär i väggen. Ett hål har ingen del att trycka på,
 * så det får en osynlig yta. Luckor och dörrblad är delar och väljs som andra delar.
 */
export function listPickAreas(placed: readonly PlacedInstance[]): PickArea[] {
  return placed.filter(isLeafInstance).flatMap((entry) =>
    entry.modifiers.flatMap((modifier) => (modifier.kind === 'removeRegion' ? [{ instanceId: entry.instance.id, region: modifier.region }] : [])),
  );
}

/** Trianglarna för en plan yta i rymden, som hörnindex tre och tre. */
export function triangulatePlanarRegion(region: readonly Vec3[]): number[] {
  const normal = newellNormal(region);
  // Ytan läggs ned i planet där normalen har störst del, så att den inte blir platt.
  const axis = largestAxis(normal);
  const projected = region.map((point) =>
    axis === 'x' ? new Vector2(point.y, point.z) : axis === 'y' ? new Vector2(point.z, point.x) : new Vector2(point.x, point.y),
  );
  return ShapeUtils.triangulateShape(projected, []).flat();
}

function newellNormal(region: readonly Vec3[]): Vec3 {
  const normal = { x: 0, y: 0, z: 0 };
  region.forEach((point, index) => {
    const next = region[(index + 1) % region.length] ?? point;
    normal.x += (point.y - next.y) * (point.z + next.z);
    normal.y += (point.z - next.z) * (point.x + next.x);
    normal.z += (point.x - next.x) * (point.y + next.y);
  });
  return normal;
}

function largestAxis(vector: Vec3): 'x' | 'y' | 'z' {
  const [x, y, z] = [Math.abs(vector.x), Math.abs(vector.y), Math.abs(vector.z)];
  if (x >= y && x >= z) return 'x';
  return y >= z ? 'y' : 'z';
}
