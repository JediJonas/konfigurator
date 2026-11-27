import type { Polygon } from '../../../core/geometry/polygon';
import { transformPoint } from '../../../core/geometry/matrix';
import type { Mm, Vec3 } from '../../../core/geometry/vector';
import { cross3, dot3, subtract3, vec2, vec3 } from '../../../core/geometry/vector';
import type { Part } from '../../../core/model/part';
import { PART_PIECE_SEPARATOR } from '../../../core/model/part';
import type { WorldHalfSpace } from '../../../core/pipeline/partRegions';
import type { PlacedInstance } from '../../../core/pipeline/placeInstances';
import { SECTION_TYPE_ID } from '../objects/section';
import { isExtension, roofContext } from '../objects/sectionGeometry';
import type { SectionParams } from '../objects/sectionParams';
import type { WallId } from '../objects/sectionWalls';
import { listWallSides, wallSupport } from '../objects/sectionWalls';
import { WALL_SURFACE } from '../socketKinds';

/**
 * Byggnader: en sektion som står på fatet, med sina tillbyggnader. Inom en
 * byggnad möts sektionerna med öppning och vinkelränna. Mellan byggnader, t.ex.
 * ett torn bredvid ett hus, delar de vägg och taken kapas mot väggarna.
 */
export interface SectionInBuilding {
  entry: PlacedInstance;
  /** Id på sektionen som står på fatet och som tillbyggnaderna sitter på. */
  buildingId: string;
  /** Ordningen i flödet; den som kommer senare får felet när två inte går ihop. */
  order: number;
}

/** En del som klipps i bitar får id:n som "S1/side-right~2". */
export const PIECE_SEPARATOR = PART_PIECE_SEPARATOR;

const UP = vec3(0, 1, 0);
const WALL_IDS: readonly string[] = ['side-right', 'side-left', 'gable-front', 'gable-back'];

export function listSectionsInBuildings(placed: readonly PlacedInstance[]): SectionInBuilding[] {
  const sections = placed.filter((entry) => entry.instance.type === SECTION_TYPE_ID);
  const byId = new Map(sections.map((entry) => [entry.instance.id, entry]));
  const findBuilding = (entry: PlacedInstance): string => {
    const parent = entry.parentId ? byId.get(entry.parentId) : undefined;
    return entry.socket?.kind === WALL_SURFACE && parent ? findBuilding(parent) : entry.instance.id;
  };
  return sections.map((entry, order) => ({ entry, buildingId: findBuilding(entry), order }));
}

/** Så nära varandra två sektioners delar måste nå för att de ska kunna mötas. */
const NEAR_MARGIN_MM = 1;

/**
 * Par av sektioner i olika byggnader som når fram till varandra, den tidigare
 * först. Sektioner långt ifrån varandra, t.ex. två torn i var sitt hörn av en
 * borg, hoppas över, så att regelkontrollen går fort.
 */
export function listPairsAcrossBuildings(sections: readonly SectionInBuilding[]): [SectionInBuilding, SectionInBuilding][] {
  const boxes = sections.map((section) => measureBox(section.entry));
  return sections.flatMap((first, index) =>
    sections
      .slice(index + 1)
      .filter((second, offset) => second.buildingId !== first.buildingId && areBoxesNear(boxes[index], boxes[index + 1 + offset]))
      .map((second): [SectionInBuilding, SectionInBuilding] => [first, second]),
  );
}

interface Box {
  min: Vec3;
  max: Vec3;
}

function measureBox(entry: PlacedInstance): Box {
  const corners = entry.parts.flatMap((part) => [0, part.thickness].flatMap((z) => part.outline.map((point) => transformPoint(part.transform, vec3(point.x, point.y, z)))));
  const axis = (pick: (point: Vec3) => number) => corners.map(pick);
  return {
    min: vec3(Math.min(...axis((point) => point.x)), Math.min(...axis((point) => point.y)), Math.min(...axis((point) => point.z))),
    max: vec3(Math.max(...axis((point) => point.x)), Math.max(...axis((point) => point.y)), Math.max(...axis((point) => point.z))),
  };
}

