import { overlapArea } from '../../../core/geometry/clipping';
import { transformPoint } from '../../../core/geometry/matrix';
import type { Vec3 } from '../../../core/geometry/vector';
import { dot3, subtract3, vec3 } from '../../../core/geometry/vector';
import type { Part } from '../../../core/model/part';
import type { InteractionConflict, InteractionResolver } from '../../../core/pipeline/interaction';
import type { WorldHalfSpace } from '../../../core/pipeline/partRegions';
import { regionOnPart, regionThroughPart, removeRegionsFromPart } from '../../../core/pipeline/partRegions';
import type { PlacedInstance } from '../../../core/pipeline/placeInstances';
import { DORMER_TYPE_ID } from '../objects/dormer/dormer';
import type { DormerParams } from '../objects/dormer/dormerParams';
import type { DormerHalfSpace } from '../objects/dormer/dormerShape';
import { describeDormer, dormerBody, meetingDistance } from '../objects/dormer/dormerShape';
import { SECTION_TYPE_ID } from '../objects/section';
import { ROOF_SURFACE } from '../socketKinds';
import { beyondHost, describeHostRoof, hostWallPlan, isUpright, roofRegions } from './valleys';

/** Ett annat tak som tar mindre än så av kupans kropp räknas som att det bara nuddar den. */
const CONFLICT_AREA_MM2 = 1;

/**
 * Takkupor (SPEC.md avsnitt 8): kupans väggar kapas där de går ner i husets
 * takfall, så att de står på takytan, och kupans tak, som är förlängt in över
 * huset, klipps i vinkelrännor där det möter husets tak, som för en
 * tillbyggnad. Husets tak förblir helt, bortsett från hålet under kupan.
 */
export const dormerResolver: InteractionResolver = {
  id: 'gb.dormers',
  affectsSurfaces: false,
  resolve: (placed, parts) =>
    placed.reduce<Part[]>((current, entry) => {
      const host = findHost(placed, entry);
      const socket = entry.socket;
      if (!host || !socket) return current;
      const slabs = describeHostRoof(host);
      const walls = hostWallPlan(host);
      const outward = horizontalOutward(socket.frame.normal);
      const belowRoofTop = (depth: number): WorldHalfSpace => ({ normal: socket.frame.normal, offset: dot3(socket.frame.normal, socket.frame.origin), depth });
      const reachOutward = (points: Vec3[]) => Math.max(...points.map((point) => dot3(point, outward)));
      return current.flatMap((part) => {
        if (part.sourceInstanceId !== entry.instance.id) return [part];
        // Väggarna kapas längs utsidan, så att de står på takytan där de syns.
        const regions = isUpright(part) ? [regionOnPart(part, [belowRoofTop(part.thickness)])] : [...roofRegions(part, slabs, walls, outward), beyondHost(part, walls, outward)];
        const clipped = removeRegionsFromPart(part, regions, reachOutward);
        return clipped ? [clipped] : [];
      });
    }, [...parts]),
  listConflicts: (placed) => placed.flatMap((entry) => findRoofConflicts(placed, entry)),
};

/** Sektionen som kupan står på. */
function findHost(placed: readonly PlacedInstance[], entry: PlacedInstance): PlacedInstance | undefined {
  if (entry.instance.type !== DORMER_TYPE_ID || entry.socket?.kind !== ROOF_SURFACE) return undefined;
  const host = placed.find((candidate) => candidate.instance.id === entry.parentId);
  return host?.instance.type === SECTION_TYPE_ID ? host : undefined;
}

/** Vågrätt ut från huset, ner mot takfoten. */
function horizontalOutward(normal: Vec3): Vec3 {
  const length = Math.hypot(normal.x, normal.z);
  return length > 0 ? vec3(normal.x / length, 0, normal.z / length) : vec3(0, 0, 1);
}

/**
 * Kupan krockar med ett annat objekts delar som går in i dess kropp, t.ex. en
 * tillbyggnads tak som ligger ovanpå samma takfall eller en annan kupas tak.
 * Husets egna delar räknas inte: kupan står på dem med flit.
 */
function findRoofConflicts(placed: readonly PlacedInstance[], entry: PlacedInstance): InteractionConflict[] {
  if (!findHost(placed, entry)) return [];
  const shape = describeDormer(entry.params as DormerParams, entry.context, false);
  // Ett pulpettak som lutar lika brant som husets tak eller brantare möter det aldrig.
  if (!Number.isFinite(meetingDistance(shape, 0, true))) return [{ instanceId: entry.instance.id, messageKey: 'rule.dormerRoofTooSteep' }];
  const body = dormerBody(entry.params as DormerParams, shape).map((space) => toWorld(entry, space));
  const others = placed.filter((other) => other !== entry && other.instance.id !== entry.parentId).flatMap((other) => other.parts);
  const hits = others.some((part) => {
    const region = regionThroughPart(part, body);
    return region.length >= 3 && overlapArea(region, part.outline) > CONFLICT_AREA_MM2;
  });
  return hits ? [{ instanceId: entry.instance.id, messageKey: 'rule.dormerMeetsRoof' }] : [];
}

function toWorld(entry: PlacedInstance, space: DormerHalfSpace): Pick<WorldHalfSpace, 'normal' | 'offset'> {
  const origin = transformPoint(entry.matrix, vec3(0, 0, 0));
  const normal = subtract3(transformPoint(entry.matrix, space.normal), origin);
  return { normal, offset: space.offset + dot3(normal, origin) };
}
