import type { Segment3 } from './mergeParallelSegments';
import type { Mm, Vec3 } from './vector';
import { length3, subtract3 } from './vector';

/** Sträckan delas i bitar av högst så här många mm, så att den bara flyttas där den ligger i ett hörn. */
const PIECE_LENGTH_MM = 8;
/** En yta vars utåtriktning har så stor lodrät del räknas som vänd uppåt (lutar högst cirka 70°). */
const UPWARD_FACING_MIN = 0.3;

/**
 * Flyttar de delar av sträckan som ligger i ett hörn som går inåt (där en yta
 * möter en annan) en strängradie ut från den andra ytan och en strängradie
 * upp från delen den sitter på, så att strängen ligger an mot väggen och syns
 * nästan helt, i stället för att sitta halvt inne i väggen och delen. Hos en
 * del som lutar flyttas den rakt upp och inte längs ytans normal, så att två
 * takskivor som möts i en nock flyttas lika och kanterna inte glider isär.
 * `findOtherNormal` ger den andra ytans utåtriktning för en punkt i ett
 * sådant hörn. Bitar i samma hörn blir en sträcka.
 */
export function shiftIntoCorners(segment: Segment3, ownerNormal: Vec3, findOtherNormal: (point: Vec3) => Vec3 | undefined, radius: Mm): Segment3[] {
  const lift = liftDirectionOf(ownerNormal);
  const count = Math.max(1, Math.ceil(length3(subtract3(segment.end, segment.start)) / PIECE_LENGTH_MM));
  const pointAt = (t: number) => lerp(segment.start, segment.end, t);
  const offsets = Array.from({ length: count }, (_, index) => {
    const other = findOtherNormal(pointAt((index + 0.5) / count));
    return other ? scale(add(other, lift), radius) : undefined;
  });
  const pieces: Segment3[] = [];
  let first = 0;
  for (let index = 1; index <= count; index++) {
    if (index < count && isSameOffset(offsets[index], offsets[first])) continue;
    const offset = offsets[first];
    const [start, end] = [pointAt(first / count), pointAt(index / count)];
    pieces.push(offset ? { start: add(start, offset), end: add(end, offset) } : { start, end });
    first = index;
  }
  return pieces;
}

/** Åt vilket håll strängen lyfts från delen: rakt upp för en yta som vetter uppåt, annars ytans utåtriktning. */
function liftDirectionOf(ownerNormal: Vec3): Vec3 {
  return ownerNormal.y > UPWARD_FACING_MIN ? { x: 0, y: 1, z: 0 } : ownerNormal;
}

function isSameOffset(a: Vec3 | undefined, b: Vec3 | undefined): boolean {
  if (!a || !b) return !a && !b;
  return length3(subtract3(a, b)) < 1e-6;
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(a: Vec3, factor: number): Vec3 {
  return { x: a.x * factor, y: a.y * factor, z: a.z * factor };
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}
