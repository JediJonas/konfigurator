import polygonClipping from 'polygon-clipping';
import type { Pair, Polygon as ClipPolygon, Ring } from 'polygon-clipping';
import type { Polygon } from './polygon';
import { signedArea } from './polygon';
import type { Vec2 } from './vector';

/** En platt form med hål, som efter att en del av den har tagits bort. */
export interface ShapeWithHoles {
  outline: Vec2[];
  holes: Vec2[][];
}

/**
 * Tar bort ett område från en form. Området kan ligga helt inne i formen
 * (blir ett hål) eller gå ut över kanten (blir ett hack i konturen).
 * Formen kan bli flera bitar, eller ingenting, om området skär av den.
 */
export function subtractRegion(shape: { outline: Polygon; holes: readonly Polygon[] }, region: Polygon): ShapeWithHoles[] {
  const subject: ClipPolygon = [toRing(shape.outline), ...shape.holes.map(toRing)];
  return polygonClipping.difference(subject, [toRing(region)]).map(([outline, ...holes]) => ({
    outline: orient(fromRing(outline ?? []), true),
    holes: holes.map((hole) => orient(fromRing(hole), false)),
  }));
}

/** Arean där två former överlappar, i mm². */
export function overlapArea(a: Polygon, b: Polygon): number {
  const overlap = polygonClipping.intersection([toRing(a)], [toRing(b)]);
  return overlap.reduce((sum, [outline, ...holes]) => {
    const holeArea = holes.reduce((holeSum, hole) => holeSum + Math.abs(signedArea(fromRing(hole))), 0);
    return sum + Math.abs(signedArea(fromRing(outline ?? []))) - holeArea;
  }, 0);
}

function toRing(polygon: Polygon): Ring {
  return polygon.map((point): Pair => [point.x, point.y]);
}

/** Biblioteket upprepar första punkten sist; delarna gör det inte. */
function fromRing(ring: Ring): Vec2[] {
  const points = ring.map(([x, y]) => ({ x, y }));
  const first = points[0];
  const last = points.at(-1);
  if (first && last && first.x === last.x && first.y === last.y) points.pop();
  return points;
}

function orient(polygon: Vec2[], isCounterClockwise: boolean): Vec2[] {
  return signedArea(polygon) > 0 === isCounterClockwise ? polygon : [...polygon].reverse();
}
