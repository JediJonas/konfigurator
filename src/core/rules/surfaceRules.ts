import { overlapArea, uncoveredArea } from '../geometry/clipping';
import type { Matrix4 } from '../geometry/matrix';
import { signedArea } from '../geometry/polygon';
import { invertRigidMatrix, transformPoint } from '../geometry/matrix';
import type { Vec2, Vec3 } from '../geometry/vector';
import { vec2 } from '../geometry/vector';
import type { SurfaceArea } from '../model/objectType';
import type { Part } from '../model/part';
import { isPieceOf } from '../model/part';
import type { PlacedInstance } from '../pipeline/placeInstances';

/** Så mycket av ytan som får sakna del, i mm², för avrundning i klippningen. */
const SOLID_TOLERANCE_MM2 = 0.5;
/** Två objekts ytor som överlappar mindre än så räknas som att de bara nuddar varandra. */
const COVER_TOLERANCE_MM2 = 0.5;

/**
 * Objekt vars ytor inte ligger på hel del, t.ex. ett fönster för nära
 * väggens kant, i en öppning för en tillbyggnad eller i en vägg som en granne
 * har tagit bort. Objektets egna öppningar räknas som hel del.
 */
export function findOffSolidPart(entries: readonly PlacedInstance[], parts: readonly Part[]): string[] {
  return entries.filter((entry) => entry.surfaceAreas.some((area) => !isOnSolidPart(entry, area, parts))).map((entry) => entry.instance.id);
}

function isOnSolidPart(entry: PlacedInstance, area: SurfaceArea, parts: readonly Part[]): boolean {
  const pieces = parts.filter((part) => isPieceOf(part, area.targetPartId));
  const [first] = pieces;
  if (!first) return false;
  const toPart = invertRigidMatrix(first.transform);
  const ownOpenings = entry.modifiers
    .filter((modifier) => modifier.targetPartId === area.targetPartId)
    .map((modifier) => ({ outline: projectOnto(toPart, modifier.region), holes: [] }));
  return uncoveredArea(projectOnto(toPart, area.solidRegion), [...pieces, ...ownOpenings]) <= SOLID_TOLERANCE_MM2;
}

/**
 * Objekt som tar samma yta på en del som ett tidigare objekt, av vilken typ
 * som helst, t.ex. två fönsterluckor som går in i varandra. Det senare får felet.
 */
export function findCoveringOthers(entries: readonly PlacedInstance[], placed: readonly PlacedInstance[], parts: readonly Part[]): string[] {
  const withAreas = placed.filter((entry) => entry.surfaceAreas.length > 0);
  return entries
    .filter((entry) => {
      const index = withAreas.indexOf(entry);
      return withAreas.slice(0, Math.max(index, 0)).some((earlier) => doCover(entry, earlier, parts));
    })
    .map((entry) => entry.instance.id);
}

function doCover(entry: PlacedInstance, other: PlacedInstance, parts: readonly Part[]): boolean {
  return entry.surfaceAreas.some((area) =>
    other.surfaceAreas.some((otherArea) => {
      if (otherArea.targetPartId !== area.targetPartId) return false;
      const part = parts.find((candidate) => isPieceOf(candidate, area.targetPartId));
      if (!part) return false;
      const toPart = invertRigidMatrix(part.transform);
      return overlapArea(projectOnto(toPart, area.coveredRegion), projectOnto(toPart, otherArea.coveredRegion)) > COVER_TOLERANCE_MM2;
    }),
  );
}

/** Punkter i världen i delens plan. Områdena ligger parallellt med delen, så djupet kan släppas. */
function projectOnto(toPart: Matrix4, points: readonly Vec3[]): Vec2[] {
  const projected = points.map((point) => {
    const local = transformPoint(toPart, point);
    return vec2(local.x, local.y);
  });
  return signedArea(projected) >= 0 ? projected : [...projected].reverse();
}

/** Objekt utöver de `max` första i samma kopplingspunkt på samma förälder. */
export function findBeyondCount(entries: readonly PlacedInstance[], max: number): string[] {
  const counts = new Map<string, number>();
  return entries
    .filter((entry) => {
      const socketId = entry.instance.attachment?.socketId;
      if (!socketId || !entry.parentId) return false;
      const key = `${entry.parentId}/${socketId}`;
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return count > max;
    })
    .map((entry) => entry.instance.id);
}
