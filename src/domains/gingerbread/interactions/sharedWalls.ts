import { addRegion, subtractRegions } from '../../../core/geometry/clipping';
import { clipByHalfPlanes } from '../../../core/geometry/halfPlane';
import { convexHull } from '../../../core/geometry/hull';
import { invertRigidMatrix, transformPoint } from '../../../core/geometry/matrix';
import { signedArea } from '../../../core/geometry/polygon';
import type { Mm, Vec2, Vec3 } from '../../../core/geometry/vector';
import { dot3, subtract3, vec2, vec3 } from '../../../core/geometry/vector';
import type { Part } from '../../../core/model/part';
import type { SectionInBuilding, WorldWallSide } from './buildings';
import { findWallIdOf, listPairsAcrossBuildings, listWorldWallSides, PIECE_SEPARATOR } from './buildings';

/** Väggar vars ytterkanter ligger så här nära samma plan räknas som vägg i vägg. */
const SAME_PLANE_TOLERANCE_MM = 0.01;
/** Väggar som möts kortare sträcka än så räknas inte som gemensamma, t.ex. två hörn som nuddar. */
const MIN_SHARED_LENGTH_MM = 1;
/** Två väggar räknas som lika höga inom så här mycket. */
const EQUAL_HEIGHT_TOLERANCE_MM = 0.01;
/** Hålet går en bit under golvet, så att det skär rent genom väggens nederkant. */
const HOLE_OVERCUT_MM = 1;
/** Hur nära ett hörn en väggände räknas som där, eller en tjocklek därifrån. */
const CORNER_TOLERANCE_MM = 0.01;

/**
 * Gemensam vägg (ägarens val): där två sektioner i olika byggnader står vägg i
 * vägg behålls den högre väggen, och den lägre får ett hål så stort som den
 * högre väggen. Är de lika höga behåller den som kom först sin vägg.
 *
 * Hålet följer den högre väggen hörn till hörn, men slutar en tjocklek
 * innanför dess hörn där den lägre väggen fortsätter förbi, så att den högres
 * väggar har något att stå mot. Täcks den lägre väggens hörn helt förlängs
 * väggen som stod mot den, så att ingen glipa blir kvar där den fanns.
 */
export function joinSharedWalls(sections: readonly SectionInBuilding[], parts: readonly Part[]): Part[] {
  let current = [...parts];
  for (const [first, second] of listPairsAcrossBuildings(sections)) {
    for (const firstSide of listWorldWallSides(first.entry)) {
      for (const secondSide of listWorldWallSides(second.entry)) {
        const band = findSharedBand(firstSide, secondSide);
        if (!band) continue;
        const walls = { first: { section: first, side: firstSide }, second: { section: second, side: secondSide } };
        current = resolveSharedWall(current, walls, band);
      }
    }
  }
  return current;
}

interface WallOfSection {
  section: SectionInBuilding;
  side: WorldWallSide;
}

/** Var längs den första väggen de två väggarna står mot varandra, eller inget om de inte gör det. */
function findSharedBand(first: WorldWallSide, second: WorldWallSide): { from: Mm; to: Mm } | undefined {
  if (dot3(first.outward, second.outward) > -1 + SAME_PLANE_TOLERANCE_MM) return undefined;
  if (Math.abs(dot3(first.outward, subtract3(second.start, first.start))) > SAME_PLANE_TOLERANCE_MM) return undefined;
  const along = (point: Vec3) => dot3(subtract3(point, first.start), first.along);
  const from = Math.max(0, Math.min(along(second.start), along(second.end)));
  const to = Math.min(first.length, Math.max(along(second.start), along(second.end)));
  return to - from > MIN_SHARED_LENGTH_MM ? { from, to } : undefined;
}

