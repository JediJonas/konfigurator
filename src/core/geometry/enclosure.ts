import type { Part } from '../model/part';
import { distanceToBoundary, isPointInPolygon } from './hull';
import type { Polygon } from './polygon';
import { invertRigidMatrix, transformPoint } from './matrix';
import type { Matrix4 } from './matrix';
import type { Mm, Vec2, Vec3 } from './vector';

/** Så långt en stråle prövas; längre än något objekt. */
const RAY_LENGTH_MM = 100_000;
/** Strålen börjar så här långt från punkten och snuddar inte delen den börjar på. */
const RAY_START_MM = 1;
/** En stråle som bara snuddar en dels yta räknas inte som träff. */
const GRAZE_TOLERANCE_MM = 0.05;

/** Riktningarna som prövas: längs världens axlar, utom rakt ner där fatet alltid stänger. */
const DIRECTIONS: readonly Vec3[] = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

export interface EnclosurePart {
  part: Part;
  toLocal: Matrix4;
}

export function prepareEnclosureParts(parts: readonly Part[]): EnclosurePart[] {
  return parts.map((part) => ({ part, toLocal: invertRigidMatrix(part.transform) }));
}

/**
 * Sant när punkten är instängd av delarna: strålar åt alla håll (utom ner,
 * där fatet stänger) träffar en del. Hålen räknas som fyllda, så att ett
 * fönster eller en dörr inte öppnar huset. Så hittas punkter inuti ett hus,
 * t.ex. takets undersida i nocken, som aldrig syns utifrån.
 */
export function isEnclosed(point: Vec3, parts: readonly EnclosurePart[]): boolean {
  return DIRECTIONS.every((direction) => parts.some((prepared) => doesRayHit(point, direction, prepared)));
}

/** Sant när strålen från punkten i riktningen går in i delen. */
function doesRayHit(point: Vec3, direction: Vec3, { part, toLocal }: EnclosurePart): boolean {
  const start = transformPoint(toLocal, add(point, scale(direction, RAY_START_MM)));
  const end = transformPoint(toLocal, add(point, scale(direction, RAY_LENGTH_MM)));
  const span = clipToThickness(start.z, end.z, part.thickness);
  if (!span) return false;
  const from = lerp2(start, end, span[0]);
  const to = lerp2(start, end, span[1]);
  return isSegmentInOutline(from, to, part.outline);
}

/** Den del av strålen (0–1) som ligger inne i delens tjocklek, utan ytorna. */
function clipToThickness(startZ: Mm, endZ: Mm, thickness: Mm): [number, number] | undefined {
  const low = GRAZE_TOLERANCE_MM;
  const high = thickness - GRAZE_TOLERANCE_MM;
  const deltaZ = endZ - startZ;
  if (Math.abs(deltaZ) < 1e-9) return startZ > low && startZ < high ? [0, 1] : undefined;
  const [first, second] = [(low - startZ) / deltaZ, (high - startZ) / deltaZ].sort((a, b) => a - b) as [number, number];
  const from = Math.max(0, first);
  const to = Math.min(1, second);
  return from < to ? [from, to] : undefined;
}

/** Sant när sträckan i delens plan går genom konturen, med hålen fyllda. */
function isSegmentInOutline(from: Vec2, to: Vec2, outline: Polygon): boolean {
  if (isStrictlyInside(from, outline) || isStrictlyInside(to, outline)) return true;
  return outline.some((a, index) => doSegmentsCross(from, to, a, outline[(index + 1) % outline.length] ?? a));
}

function isStrictlyInside(point: Vec2, outline: Polygon): boolean {
  return isPointInPolygon(point, outline, 0) && distanceToBoundary(point, outline) > GRAZE_TOLERANCE_MM;
}

function doSegmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const side = (p: Vec2, q: Vec2, r: Vec2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const [d1, d2, d3, d4] = [side(c, d, a), side(c, d, b), side(a, b, c), side(a, b, d)];
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(a: Vec3, factor: number): Vec3 {
  return { x: a.x * factor, y: a.y * factor, z: a.z * factor };
}

function lerp2(a: Vec3, b: Vec3, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