function areBoxesNear(a: Box | undefined, b: Box | undefined): boolean {
  if (!a || !b) return false;
  const isApart = (low: number, high: number, otherLow: number, otherHigh: number) => low > otherHigh + NEAR_MARGIN_MM || otherLow > high + NEAR_MARGIN_MM;
  return !(isApart(a.min.x, a.max.x, b.min.x, b.max.x) || isApart(a.min.y, a.max.y, b.min.y, b.max.y) || isApart(a.min.z, a.max.z, b.min.z, b.max.z));
}

/** Väggens id om delen är en vägg (eller en bit av en) på objektet, annars inget. */
export function findWallIdOf(part: Part, instanceId: string): WallId | undefined {
  const prefix = `${instanceId}/`;
  if (!part.id.startsWith(prefix)) return undefined;
  const local = part.id.slice(prefix.length).split(PIECE_SEPARATOR)[0] ?? '';
  return WALL_IDS.includes(local) ? (local as WallId) : undefined;
}

export function isRoofPartOf(part: Part, instanceId: string): boolean {
  return part.sourceInstanceId === instanceId && findWallIdOf(part, instanceId) === undefined;
}

/** En vägg i världen: ytterkanten i golvhöjd, från hörn till hörn, och riktningen utåt. */
export interface WorldWallSide {
  id: WallId;
  start: Vec3;
  end: Vec3;
  along: Vec3;
  outward: Vec3;
  length: Mm;
}

export function listWorldWallSides(entry: PlacedInstance): WorldWallSide[] {
  const params = entry.params as SectionParams;
  return listWallSides(params, isExtension(entry.context)).map((side) => {
    const start = transformPoint(entry.matrix, vec3(side.outerStart.x, 0, side.outerStart.y));
    const end = transformPoint(entry.matrix, vec3(side.outerEnd.x, 0, side.outerEnd.y));
    const offset = subtract3(end, start);
    const length = Math.hypot(offset.x, offset.z);
    const along = vec3(offset.x / length, 0, offset.z / length);
    return { id: side.id, start, end, along, outward: cross3(along, UP), length };
  });
}

/** Väggarnas ytterkant sett uppifrån, där polygonens y är z, moturs. */
export function wallPlanOf(entry: PlacedInstance): Polygon {
  const params = entry.params as SectionParams;
  const halfWidth = params.width / 2;
  const halfDepth = params.depth / 2;
  const corners = [vec3(-halfWidth, 0, -halfDepth), vec3(-halfWidth, 0, halfDepth), vec3(halfWidth, 0, halfDepth), vec3(halfWidth, 0, -halfDepth)];
  const plan = corners.map((corner) => transformPoint(entry.matrix, corner)).map((point) => vec2(point.x, point.z));
  return signedPlanArea(plan) > 0 ? plan : [...plan].reverse();
}

function signedPlanArea(plan: Polygon): number {
  return plan.reduce((sum, point, index) => {
    const next = plan[(index + 1) % plan.length] ?? point;
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
}

/**
 * Sektionens stomme: innanför väggarnas ytterkant och under takets
 * undersida. Ett tak från en annan byggnad som når in där kapas. Villkoren
 * prövas på höjden `depth` i delens tjocklek.
 */
export function bodyHalfSpaces(entry: PlacedInstance, depth: Mm): WorldHalfSpace[] {
  const origin = transformPoint(entry.matrix, vec3(0, 0, 0));
  const toWorld = (direction: Vec3) => subtract3(transformPoint(entry.matrix, direction), origin);
  const support = wallSupport(entry.params as SectionParams, roofContext(entry.context, false));
  const belowRoof = support.map((plane): WorldHalfSpace => {
    // y − slopeX · x − slopeZ · z ≤ height i sektionens koordinater.
    const normal = toWorld(vec3(-plane.slopeX, 1, -plane.slopeZ));
    return { normal, offset: plane.height + dot3(normal, origin), depth };
  });
  return [...insidePlan(wallPlanOf(entry), depth), ...belowRoof];
}

/** Inom en konvex polygon moturs sett uppifrån, där polygonens y är z. */
function insidePlan(plan: Polygon, depth: Mm): WorldHalfSpace[] {
  return plan.map((start, index) => {
    const end = plan[(index + 1) % plan.length] ?? start;
    // Moturs med y som z: utåt är (dz, −dx) i (x, z).
    const normal = vec3(end.y - start.y, 0, -(end.x - start.x));
    return { normal, offset: normal.x * start.x + normal.z * start.y, depth };
  });
}
