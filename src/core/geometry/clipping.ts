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
  return subtractRegions(shape, [region]);
}

/**
 * Rutnät som hörnen läggs på innan klippningen, i mm, där 0 är inget rutnät.
 * Biblioteket klarar inte alltid hörn som nästan men inte helt sammanfaller;
 * då prövas ett grövre rutnät.
 */
const SNAP_GRIDS_MM = [0, 1e-6, 1e-4, 1e-2];
/** Områden mindre än så tas inte bort, eftersom de bara är avrundningsbrus. */
const MIN_REGION_AREA_MM2 = 1e-6;

/** Tar bort flera områden på en gång. Områden med färre än tre hörn hoppas över. */
export function subtractRegions(shape: { outline: Polygon; holes: readonly Polygon[] }, regions: readonly Polygon[]): ShapeWithHoles[] {
  const usable = regions.filter((region) => region.length >= 3 && Math.abs(signedArea(region)) > MIN_REGION_AREA_MM2);
  for (const [index, grid] of SNAP_GRIDS_MM.entries()) {
    try {
      return differenceOnGrid(shape, usable, grid);
    } catch (error) {
      if (index === SNAP_GRIDS_MM.length - 1) throw error;
    }
  }
  return [];
}

function differenceOnGrid(shape: { outline: Polygon; holes: readonly Polygon[] }, regions: readonly Polygon[], grid: number): ShapeWithHoles[] {
  const round = (value: number) => (grid === 0 ? value : Math.round(value / grid) * grid);
  const snap = (polygon: Polygon): Ring => toRing(polygon).map(([x, y]): Pair => [round(x), round(y)]);
  const subject: ClipPolygon = [snap(shape.outline), ...shape.holes.map(snap)];
  const clips: ClipPolygon[] = regions.map((region) => [snap(region)]);
  return polygonClipping.difference(subject, ...clips).map(([outline, ...holes]) => ({
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

/** Hörn närmare varandra än så, eller så nära linjen mellan grannarna, tas bort efter klippningen. */
const SIMPLIFY_TOLERANCE_MM = 1e-6;

/** Biblioteket upprepar första punkten sist; delarna gör det inte. Dubbla hörn och hörn mitt på en rak kant tas bort. */
function fromRing(ring: Ring): Vec2[] {
  const points = ring.map(([x, y]) => ({ x, y }));
  const first = points[0];
  const last = points.at(-1);
  if (first && last && first.x === last.x && first.y === last.y) points.pop();
  return removeRedundantCorners(points);
}

function removeRedundantCorners(points: Vec2[]): Vec2[] {
  let current = points;
  let changed = true;
  while (changed && current.length > 3) {
    changed = false;
    const kept = current.filter((point, index) => {
      const before = current[(index - 1 + current.length) % current.length] ?? point;
      const after = current[(index + 1) % current.length] ?? point;
      const isRedundant = isSamePoint(point, after) || distanceToLine(point, before, after) < SIMPLIFY_TOLERANCE_MM;
      if (isRedundant && !changed) {
        changed = true;
        return false;
      }
      return true;
    });
    current = kept;
  }
  return current;
}

function isSamePoint(a: Vec2, b: Vec2): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < SIMPLIFY_TOLERANCE_MM;
}

/** Avståndet från en punkt till linjen genom två andra, eller till punkten om de sammanfaller. */
function distanceToLine(point: Vec2, a: Vec2, b: Vec2): number {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < SIMPLIFY_TOLERANCE_MM) return Math.hypot(point.x - a.x, point.y - a.y);
  return Math.abs((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)) / length;
}

function orient(polygon: Vec2[], isCounterClockwise: boolean): Vec2[] {
  return signedArea(polygon) > 0 === isCounterClockwise ? polygon : [...polygon].reverse();
}
