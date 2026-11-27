import { convexHull } from '../../core/geometry/hull';
import { transformPoint } from '../../core/geometry/matrix';
import type { Polygon } from '../../core/geometry/polygon';
import { vec2, vec3 } from '../../core/geometry/vector';
import type { Part } from '../../core/model/part';

/** Hur nära golvet en väggs nederkant räknas som på golvet. */
const FLOOR_TOLERANCE_MM = 0.5;
/** En del räknas som vägg när dess plan står så nära lodrätt (y-axeln i världen nästan rakt upp). */
const UPRIGHT_TOLERANCE = 1e-6;

/**
 * Golvet innanför väggarna på varje objekt, sett uppifrån (polygonens y är
 * världens z). Räknas från väggarnas nederkanter, så att golvet inne i huset
 * kan ritas mörkare i 3D-vyn. En tillbyggnad saknar vägg mot huset, men dess
 * tre väggar räcker för att täcka golvet.
 */
export function listInsideFloors(parts: readonly Part[]): Polygon[] {
  const corners = new Map<string, { x: number; y: number }[]>();
  for (const part of parts) {
    if (!part.hasInsideAtZero || !isUpright(part)) continue;
    const onFloor = part.outline
      .map((point) => transformPoint(part.transform, vec3(point.x, point.y, 0)))
      .concat(part.outline.map((point) => transformPoint(part.transform, vec3(point.x, point.y, part.thickness))))
      .filter((point) => Math.abs(point.y) < FLOOR_TOLERANCE_MM)
      .map((point) => vec2(point.x, point.z));
    corners.set(part.sourceInstanceId, [...(corners.get(part.sourceInstanceId) ?? []), ...onFloor]);
  }
  return [...corners.values()].map((points) => convexHull(points)).filter((floor) => floor.length >= 3);
}

function isUpright(part: Part): boolean {
  // Delens plan är lodrätt när dess normal (lokal z) inte har någon höjdled.
  return Math.abs(part.transform[9] ?? 0) < UPRIGHT_TOLERANCE;
}
