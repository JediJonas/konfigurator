import type { Part } from '../model/part';
import { distanceToBoundary, isPointInPolygon } from './hull';
import { invertRigidMatrix, transformPoint } from './matrix';
import type { Matrix4 } from './matrix';
import type { Mm, Vec3 } from './vector';
import { cross3, dot3, length3, subtract3 } from './vector';

/**
 * Kanterna räknas i bitar av högst så här många mm, så att en kant som delvis
 * döljs av en annan del bara tappar den dolda biten.
 */
const PIECE_LENGTH_MM = 8;
/** En kant som ligger så här nära en annan del, eller i den, räknas som dold av den. */
const TOUCH_TOLERANCE_MM = 0.5;
/** Kanter som är parallella inom så här många grader kan slås ihop till en. */
const PARALLEL_ANGLE_DEGREES = 10;
/** Kanter på fatet (y nära 0) räknas inte som ytterkanter. */
const GROUND_LEVEL_MM = 0.5;

export interface OuterEdgeOptions {
  /** Parallella kanter närmare varandra än så här blir en, i mitten mellan dem, t.ex. två hål på var sin sida om en smal list. */
  mergeDistance: Mm;
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

interface Piece {
  start: Vec3;
  end: Vec3;
  /** Avståndet till kanten den slogs ihop med, eller 0. */
  mergedGap: Mm;
}

/**
 * Ytterkanterna på delarna i världen: konturens och hålens kanter på delens
 * utsida (båda sidor när delen inte har någon insida). En kant som ligger i
 * eller mot en annan del är dold, t.ex. en väggs ände i ett hörn där den andra
 * väggen går ut, eller väggens överkant under taket. Två kanter som sammanfaller
 * eller ligger tätt parallellt blir en, så att en fog mellan två delar bara får
 * en kant. Kanter som ligger på fatet räknas inte.
 */
export function listOuterEdges(parts: readonly Part[], options: OuterEdgeOptions): EdgeLine[] {
  const prepared = parts.map(preparePart);
  const kept = new PieceGrid(options.mergeDistance);
  const runs: Piece[][] = [];
  prepared.forEach((owner, ownerIndex) => {
    for (const ring of [owner.part.outline, ...owner.part.holes]) {
      for (const z of owner.outerZs) {
        ring.forEach((point, index) => {
          const next = ring[(index + 1) % ring.length] ?? point;
          const start = transformPoint(owner.part.transform, { x: point.x, y: point.y, z });
          const end = transformPoint(owner.part.transform, { x: next.x, y: next.y, z });
          let run: Piece[] = [];
          for (const piece of splitIntoPieces(start, end)) {
            const isVisible = !isOnGround(piece) && !isHidden(midpoint(piece), prepared, ownerIndex) && !kept.mergeInto(piece);
            if (isVisible) {
              kept.add(piece);
              run.push(piece);
            } else if (run.length > 0) {
              runs.push(run);
              run = [];
            }
          }
          if (run.length > 0) runs.push(run);
        });
      }
    }
  });
  return runs.map(toEdgeLine);
}

/**
 * Punkterna längs en följd av bitar. En ihopslagen ände förlängs med halva
 * avståndet mellan kanterna, så att t.ex. två spröjs som korsar varandra
 * möts i mitten i stället för att lämna en glipa där rutornas hörn slutar.
 */
function toEdgeLine(run: readonly Piece[]): EdgeLine {
  const first = run[0];
  const last = run[run.length - 1];
  if (!first || !last) return [];
  return [extendBeyond(first.start, first.end, first.mergedGap / 2), ...run.slice(0, -1).map((piece) => piece.end), extendBeyond(last.end, last.start, last.mergedGap / 2)];
}

/** Punkten flyttad bort från `from` med `distance`. */
function extendBeyond(point: Vec3, from: Vec3, distance: Mm): Vec3 {
  const direction = subtract3(point, from);
  const length = length3(direction);
  if (length === 0 || distance === 0) return point;
  return lerp(point, { x: point.x + direction.x, y: point.y + direction.y, z: point.z + direction.z }, distance / length);
}

function preparePart(part: Part): PreparedPart {
  const outerZs = part.hasInsideAtZero ? [part.thickness] : [0, part.thickness];
  const corners = part.outline.flatMap((point) => [0, part.thickness].map((z) => transformPoint(part.transform, { x: point.x, y: point.y, z })));
  const min = { x: Math.min(...corners.map((c) => c.x)), y: Math.min(...corners.map((c) => c.y)), z: Math.min(...corners.map((c) => c.z)) };
  const max = { x: Math.max(...corners.map((c) => c.x)), y: Math.max(...corners.map((c) => c.y)), z: Math.max(...corners.map((c) => c.z)) };
  return { part, toLocal: invertRigidMatrix(part.transform), outerZs, min, max };
}

function splitIntoPieces(start: Vec3, end: Vec3): Piece[] {
  const count = Math.max(1, Math.ceil(length3(subtract3(end, start)) / PIECE_LENGTH_MM));
  return Array.from({ length: count }, (_, index) => ({
    start: lerp(start, end, index / count),
    end: lerp(start, end, (index + 1) / count),
    mergedGap: 0,
  }));
}

function isOnGround(piece: Piece): boolean {
  return piece.start.y <= GROUND_LEVEL_MM && piece.end.y <= GROUND_LEVEL_MM;
}

/**
 * Sant när punkten ligger i eller mot en annan del. Sammanfaller kanten med en
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
    const isOnOuterEdge = other.outerZs.some((z) => Math.abs(local.z - z) <= TOUCH_TOLERANCE_MM) && [part.outline, ...part.holes].some((ring) => distanceToBoundary(flat, ring) <= TOUCH_TOLERANCE_MM);
    return !(isOnOuterEdge && otherIndex > ownerIndex);
  });
}

function isInBox(point: Vec3, part: PreparedPart): boolean {
  const t = TOUCH_TOLERANCE_MM;
  return point.x >= part.min.x - t && point.x <= part.max.x + t && point.y >= part.min.y - t && point.y <= part.max.y + t && point.z >= part.min.z - t && point.z <= part.max.z + t;
}

/** Bitarna som är kvar, i ett rutnät efter mittpunkt så att grannarna hittas fort. */
class PieceGrid {
  private readonly cells = new Map<string, Piece[]>();

