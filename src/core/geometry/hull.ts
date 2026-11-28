import type { Polygon } from './polygon';
import type { Vec2 } from './vector';

/** Konvexa höljet moturs (Andrews algoritm). Används för hur stor yta ett objekt tar i en kopplingspunkt. */
export function convexHull(points: readonly Vec2[]): Vec2[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return sorted;
  const lower = buildChain(sorted);
  const upper = buildChain([...sorted].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function buildChain(points: Vec2[]): Vec2[] {
  const chain: Vec2[] = [];
  for (const point of points) {
    while (isNotLeftTurn(chain, point)) chain.pop();
    chain.push(point);
  }
  return chain;
}

function isNotLeftTurn(chain: Vec2[], point: Vec2): boolean {
  const a = chain.at(-2);
  const b = chain.at(-1);
  return a !== undefined && b !== undefined && turn(a, b, point) <= 0;
}

/** Positiv när a → b → c svänger moturs. */
function turn(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Om punkten ligger i polygonen eller på dess kant, med en tolerans i mm. */
export function isPointInPolygon(point: Vec2, polygon: Polygon, toleranceMm: number): boolean {
  if (distanceToBoundary(point, polygon) <= toleranceMm) return true;
  let isInside = false;
  polygon.forEach((a, index) => {
    const b = polygon[(index + 1) % polygon.length] ?? a;
    const crosses = a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) isInside = !isInside;
  });
  return isInside;
}

/** Kortaste avståndet från punkten till polygonens kant, i mm. */
export function distanceToBoundary(point: Vec2, polygon: Polygon): number {
  return Math.min(
    ...polygon.map((a, index) => distanceToSegment(point, a, polygon[(index + 1) % polygon.length] ?? a)),
  );
}

function distanceToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}
