import type { Mm, Vec3 } from './vector';
import { cross3, dot3, length3, subtract3 } from './vector';

/**
 * En konvex platta i världen: hörnen på dess båda sidor och dess kanter.
 * Fås ur en del genom att ta konturens konvexa hölje på båda sidorna.
 */
export interface ConvexSlab {
  corners: Vec3[];
  /** Riktningar som kan skilja plattorna åt: sidornas normal och kanternas riktningar. */
  normal: Vec3;
  edgeDirections: Vec3[];
}

/** Riktningar kortare än så är kanter som nästan saknar längd och hoppas över. */
const MIN_AXIS_LENGTH = 1e-9;

/**
 * Om två konvexa plattor går in i varandra mer än `toleranceMm`. Plattor som
 * bara nuddar varandra, t.ex. två väggar som står mot varandra, räknas inte.
 * Prövas med separerande axlar: går det att hitta en riktning där plattornas
 * skuggor inte överlappar, så skiljs de åt.
 */
export function doSlabsOverlap(a: ConvexSlab, b: ConvexSlab, toleranceMm: Mm): boolean {
  if (!doBoxesOverlap(a.corners, b.corners, toleranceMm)) return false;
  return listAxes(a, b).every((axis) => overlapAlong(axis, a.corners, b.corners) > toleranceMm);
}

function listAxes(a: ConvexSlab, b: ConvexSlab): Vec3[] {
  const faceAxes = [a.normal, b.normal, ...sideNormals(a), ...sideNormals(b)];
  const edgeAxes = [a.normal, ...a.edgeDirections].flatMap((edgeA) => [b.normal, ...b.edgeDirections].map((edgeB) => cross3(edgeA, edgeB)));
  return [...faceAxes, ...edgeAxes].filter((axis) => length3(axis) > MIN_AXIS_LENGTH).map(normalize);
}

/** Plattans kanter står vinkelrätt mot sidorna, så deras normaler är kantriktning × normal. */
function sideNormals(slab: ConvexSlab): Vec3[] {
  return slab.edgeDirections.map((edge) => cross3(edge, slab.normal));
}

/** Hur mycket skuggorna längs axeln överlappar, i mm. Negativt när det finns ett mellanrum. */
function overlapAlong(axis: Vec3, a: readonly Vec3[], b: readonly Vec3[]): Mm {
  const [minA, maxA] = projectRange(axis, a);
  const [minB, maxB] = projectRange(axis, b);
  return Math.min(maxA, maxB) - Math.max(minA, minB);
}

function projectRange(axis: Vec3, points: readonly Vec3[]): [number, number] {
  const values = points.map((point) => dot3(axis, point));
  return [Math.min(...values), Math.max(...values)];
}

function doBoxesOverlap(a: readonly Vec3[], b: readonly Vec3[], toleranceMm: Mm): boolean {
  const axes = [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ];
  return axes.every((axis) => overlapAlong(axis, a, b) > toleranceMm);
}

function normalize(vector: Vec3): Vec3 {
  const length = length3(vector);
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

/** Plattan för en konvex kontur med hörn i världen på båda sidor, i samma ordning. */
export function slabFromFaces(bottom: readonly Vec3[], top: readonly Vec3[]): ConvexSlab {
  const first = bottom[0];
  const firstTop = top[0];
  const normal = first && firstTop ? subtract3(firstTop, first) : { x: 0, y: 1, z: 0 };
  const edgeDirections = bottom.map((start, index) => subtract3(bottom[(index + 1) % bottom.length] ?? start, start));
  return { corners: [...bottom, ...top], normal, edgeDirections };
}
