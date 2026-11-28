import type { Part } from '../model/part';
import { isEnclosed, prepareEnclosureParts } from './enclosure';
import { growPolygon } from './growPolygon';
import { distanceToBoundary, isPointInPolygon } from './hull';
import { joinEdgeLines } from './joinEdgeLines';
import { invertRigidMatrix, transformPoint } from './matrix';
import type { Matrix4 } from './matrix';
import { mergeParallelSegments } from './mergeParallelSegments';
import type { Segment3 } from './mergeParallelSegments';
import type { Mm, Vec3 } from './vector';
import { length3, subtract3 } from './vector';

/**
 * Kanterna prövas i bitar av högst så här många mm, så att en kant som delvis
 * döljs av en annan del bara tappar den dolda biten.
 */
const PIECE_LENGTH_MM = 8;
/** En kant som ligger så här nära en annan del, eller i den, räknas som dold av den. */
const TOUCH_TOLERANCE_MM = 0.5;
/** Kanter på fatet (y nära 0) räknas inte som ytterkanter. */
const GROUND_LEVEL_MM = 0.5;
/** Så många halveringar gränsen mot en dold bit söks med; 8 mm / 2^8 ≈ 0,03 mm. */
const BOUNDARY_STEPS = 8;

export interface OuterEdgeOptions {
  /**
   * Parallella kanter närmare varandra än så här blir en, i mitten mellan dem,
   * t.ex. två hål på var sin sida om en smal list. Fria ändar så här nära
   * varandra fogas ihop, t.ex. där två takfall möts i nocken.
   */
  mergeDistance: Mm;
  /**
   * Kanterna runt hål flyttas så här långt ut från hålet, in på delens yta,
   * så att randen ligger på ytan runt hålet och inte syns inifrån huset. Det är
   * också avståndet som en del med `hasEdgeBeadOnFront` får randen innanför
   * kanten och ovanför framsidan, så att den ligger kant i kant med delen.
   */
  holeMargin: Mm;
}

/** En sammanhängande ytterkant i världen, som punkter i ordning. */
export type EdgeLine = Vec3[];

interface PreparedPart {
  part: Part;
  toLocal: Matrix4;
  outerZs: Mm[];
  min: Vec3;
  max: Vec3;
}

/**
 * Ytterkanterna på delarna i världen: konturens och hålens kanter på delens
 * utsida (båda sidor när delen inte har någon insida); hålens kanter flyttas
 * ut på ytan runt hålet. En kant som ligger i
 * eller mot en annan del är dold, t.ex. en väggs ände i ett hörn där den andra
 * väggen går ut, eller väggens överkant under taket; synliga kanter går ända
 * fram till delen som döljer resten. Kanter som sammanfaller eller ligger tätt
 * parallellt blir en, så att en fog mellan två delar bara får en kant. Kanter
 * som möts fogas ihop till obrutna linjer. Kanter som ligger på fatet eller
 * inuti huset (instängda av delarna) räknas inte.
 */
export function listOuterEdges(parts: readonly Part[], options: OuterEdgeOptions): EdgeLine[] {
  const prepared = parts.map(preparePart);
  const enclosureParts = prepareEnclosureParts(parts);
  const segments: Segment3[] = [];
  prepared.forEach((owner, ownerIndex) => {
    const isCovered = (point: Vec3) => point.y <= GROUND_LEVEL_MM || isHidden(point, prepared, ownerIndex) || isEnclosed(point, enclosureParts);
    const isOnFace = owner.part.hasEdgeBeadOnFront === true;
    // På framsidan ligger randen innanför konturen och ovanpå ytan, så att den går kant i kant med delen.
    const outline = isOnFace ? growPolygon(owner.part.outline, -options.holeMargin) : owner.part.outline;
    const holes = owner.part.holes.map((hole) => growPolygon(hole, options.holeMargin));
    const zs = isOnFace ? [owner.part.thickness + options.holeMargin] : owner.outerZs;
    for (const ring of [outline, ...holes]) {
      for (const z of zs) {
        ring.forEach((point, index) => {
          const next = ring[(index + 1) % ring.length] ?? point;
          const start = transformPoint(owner.part.transform, { x: point.x, y: point.y, z });
          const end = transformPoint(owner.part.transform, { x: next.x, y: next.y, z });
          segments.push(...listVisibleSegments(start, end, isCovered));
        });
      }
    }
  });
  return joinEdgeLines(
    mergeParallelSegments(segments, options.mergeDistance).map((segment) => [segment.start, segment.end]),
    options.mergeDistance,
  );
}

/**
 * De synliga sträckorna av en kant. Kanten prövas i bitarnas mitt, och där
 * den går från synlig till dold söks gränsen, så att sträckan går ända fram
 * till delen som döljer resten.
 */
