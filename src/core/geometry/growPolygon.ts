import type { Polygon } from './polygon';
import { signedArea } from './polygon';
import type { Mm, Vec2 } from './vector';

/** Hörnen flyttas högst så här många gånger avståndet, så att spetsiga hörn inte skjuter iväg. */
const MAX_MITER_RATIO = 3;

/**
 * Polygonen förstorad med avståndet åt alla håll (förminskad när avståndet är negativt): varje kant flyttas ut
 * vinkelrätt, och hörnen hamnar där de flyttade kanterna möts (gering).
 */
export function growPolygon(polygon: Polygon, distance: Mm): Vec2[] {
  const turn = signedArea(polygon) >= 0 ? 1 : -1;
  const count = polygon.length;
  const outwardNormal = (a: Vec2, b: Vec2): Vec2 => {
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (turn * (b.y - a.y)) / length, y: (turn * -(b.x - a.x)) / length };
  };
  return polygon.map((point, index) => {
    const previous = polygon[(index - 1 + count) % count] ?? point;
    const next = polygon[(index + 1) % count] ?? point;
    const [before, after] = [outwardNormal(previous, point), outwardNormal(point, next)];
    const bisector = { x: before.x + after.x, y: before.y + after.y };
    const bisectorLength = Math.hypot(bisector.x, bisector.y);
    if (bisectorLength < 1e-9) return { x: point.x + before.x * distance, y: point.y + before.y * distance };
    const cosHalf = (bisector.x * before.x + bisector.y * before.y) / bisectorLength;
    const shift = Math.sign(distance) * Math.min(Math.abs(distance) / Math.max(cosHalf, 1e-9), Math.abs(distance) * MAX_MITER_RATIO);
    return { x: point.x + (bisector.x / bisectorLength) * shift, y: point.y + (bisector.y / bisectorLength) * shift };
  });
}
