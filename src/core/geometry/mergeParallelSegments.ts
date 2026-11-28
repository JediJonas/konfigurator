import type { Mm, Vec3 } from './vector';
import { dot3, length3, subtract3 } from './vector';

/** Kanter som är parallella inom så här många grader kan slås ihop till en. */
const PARALLEL_ANGLE_DEGREES = 10;
/** Sträckor som delar kortare längd än så här slås inte ihop. */
const MIN_OVERLAP_MM = 0.5;
/** Sträckor kortare än så här är för korta att rita; de blir bara en knopp. */
const MIN_SEGMENT_MM = 0.5;

/**
 * Är den ena kanten minst så här många gånger längre än den andra går den
 * korta upp i den långa, som ligger kvar, i stället för att båda flyttas till
 * mitten. Annars skulle den långa få hack där de korta slutar.
 */
const ABSORB_LENGTH_RATIO = 1.5;

/** En rak sträcka i världen. */
export interface Segment3 {
  start: Vec3;
  end: Vec3;
}

interface KeptSegment extends Segment3 {
  isMerged: boolean;
}

/**
 * Slår ihop parallella sträckor som ligger närmare varandra än `mergeDistance`
 * till en sträcka i mitten där de går bredvid varandra, t.ex. kanterna på var
 * sin sida om en spröjs eller där en lucka står vid fönstrets kant. Delarna av
 * sträckorna som inte går bredvid varandra behålls; är de kortare än halva
 * avståndet tas de bort, eftersom deras ände ändå fogas ihop med mittlinjen.
 * En kant bredvid en mittlinje eller en mycket längre kant går upp i den.
 */
export function mergeParallelSegments(segments: readonly Segment3[], mergeDistance: Mm): Segment3[] {
  const kept: KeptSegment[] = [];
  // Längsta först, så att en kort kant går upp i en lång i stället för att ge den ett hack.
  const queue: Segment3[] = [...segments].sort((a, b) => lengthOf(a) - lengthOf(b));
  const minRemnant = Math.max(MIN_SEGMENT_MM, mergeDistance / 2);
  while (queue.length > 0) {
    const segment = queue.pop() as Segment3;
    if (lengthOf(segment) < MIN_SEGMENT_MM) continue;
    const index = kept.findIndex((other) => isAlongside(other, segment, mergeDistance));
    const other = kept[index];
    if (!other) {
      kept.push({ ...segment, isMerged: false });
      continue;
    }
    const merged = mergePair(other, segment);
    if (other.isMerged || lengthOf(other) >= ABSORB_LENGTH_RATIO * lengthOf(segment)) {
      // En mittlinje, eller en mycket längre kant, t.ex. luckans kant vid fönstrets rutor, ligger kvar och tar upp den här.
      queue.push(...merged.segmentRemnants.filter((part) => lengthOf(part) >= minRemnant));
      continue;
    }
    const otherRemnants = merged.otherRemnants.filter((part) => lengthOf(part) >= minRemnant).map((part) => ({ ...part, isMerged: false }));
    kept.splice(index, 1, ...otherRemnants, { ...merged.middle, isMerged: true });
    queue.push(...merged.segmentRemnants.filter((part) => lengthOf(part) >= minRemnant));
  }
  return kept.map(({ start, end }) => ({ start, end }));
}

/** Sant när sträckorna är parallella, nära varandra och går bredvid varandra en bit. */
function isAlongside(other: Segment3, segment: Segment3, mergeDistance: Mm): boolean {
  const otherDirection = directionOf(other);
  const segmentDirection = directionOf(segment);
  if (Math.abs(dot3(otherDirection, segmentDirection)) < Math.cos((PARALLEL_ANGLE_DEGREES * Math.PI) / 180)) return false;
  const overlap = overlapOn(other, segment);
  if (!overlap || (overlap.to - overlap.from) * lengthOf(other) < MIN_OVERLAP_MM) return false;
  const from = pointAt(other, overlap.from);
  const to = pointAt(other, overlap.to);
  return distanceToLine(from, segment) <= mergeDistance && distanceToLine(to, segment) <= mergeDistance;
}

/** Delen av `other` (som läge 0–1 längs den) där `segment` går bredvid. */
function overlapOn(other: Segment3, segment: Segment3): { from: number; to: number } | undefined {
  const a = parameterOn(other, segment.start);
  const b = parameterOn(other, segment.end);
  const from = Math.max(0, Math.min(a, b));
  const to = Math.min(1, Math.max(a, b));
  return to > from ? { from, to } : undefined;
}

function mergePair(other: Segment3, segment: Segment3): { middle: Segment3; otherRemnants: Segment3[]; segmentRemnants: Segment3[] } {
  const overlap = overlapOn(other, segment) as { from: number; to: number };
  const otherFrom = pointAt(other, overlap.from);
  const otherTo = pointAt(other, overlap.to);
  const segmentFromT = clamp01(parameterOn(segment, otherFrom));
  const segmentToT = clamp01(parameterOn(segment, otherTo));
  const middle = { start: lerp(otherFrom, pointAt(segment, segmentFromT), 0.5), end: lerp(otherTo, pointAt(segment, segmentToT), 0.5) };
  const otherRemnants = [
    { start: other.start, end: otherFrom },
    { start: otherTo, end: other.end },
  ];
  const [low, high] = segmentFromT < segmentToT ? [segmentFromT, segmentToT] : [segmentToT, segmentFromT];
  const segmentRemnants = [
    { start: segment.start, end: pointAt(segment, low) },
    { start: pointAt(segment, high), end: segment.end },
  ];
  return { middle, otherRemnants, segmentRemnants };
}

function parameterOn(segment: Segment3, point: Vec3): number {
  const direction = subtract3(segment.end, segment.start);
  const lengthSquared = dot3(direction, direction);
  return lengthSquared === 0 ? 0 : dot3(subtract3(point, segment.start), direction) / lengthSquared;
}

function distanceToLine(point: Vec3, segment: Segment3): Mm {
  return length3(subtract3(point, pointAt(segment, parameterOn(segment, point))));
}

function directionOf(segment: Segment3): Vec3 {
  const direction = subtract3(segment.end, segment.start);
  const length = length3(direction);
  return length === 0 ? direction : { x: direction.x / length, y: direction.y / length, z: direction.z / length };
}

function lengthOf(segment: Segment3): Mm {
  return length3(subtract3(segment.end, segment.start));
}

function pointAt(segment: Segment3, t: number): Vec3 {
  return lerp(segment.start, segment.end, t);
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