function resolveSharedWall(parts: Part[], walls: { first: WallOfSection; second: WallOfSection }, band: { from: Mm; to: Mm }): Part[] {
  const { first, second } = walls;
  const firstTop = measureTopInBand(wallPieces(parts, first), first.side, band);
  const secondTop = measureTopInBand(wallPieces(parts, second), first.side, band);
  if (firstTop === undefined || secondTop === undefined) return parts;
  const isFirstKept = firstTop >= secondTop - EQUAL_HEIGHT_TOLERANCE_MM;
  const [keeper, loser] = isFirstKept ? [first, second] : [second, first];
  return cutLoserWall(parts, keeper, loser);
}

function wallPieces(parts: readonly Part[], wall: WallOfSection): Part[] {
  const instanceId = wall.section.entry.instance.id;
  return parts.filter((part) => part.sourceInstanceId === instanceId && findWallIdOf(part, instanceId) === wall.side.id);
}

/** Väggens högsta punkt inom sträckan längs `frame`, eller inget om väggen inte finns där. */
function measureTopInBand(pieces: readonly Part[], frame: WorldWallSide, band: { from: Mm; to: Mm }): Mm | undefined {
  const tops = pieces.flatMap((part) => {
    const profile = part.outline.map((point) => {
      const world = transformPoint(part.transform, vec3(point.x, point.y, 0));
      return vec2(dot3(subtract3(world, frame.start), frame.along), world.y);
    });
    const inBand = clipByHalfPlanes(convexHull(profile), [
      { normal: vec2(-1, 0), offset: -band.from },
      { normal: vec2(1, 0), offset: band.to },
    ]);
    return inBand.map((point) => point.y);
  });
  return tops.length > 0 ? Math.max(...tops) : undefined;
}

function cutLoserWall(parts: Part[], keeper: WallOfSection, loser: WallOfSection): Part[] {
  const keeperPieces = wallPieces(parts, keeper);
  let current = parts;
  for (const piece of wallPieces(parts, loser)) {
    const hole = describeHole(piece, keeperPieces, { keeper: keeper.side, loser: loser.side });
    current = replacePart(current, piece, subtractRegions(piece, [hole.region]));
    current = hole.coveredCorners.reduce((result, corner) => extendWallsAtCorner(result, loser, corner, piece.thickness), current);
  }
  return current;
}

interface Hole {
  /** I den lägre väggens egna koordinater. */
  region: Vec2[];
  /** Den lägre väggens hörn som hålet täcker, i världen. */
  coveredCorners: Vec3[];
}

/** Hålet i den lägre väggen: den högre väggen, hörn till hörn, utom en tjocklek där den lägre fortsätter förbi. */
function describeHole(piece: Part, keeperPieces: readonly Part[], sides: { keeper: WorldWallSide; loser: WorldWallSide }): Hole {
  const toPiece = invertRigidMatrix(piece.transform);
  const local = (world: Vec3) => {
    const point = transformPoint(toPiece, world);
    return vec2(point.x, point.y);
  };
  const keeperOutline = convexHull(keeperPieces.flatMap((part) => part.outline.map((point) => local(transformPoint(part.transform, vec3(point.x, point.y, 0))))));
  const [keeperStart, keeperEnd] = sortByX(local(sides.keeper.start), local(sides.keeper.end));
  const [loserStart, loserEnd] = sortByX(local(sides.loser.start), local(sides.loser.end));
  const thickness = keeperPieces[0]?.thickness ?? piece.thickness;
  const from = keeperStart.x > loserStart.x + CORNER_TOLERANCE_MM ? keeperStart.x + thickness : keeperStart.x;
  const to = keeperEnd.x < loserEnd.x - CORNER_TOLERANCE_MM ? keeperEnd.x - thickness : keeperEnd.x;
  const reachingCorners = [
    vec2(keeperStart.x, topAtEnd(keeperOutline, 'min')),
    vec2(keeperEnd.x, topAtEnd(keeperOutline, 'max')),
    vec2(keeperStart.x, -HOLE_OVERCUT_MM),
    vec2(keeperEnd.x, -HOLE_OVERCUT_MM),
  ];
  const region = clipByHalfPlanes(convexHull([...keeperOutline, ...reachingCorners]), [
    { normal: vec2(-1, 0), offset: -from },
    { normal: vec2(1, 0), offset: to },
  ]);
  const coveredCorners = [
    ...(from <= loserStart.x + CORNER_TOLERANCE_MM ? [worldCornerAt(sides.loser, local, loserStart.x)] : []),
    ...(to >= loserEnd.x - CORNER_TOLERANCE_MM ? [worldCornerAt(sides.loser, local, loserEnd.x)] : []),
  ];
  return { region, coveredCorners };
}

