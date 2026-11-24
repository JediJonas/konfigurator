import type { Polygon } from './polygon';
import type { Mm, Vec2 } from './vector';
import { vec2 } from './vector';

/** Halvplanet där `normal · p ≤ offset`. Normalen pekar ut ur halvplanet. */
export interface HalfPlane {
  normal: Vec2;
  offset: number;
}

/** Så nära gränsen som en punkt räknas som på den, för avrundning. */
const ON_LINE_TOLERANCE = 1e-9;

/** Halvplanet till vänster om linjen från `start` mot `end`, sett i y-axelns riktning uppåt. */
export function halfPlaneLeftOf(start: Vec2, end: Vec2): HalfPlane {
  const normal = vec2(end.y - start.y, start.x - end.x);
  return { normal, offset: normal.x * start.x + normal.y * start.y };
}

/** Samma halvplan flyttat inåt med `distance` mm, mätt vinkelrätt mot gränsen. */
export function shrinkHalfPlane(halfPlane: HalfPlane, distance: Mm): HalfPlane {
  const length = Math.hypot(halfPlane.normal.x, halfPlane.normal.y);
  return { normal: halfPlane.normal, offset: halfPlane.offset - distance * length };
}

/** Den del av en konvex polygon som ligger i halvplanet (Sutherland–Hodgman). */
export function clipByHalfPlane(polygon: Polygon, halfPlane: HalfPlane): Vec2[] {
  const signed = (point: Vec2) => halfPlane.normal.x * point.x + halfPlane.normal.y * point.y - halfPlane.offset;
  const result: Vec2[] = [];
  polygon.forEach((current, index) => {
    const next = polygon[(index + 1) % polygon.length] ?? current;
    const currentSide = signed(current);
    const nextSide = signed(next);
    if (currentSide <= ON_LINE_TOLERANCE) result.push(current);
    if ((currentSide < -ON_LINE_TOLERANCE && nextSide > ON_LINE_TOLERANCE) || (currentSide > ON_LINE_TOLERANCE && nextSide < -ON_LINE_TOLERANCE)) {
      const t = currentSide / (currentSide - nextSide);
      result.push(vec2(current.x + t * (next.x - current.x), current.y + t * (next.y - current.y)));
    }
  });
  return result;
}

/** Den del av en konvex polygon som ligger i alla halvplanen. Tom när inget blir kvar. */
export function clipByHalfPlanes(polygon: Polygon, halfPlanes: readonly HalfPlane[]): Vec2[] {
  return halfPlanes.reduce<Vec2[]>((current, halfPlane) => (current.length < 3 ? [] : clipByHalfPlane(current, halfPlane)), [...polygon]);
}

/** En kvadrat runt origo med halva sidan `halfSize`, att klippa ner till ett konvext område. */
export function squareAround(center: Vec2, halfSize: Mm): Vec2[] {
  return [
    vec2(center.x - halfSize, center.y - halfSize),
    vec2(center.x + halfSize, center.y - halfSize),
    vec2(center.x + halfSize, center.y + halfSize),
    vec2(center.x - halfSize, center.y + halfSize),
  ];
}
