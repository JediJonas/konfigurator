import { overlapArea } from '../../../core/geometry/clipping';
import { isPointInPolygon } from '../../../core/geometry/hull';
import type { Polygon } from '../../../core/geometry/polygon';
import { transformPoint } from '../../../core/geometry/matrix';
import type { Vec3 } from '../../../core/geometry/vector';
import { dot3, subtract3, vec2, vec3 } from '../../../core/geometry/vector';
import type { Part } from '../../../core/model/part';
import type { InteractionConflict, InteractionResolver } from '../../../core/pipeline/interaction';
import type { WorldHalfSpace } from '../../../core/pipeline/partRegions';
import { regionThroughPart, removeRegionsFromPart } from '../../../core/pipeline/partRegions';
import type { PlacedInstance } from '../../../core/pipeline/placeInstances';
import { CHIMNEY_TYPE_ID, isOnWall } from '../objects/chimney/chimney';
import { wallChimneyBody, wallChimneyTop } from '../objects/chimney/chimneyOnWall';
import type { ChimneyParams } from '../objects/chimney/chimneyParams';
import type { ChimneyHalfSpace } from '../objects/chimney/chimneyShape';
import { chimneyBody, chimneyFootprintOnRoof } from '../objects/chimney/chimneyShape';
import { SECTION_TYPE_ID } from '../objects/section';
import { measureHostPitch } from '../objects/roofMount';
import { hostWallPlan, isUpright } from './valleys';

/** Ett annat objekts del som tar mindre än så av skorstenens kropp räknas som att den bara nuddar den. */
const CONFLICT_AREA_MM2 = 1;
/** Så mycket får skorstenen gå utanför väggarna för avrundning. */
const WALL_PLAN_TOLERANCE_MM = 0.01;

type WorldSpace = Pick<WorldHalfSpace, 'normal' | 'offset'>;

/**
 * En skorsten på taket ändrar inga delar; dess sidor står redan på takytan.
 * En skorsten mot en vägg går upp genom husets takutsprång, som får ett urtag
 * där den står. Skorstenen krockar med ett annat objekts delar som går in i
 * den, t.ex. en tillbyggnads tak eller en takkupas takutsprång. Husets egna
 * delar räknas inte: skorstenen står på dem, eller går genom utsprånget, med flit.
 */
export const chimneyResolver: InteractionResolver = {
  id: 'gb.chimneys',
  affectsSurfaces: false,
  resolve: (placed, parts) => placed.filter(isWallChimney).reduce<Part[]>((current, entry) => notchHostRoof(entry, current), [...parts]),
  listConflicts: (placed) => placed.flatMap((entry) => [...findOverhangConflicts(placed, entry), ...findChimneyConflicts(placed, entry)]),
};

function isWallChimney(entry: PlacedInstance): boolean {
  return entry.instance.type === CHIMNEY_TYPE_ID && isOnWall(entry.context);
}

/** Husets tak där skorstenen går upp genom det, t.ex. takutsprånget vid takfoten. */
function notchHostRoof(entry: PlacedInstance, parts: readonly Part[]): Part[] {
  const body = describeBody(entry);
  const inward = entry.socket ? vec3(-entry.socket.frame.normal.x, 0, -entry.socket.frame.normal.z) : vec3(0, 0, 0);
  // Blir en del flera bitar behålls den som når längst in över huset.
  const reachInward = (points: Vec3[]) => Math.max(...points.map((point) => dot3(point, inward)));
  return parts.flatMap((part) => {
    if (part.sourceInstanceId !== entry.parentId || isUpright(part)) return [part];
    const clipped = removeRegionsFromPart(part, [regionThroughPart(part, body)], reachInward);
    return clipped ? [clipped] : [];
  });
}

/**
 * En skorsten på taket står ovanför väggarna, inte på takutsprången (ägarens
 * val): den får flyttas längs taket och mot takfoten bara så långt som väggen under.
 */
function findOverhangConflicts(placed: readonly PlacedInstance[], entry: PlacedInstance): InteractionConflict[] {
  if (entry.instance.type !== CHIMNEY_TYPE_ID || !entry.socket || isOnWall(entry.context)) return [];
  const host = placed.find((candidate) => candidate.instance.id === entry.parentId);
  if (host?.instance.type !== SECTION_TYPE_ID) return [];
  const plan: Polygon = hostWallPlan(host);
  const footprint = chimneyFootprintOnRoof(entry.params as ChimneyParams, measureHostPitch(entry.context), 0).map((point) => transformPoint(entry.matrix, point));
  const isOverWalls = footprint.every((point) => isPointInPolygon(vec2(point.x, point.z), plan, WALL_PLAN_TOLERANCE_MM));
  return isOverWalls ? [] : [{ instanceId: entry.instance.id, messageKey: 'rule.chimneyOverWalls' }];
}

function findChimneyConflicts(placed: readonly PlacedInstance[], entry: PlacedInstance): InteractionConflict[] {
  if (entry.instance.type !== CHIMNEY_TYPE_ID || !entry.socket) return [];
  const body = describeBody(entry);
  const others = placed.filter((other) => other !== entry && other.instance.id !== entry.parentId).flatMap((other) => other.parts);
  const hits = others.some((part) => {
    const region = regionThroughPart(part, body);
    return region.length >= 3 && overlapArea(region, part.outline) > CONFLICT_AREA_MM2;
  });
  return hits ? [{ instanceId: entry.instance.id, messageKey: 'rule.chimneyMeetsRoof' }] : [];
}

function describeBody(entry: PlacedInstance): WorldSpace[] {
  const params = entry.params as ChimneyParams;
  const own = isOnWall(entry.context) ? wallChimneyBody(params, wallChimneyTop(params, entry.context)) : chimneyBody(params, measureHostPitch(entry.context));
  return own.map((space) => toWorld(entry, space));
}

function toWorld(entry: PlacedInstance, space: ChimneyHalfSpace): WorldSpace {
  const origin = transformPoint(entry.matrix, vec3(0, 0, 0));
  const normal = subtract3(transformPoint(entry.matrix, space.normal), origin);
  return { normal, offset: space.offset + dot3(normal, origin) };
}