function sortByX(a: Vec2, b: Vec2): [Vec2, Vec2] {
  return a.x <= b.x ? [a, b] : [b, a];
}

/** Konturens högsta punkt längst till vänster eller höger. */
function topAtEnd(outline: readonly Vec2[], end: 'min' | 'max'): Mm {
  const xs = outline.map((point) => point.x);
  const edge = end === 'min' ? Math.min(...xs) : Math.max(...xs);
  return Math.max(...outline.filter((point) => Math.abs(point.x - edge) < CORNER_TOLERANCE_MM).map((point) => point.y), 0);
}

function worldCornerAt(side: WorldWallSide, local: (world: Vec3) => Vec2, x: Mm): Vec3 {
  return Math.abs(local(side.start).x - x) < Math.abs(local(side.end).x - x) ? side.start : side.end;
}

/** Byter en del mot bitarna som blev kvar. Den största biten behåller id:t. */
function replacePart(parts: Part[], original: Part, pieces: { outline: Vec2[]; holes: Vec2[][] }[]): Part[] {
  const sorted = [...pieces].sort((a, b) => Math.abs(signedArea(b.outline)) - Math.abs(signedArea(a.outline)));
  const replacements = sorted.map((piece, index) => ({
    ...original,
    id: index === 0 ? original.id : `${original.id}${PIECE_SEPARATOR}${index + 1}`,
    outline: piece.outline,
    holes: piece.holes,
  }));
  return parts.flatMap((part) => (part.id === original.id ? replacements : [part]));
}

/**
 * Väggar som stod mellan den borttagna väggen i hörnet, en tjocklek från
 * hörnet, förlängs ut till hörnet med sin höjd där.
 */
function extendWallsAtCorner(parts: Part[], loser: WallOfSection, corner: Vec3, thickness: Mm): Part[] {
  const instanceId = loser.section.entry.instance.id;
  const neighbours = listWorldWallSides(loser.section.entry).filter(
    (side) => side.id !== loser.side.id && [side.start, side.end].some((end) => Math.hypot(end.x - corner.x, end.z - corner.z) < CORNER_TOLERANCE_MM),
  );
  return parts.map((part) => {
    const wallId = findWallIdOf(part, instanceId);
    if (part.sourceInstanceId !== instanceId || !neighbours.some((side) => side.id === wallId)) return part;
    const cornerX = transformPoint(invertRigidMatrix(part.transform), corner).x;
    const xs = part.outline.map((point) => point.x);
    const nearestEnd = [Math.min(...xs), Math.max(...xs)].reduce((best, x) => (Math.abs(x - cornerX) < Math.abs(best - cornerX) ? x : best));
    if (Math.abs(Math.abs(nearestEnd - cornerX) - thickness) > CORNER_TOLERANCE_MM) return part;
    const height = topAtEnd(part.outline.filter((point) => Math.abs(point.x - nearestEnd) < CORNER_TOLERANCE_MM), 'min');
    const [left, right] = [Math.min(nearestEnd, cornerX), Math.max(nearestEnd, cornerX)];
    const extension = [vec2(left, 0), vec2(right, 0), vec2(right, height), vec2(left, height)];
    return { ...part, ...addRegion(part, extension) };
  });
}
