import type { HalfPlane } from '../geometry/halfPlane';
import { clipByHalfPlanes, squareAround } from '../geometry/halfPlane';
import { transformPoint } from '../geometry/matrix';
import { boundsOf } from '../geometry/polygon';
import type { Mm, Vec2, Vec3 } from '../geometry/vector';
import { dot3, subtract3, vec2, vec3 } from '../geometry/vector';
import { subtractRegions } from '../geometry/clipping';
import type { Part } from '../model/part';

/** Halvrummet i världen där `normal · p ≤ offset`, prövat på en viss höjd i delens tjocklek. */
export interface WorldHalfSpace {
  normal: Vec3;
  offset: number;
  /** Var i delens tjocklek villkoret prövas: 0 är delens ena sida och `thickness` den andra. */
  depth: Mm;
}

/** Hur långt utanför delen ett område räknas, så att halvplanen alltid ger ett slutet område. */
const REGION_MARGIN_MM = 1000;

/**
 * Den del av delens plan där alla villkoren gäller, i delens egna
 * koordinater. Villkoren är linjära i världen och därmed i delens plan, så
 * området är konvext. Tomt när villkoren aldrig gäller samtidigt.
 */
export function regionOnPart(part: Part, halfSpaces: readonly WorldHalfSpace[]): Vec2[] {
  const origin = transformPoint(part.transform, vec3(0, 0, 0));
  const alongX = subtract3(transformPoint(part.transform, vec3(1, 0, 0)), origin);
  const alongY = subtract3(transformPoint(part.transform, vec3(0, 1, 0)), origin);
  const alongZ = subtract3(transformPoint(part.transform, vec3(0, 0, 1)), origin);
  const halfPlanes: HalfPlane[] = halfSpaces.map((space) => {
    const base = vec3(origin.x + alongZ.x * space.depth, origin.y + alongZ.y * space.depth, origin.z + alongZ.z * space.depth);
    return { normal: vec2(dot3(space.normal, alongX), dot3(space.normal, alongY)), offset: space.offset - dot3(space.normal, base) };
  });
  const bounds = boundsOf(part.outline);
  const center = vec2((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
  const halfSize = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) + REGION_MARGIN_MM;
  return clipByHalfPlanes(squareAround(center, halfSize), halfPlanes);
}

/**
 * Tar bort områdena från delen. Blir delen flera bitar behålls den som
 * `score` ger högst värde, t.ex. den som når längst bort från ett annat
 * objekt. Ger ingenting när inget av delen blir kvar.
 */
export function removeRegionsFromPart(part: Part, regions: readonly Vec2[][], score: (worldPoints: Vec3[]) => number): Part | undefined {
  if (regions.every((region) => region.length < 3)) return part;
  const pieces = subtractRegions(part, regions);
  const scored = pieces.map((piece) => ({ piece, value: score(piece.outline.map((point) => transformPoint(part.transform, vec3(point.x, point.y, 0)))) }));
  const best = scored.reduce<(typeof scored)[number] | undefined>((top, entry) => (!top || entry.value > top.value ? entry : top), undefined);
  return best && { ...part, outline: best.piece.outline, holes: best.piece.holes };
}
