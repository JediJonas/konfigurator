import type { Mm, Vec2 } from './vector';
import { distance2 } from './vector';

export type Polygon = readonly Vec2[];

export interface Bounds2 {
  minX: Mm;
  minY: Mm;
  maxX: Mm;
  maxY: Mm;
}

/** Positiv när punkterna går moturs (y uppåt). */
export function signedArea(polygon: Polygon): number {
  let sum = 0;
  polygon.forEach((point, index) => {
    const next = polygon[(index + 1) % polygon.length] ?? point;
    sum += point.x * next.y - next.x * point.y;
  });
  return sum / 2;
}

export function boundsOf(polygon: Polygon): Bounds2 {
  return {
    minX: Math.min(...polygon.map((p) => p.x)),
    minY: Math.min(...polygon.map((p) => p.y)),
    maxX: Math.max(...polygon.map((p) => p.x)),
    maxY: Math.max(...polygon.map((p) => p.y)),
  };
}

export function boundsWidth(bounds: Bounds2): Mm {
  return bounds.maxX - bounds.minX;
}

export function boundsHeight(bounds: Bounds2): Mm {
  return bounds.maxY - bounds.minY;
}

export function edgeLengths(polygon: Polygon): Mm[] {
  return polygon.map((point, index) => distance2(point, polygon[(index + 1) % polygon.length] ?? point));
}

export function translatePolygon(polygon: Polygon, offset: Vec2): Vec2[] {
  return polygon.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y }));
}

/** Vrider 90° moturs runt origo. */
export function rotatePolygonQuarter(polygon: Polygon): Vec2[] {
  return polygon.map((p) => ({ x: -p.y, y: p.x }));
}

/** Speglar i y-axeln, för spegelvända par. */
export function mirrorPolygonX(polygon: Polygon): Vec2[] {
  return polygon.map((p) => ({ x: -p.x, y: p.y })).reverse();
}