  constructor(private readonly mergeDistance: Mm) {}

  add(piece: Piece): void {
    const key = this.keyOf(midpoint(piece));
    const cell = this.cells.get(key);
    if (cell) cell.push(piece);
    else this.cells.set(key, [piece]);
  }

  /**
   * Finns en parallell bit tätt intill flyttas den till mitten mellan de två
   * och sant ges, så att den nya inte läggs till.
   */
  mergeInto(piece: Piece): boolean {
    const center = midpoint(piece);
    const match = this.listNear(center).find((other) => areClose(other, piece, this.mergeDistance));
    if (!match) return false;
    if (match.mergedGap === 0) {
      const startOnPiece = projectOntoLine(match.start, piece);
      match.mergedGap = length3(subtract3(startOnPiece, match.start));
      match.start = lerp(match.start, startOnPiece, 0.5);
      match.end = lerp(match.end, projectOntoLine(match.end, piece), 0.5);
    }
    return true;
  }

  private listNear(point: Vec3): Piece[] {
    const size = this.cellSize();
    const near: Piece[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          near.push(...(this.cells.get(this.keyOf({ x: point.x + dx * size, y: point.y + dy * size, z: point.z + dz * size })) ?? []));
        }
      }
    }
    return near;
  }

  private cellSize(): Mm {
    return Math.max(this.mergeDistance, PIECE_LENGTH_MM);
  }

  private keyOf(point: Vec3): string {
    const size = this.cellSize();
    return `${Math.floor(point.x / size)},${Math.floor(point.y / size)},${Math.floor(point.z / size)}`;
  }
}

/** Sant när bitarna är parallella och den nya bitens mitt ligger tätt bredvid den andra, inom dess längd. */
function areClose(kept: Piece, piece: Piece, mergeDistance: Mm): boolean {
  const keptDirection = subtract3(kept.end, kept.start);
  const pieceDirection = subtract3(piece.end, piece.start);
  const keptLength = length3(keptDirection);
  const pieceLength = length3(pieceDirection);
  if (keptLength === 0 || pieceLength === 0) return false;
  const cosine = Math.abs(dot3(keptDirection, pieceDirection)) / (keptLength * pieceLength);
  if (cosine < Math.cos((PARALLEL_ANGLE_DEGREES * Math.PI) / 180)) return false;
  const offset = subtract3(midpoint(piece), kept.start);
  const along = dot3(offset, keptDirection) / (keptLength * keptLength);
  if (along < 0 || along > 1) return false;
  return length3(cross3(offset, keptDirection)) / keptLength <= mergeDistance;
}

function projectOntoLine(point: Vec3, piece: Piece): Vec3 {
  const direction = subtract3(piece.end, piece.start);
  const lengthSquared = dot3(direction, direction);
  const along = lengthSquared === 0 ? 0 : dot3(subtract3(point, piece.start), direction) / lengthSquared;
  return lerp(piece.start, piece.end, along);
}

function midpoint(piece: Piece): Vec3 {
  return lerp(piece.start, piece.end, 0.5);
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}
