import { overlapArea } from '../../../core/geometry/clipping';
import { transformPoint } from '../../../core/geometry/matrix';
import { dot3, subtract3, vec3 } from '../../../core/geometry/vector';
import type { InteractionConflict, InteractionResolver } from '../../../core/pipeline/interaction';
import type { WorldHalfSpace } from '../../../core/pipeline/partRegions';
import { regionThroughPart } from '../../../core/pipeline/partRegions';
import type { PlacedInstance } from '../../../core/pipeline/placeInstances';
import { CHIMNEY_TYPE_ID } from '../objects/chimney/chimney';
import type { ChimneyParams } from '../objects/chimney/chimneyParams';
import type { ChimneyHalfSpace } from '../objects/chimney/chimneyShape';
import { chimneyBody } from '../objects/chimney/chimneyShape';
import { measureHostPitch } from '../objects/roofMount';

/** Ett annat objekts del som tar mindre än så av skorstenens kropp räknas som att den bara nuddar den. */
const CONFLICT_AREA_MM2 = 1;

/**
 * Skorstenen ändrar inga delar; dess sidor står redan på takytan. Den krockar
 * med ett annat objekts delar som går in i den, t.ex. en tillbyggnads tak på
 * samma takfall eller en takkupas takutsprång. Husets egna delar räknas inte:
 * skorstenen står på dem med flit.
 */
export const chimneyResolver: InteractionResolver = {
  id: 'gb.chimneys',
  affectsSurfaces: false,
  resolve: (_placed, parts) => [...parts],
  listConflicts: (placed) => placed.flatMap((entry) => findChimneyConflicts(placed, entry)),
};

function findChimneyConflicts(placed: readonly PlacedInstance[], entry: PlacedInstance): InteractionConflict[] {
  if (entry.instance.type !== CHIMNEY_TYPE_ID || !entry.socket) return [];
  const body = chimneyBody(entry.params as ChimneyParams, measureHostPitch(entry.context)).map((space) => toWorld(entry, space));
  const others = placed.filter((other) => other !== entry && other.instance.id !== entry.parentId).flatMap((other) => other.parts);
  const hits = others.some((part) => {
    const region = regionThroughPart(part, body);
    return region.length >= 3 && overlapArea(region, part.outline) > CONFLICT_AREA_MM2;
  });
  return hits ? [{ instanceId: entry.instance.id, messageKey: 'rule.chimneyMeetsRoof' }] : [];
}

function toWorld(entry: PlacedInstance, space: ChimneyHalfSpace): Pick<WorldHalfSpace, 'normal' | 'offset'> {
  const origin = transformPoint(entry.matrix, vec3(0, 0, 0));
  const normal = subtract3(transformPoint(entry.matrix, space.normal), origin);
  return { normal, offset: space.offset + dot3(normal, origin) };
}
