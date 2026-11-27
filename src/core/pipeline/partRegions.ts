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

/** Under så här mycket räknas ett villkor som oberoende av djupet i delen. */
const DEPTH_INDEPENDENT_EPSILON = 1e-9;

/**
 * Den del av delens plan där någon punkt genom delens tjocklek ligger i
 * kroppen som villkoren ger, i delens egna koordinater. Till skillnad från
 * att pröva delens båda sidor var för sig fångar det också en del som går in
 * i kroppen genom dess sida och ut genom dess ovansida mitt i tjockleken.
 * Djupet räknas bort ur villkoren (Fourier–Motzkin), så området är konvext.
 */
export function regionThroughPart(part: Part, halfSpaces: readonly Pick<WorldHalfSpace, 'normal' | 'offset'>[]): Vec2[] {
  const origin = transformPoint(part.transform, vec3(0, 0, 0));
  const alongX = subtract3(transformPoint(part.transform, vec3(1, 0, 0)), origin);
  const alongY = subtract3(transformPoint(part.transform, vec3(0, 1, 0)), origin);
  const alongZ = subtract3(transformPoint(part.transform, vec3(0, 0, 1)), origin);
  // Varje villkor blir a · (x, y) + b · djup ≤ c, och djupet ligger mellan 0 och tjockleken.
  const constraints = [
    ...halfSpaces.map((space) => ({
      a: vec2(dot3(space.normal, alongX), dot3(space.normal, alongY)),
      b: dot3(space.normal, alongZ),
      c: space.offset - dot3(space.normal, origin),
    })),
    { a: vec2(0, 0), b: 1, c: part.thickness },
    { a: vec2(0, 0), b: -1, c: 0 },
  ];
  const isFree = (constraint: { b: number }) => Math.abs(constraint.b) < DEPTH_INDEPENDENT_EPSILON;
  const upper = constraints.filter((constraint) => !isFree(constraint) && constraint.b > 0);
  const lower = constraints.filter((constraint) => !isFree(constraint) && constraint.b < 0);
  const halfPlanes: HalfPlane[] = [
    ...constraints.filter(isFree).map((constraint) => ({ normal: constraint.a, offset: constraint.c })),
    ...upper.flatMap((high) =>
      lower.map((low) => ({
        normal: vec2(high.a.x / high.b - low.a.x / low.b, high.a.y / high.b - low.a.y / low.b),
        offset: high.c / high.b - low.c / low.b,
      })),
    ),
  ];
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