function listVisibleSegments(start: Vec3, end: Vec3, isCovered: (point: Vec3) => boolean): Segment3[] {
  const count = Math.max(1, Math.ceil(length3(subtract3(end, start)) / PIECE_LENGTH_MM));
  const pointAt = (t: number) => lerp(start, end, t);
  const isOnGround = start.y <= GROUND_LEVEL_MM && end.y <= GROUND_LEVEL_MM;
  if (isOnGround) return [];
  const segments: Segment3[] = [];
  let visibleFrom: number | undefined;
  let previousT: number | undefined;
  for (let index = 0; index < count; index++) {
    const t = (index + 0.5) / count;
    const isVisible = !isCovered(pointAt(t));
    if (isVisible && visibleFrom === undefined) visibleFrom = previousT === undefined ? 0 : findCoverBoundary(t, previousT, pointAt, isCovered);
    if (!isVisible && visibleFrom !== undefined && previousT !== undefined) {
      segments.push({ start: pointAt(visibleFrom), end: pointAt(findCoverBoundary(previousT, t, pointAt, isCovered)) });
      visibleFrom = undefined;
    }
    previousT = t;
  }
  if (visibleFrom !== undefined) segments.push({ start: pointAt(visibleFrom), end });
  return segments;
}

/** Gränsen mellan en synlig och en dold punkt på kanten, som läge längs kanten, hittad genom halvering. */
function findCoverBoundary(visibleT: number, coveredT: number, pointAt: (t: number) => Vec3, isCovered: (point: Vec3) => boolean): number {
  let [inside, outside] = [visibleT, coveredT];
  for (let step = 0; step < BOUNDARY_STEPS; step++) {
    const middle = (inside + outside) / 2;
    if (isCovered(pointAt(middle))) outside = middle;
    else inside = middle;
  }
  return inside;
}

function preparePart(part: Part): PreparedPart {
  const outerZs = part.hasInsideAtZero ? [part.thickness] : [0, part.thickness];
  const corners = part.outline.flatMap((point) => [0, part.thickness].map((z) => transformPoint(part.transform, { x: point.x, y: point.y, z })));
  const min = { x: Math.min(...corners.map((c) => c.x)), y: Math.min(...corners.map((c) => c.y)), z: Math.min(...corners.map((c) => c.z)) };
  const max = { x: Math.max(...corners.map((c) => c.x)), y: Math.max(...corners.map((c) => c.y)), z: Math.max(...corners.map((c) => c.z)) };
  return { part, toLocal: invertRigidMatrix(part.transform), outerZs, min, max };
}

/**
 * Sant när punkten ligger i eller mot en annan del. En kant som ligger mot
 * mitten av den andra delens utsida är ett hörn som går inåt och räknas som
 * synlig. Sammanfaller kanten med en
 * ytterkant på en senare del räknas den inte som dold av den, eftersom den
 * senare delens kant då döljs av denna; så blir en av dem kvar.
 */
function isHidden(point: Vec3, parts: readonly PreparedPart[], ownerIndex: number): boolean {
  return parts.some((other, otherIndex) => {
    if (otherIndex === ownerIndex || !isInBox(point, other)) return false;
    const local = transformPoint(other.toLocal, point);
    const { part } = other;
    if (local.z < -TOUCH_TOLERANCE_MM || local.z > part.thickness + TOUCH_TOLERANCE_MM) return false;
    const flat = { x: local.x, y: local.y };
    if (!isPointInPolygon(flat, part.outline, TOUCH_TOLERANCE_MM)) return false;
    if (part.holes.some((hole) => isPointInPolygon(flat, hole, 0) && distanceToBoundary(flat, hole) > TOUCH_TOLERANCE_MM)) return false;
    const isOnOuterFace = other.outerZs.some((z) => Math.abs(local.z - z) <= TOUCH_TOLERANCE_MM);
    const isNearRim = [part.outline, ...part.holes].some((ring) => distanceToBoundary(flat, ring) <= TOUCH_TOLERANCE_MM);
    // Mitt på den andra delens utsida är det ett hörn som går inåt, t.ex. där en tillbyggnad möter väggen: det får också kristyr.
    if (isOnOuterFace && !isNearRim) return false;
    return !(isOnOuterFace && isNearRim && otherIndex > ownerIndex);
  });
}

function isInBox(point: Vec3, part: PreparedPart): boolean {
  const t = TOUCH_TOLERANCE_MM;
  return point.x >= part.min.x - t && point.x <= part.max.x + t && point.y >= part.min.y - t && point.y <= part.max.y + t && point.z >= part.min.z - t && point.z <= part.max.z + t;
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}
