import { convexHull } from '../../../core/geometry/hull';
import { transformPoint } from '../../../core/geometry/matrix';
import type { ConvexSlab } from '../../../core/geometry/slabOverlap';
import { doSlabsOverlap, slabFromFaces } from '../../../core/geometry/slabOverlap';
import type { Vec3 } from '../../../core/geometry/vector';
import { vec3 } from '../../../core/geometry/vector';
import type { Part } from '../../../core/model/part';
import type { InteractionConflict } from '../../../core/pipeline/interaction';
import { regionOnPart, removeRegionsFromPart } from '../../../core/pipeline/partRegions';
import type { PlacedInstance } from '../../../core/pipeline/placeInstances';
import type { SectionInBuilding } from './buildings';
import { bodyHalfSpaces, isRoofPartOf, listPairsAcrossBuildings, wallPlanOf } from './buildings';

/** Tak som går in i varandra mindre än så räknas som att de bara nuddar. */
const ROOF_CLASH_TOLERANCE_MM = 0.05;

/**
 * Tak, takutsprång och takkanter som når in i en sektion i en annan byggnad,
 * t.ex. husets takutsprång där ett torn står, kapas mot tornets väggar och
 * stomme. Blir taket flera bitar behålls den som når längst bort från den andra sektionen.
 */
export function cutRoofsAtNeighbors(sections: readonly SectionInBuilding[], parts: readonly Part[]): Part[] {
  return listPairsAcrossBuildings(sections)
    .flatMap(([first, second]) => [
      [first.entry, second.entry],
      [second.entry, first.entry],
    ])
    .reduce<Part[]>((current, [owner, neighbor]) => (owner && neighbor ? cutRoofsInto(current, owner, neighbor) : current), [...parts]);
}

function cutRoofsInto(parts: readonly Part[], owner: PlacedInstance, neighbor: PlacedInstance): Part[] {
  return parts.flatMap((part) => {
    if (!isRoofPartOf(part, owner.instance.id)) return [part];
    const clipped = cutRoofAt(part, neighbor);
    return clipped ? [clipped] : [];
  });
}

/** Takdelen utan det som når in i grannens stomme, eller inget om inget blir kvar. */
function cutRoofAt(part: Part, neighbor: PlacedInstance): Part | undefined {
  const center = planCenter(neighbor);
  const reachAway = (points: Vec3[]) => Math.max(...points.map((point) => Math.hypot(point.x - center.x, point.z - center.z)));
  const regions = [0, part.thickness].map((depth) => regionOnPart(part, bodyHalfSpaces(neighbor, depth)));
  return removeRegionsFromPart(part, regions, reachAway);
}

function planCenter(entry: PlacedInstance): Vec3 {
  const plan = wallPlanOf(entry);
  const x = plan.reduce((sum, point) => sum + point.x, 0) / plan.length;
  const z = plan.reduce((sum, point) => sum + point.y, 0) / plan.length;
  return vec3(x, 0, z);
}

/**
 * Tak från sektioner i olika byggnader som går in i varandra kan inte kapas
 * mot en vägg; det skulle behöva en vinkelränna. Den senare sektionen får felet.
 * Två takdelar som går in i varandra prövas igen efter att de har kapats mot
 * de andra byggnaderna, så att två takändar som båda når in i samma torn inte
 * räknas. Bara de delarna kapas, så att kontrollen går fort.
 */
export function listRoofClashes(sections: readonly SectionInBuilding[]): InteractionConflict[] {
  const pairs = listPairsAcrossBuildings(sections);
  const neighborsOf = (instanceId: string) =>
    pairs.flatMap(([first, second]) => (first.entry.instance.id === instanceId ? [second.entry] : second.entry.instance.id === instanceId ? [first.entry] : []));
  const cutSlabs = new Map<string, ConvexSlab | undefined>();
  const cutSlabOf = (part: Part) => {
    if (!cutSlabs.has(part.id)) {
      const cut = neighborsOf(part.sourceInstanceId).reduce<Part | undefined>((current, neighbor) => current && cutRoofAt(current, neighbor), part);
      cutSlabs.set(part.id, cut && describeSlab(cut));
    }
    return cutSlabs.get(part.id);
  };
  const doClash = (part: Part, other: Part) => {
    if (!doSlabsOverlap(describeSlab(part), describeSlab(other), ROOF_CLASH_TOLERANCE_MM)) return false;
    const [cut, otherCut] = [cutSlabOf(part), cutSlabOf(other)];
    return cut !== undefined && otherCut !== undefined && doSlabsOverlap(cut, otherCut, ROOF_CLASH_TOLERANCE_MM);
  };
  return pairs
    .filter(([first, second]) => roofPartsOf(first.entry).some((part) => roofPartsOf(second.entry).some((other) => doClash(part, other))))
    .map(([, second]) => ({ instanceId: second.entry.instance.id, messageKey: 'rule.roofsMeet' }));
}

function roofPartsOf(entry: PlacedInstance): Part[] {
  return entry.parts.filter((part) => isRoofPartOf(part, entry.instance.id));
}

function describeSlab(part: Part): ConvexSlab {
  const hull = convexHull(part.outline);
  const face = (z: number) => hull.map((point) => transformPoint(part.transform, vec3(point.x, point.y, z)));
  return slabFromFaces(face(0), face(part.thickness));
}
