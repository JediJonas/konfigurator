import { intersectOutlines, overlapArea } from '../../../core/geometry/clipping';
import { convexHull } from '../../../core/geometry/hull';
import { invertRigidMatrix, transformPoint } from '../../../core/geometry/matrix';
import type { ConvexSlab } from '../../../core/geometry/slabOverlap';
import { doSlabsOverlap, slabFromFaces } from '../../../core/geometry/slabOverlap';
import type { Polygon } from '../../../core/geometry/polygon';
import type { Vec2, Vec3 } from '../../../core/geometry/vector';
import { cross3, dot3, subtract3, vec2, vec3 } from '../../../core/geometry/vector';
import type { Part } from '../../../core/model/part';
import type { InteractionConflict } from '../../../core/pipeline/interaction';
import type { WorldHalfSpace } from '../../../core/pipeline/partRegions';
import { regionOnPart, regionThroughPart, removeRegionsFromPart } from '../../../core/pipeline/partRegions';
import type { PlacedInstance } from '../../../core/pipeline/placeInstances';
import type { SectionInBuilding } from './buildings';
import { bodyHalfSpaces, isRoofPartOf, listPairsAcrossBuildings, wallPlanOf } from './buildings';

/** Tak som går in i varandra mindre än så räknas som att de bara nuddar. */
const ROOF_CLASH_TOLERANCE_MM = 0.05;
/** Tak som når in i varandra på en mindre yta än så räknas som att de bara nuddar. */
const ROOF_CLASH_AREA_MM2 = 0.5;

/**
 * Tak, takutsprång och takkanter som når in i en sektion i en annan byggnad,
 * t.ex. husets takutsprång där ett torn står, kapas mot tornets väggar och
 * tak. Blir taket flera bitar behålls den som når längst bort från den andra sektionen.
 *
 * Utanför båda byggnaderna kan två takutsprång korsa varandra, t.ex. vid
 * hörnet där en sektion bredvid står strax högre än husets takfot. Där läggs
 * taket med den lägre takfoten under: dess utsprång kapas där det skulle gå
 * genom det andra taket. Är takfötterna lika höga läggs den senare under.
 */
export function cutRoofsAtNeighbors(sections: readonly SectionInBuilding[], parts: readonly Part[]): Part[] {
  const pairs = listPairsAcrossBuildings(sections);
  const cutAtBodies = pairs
    .flatMap(([first, second]) => [
      [first.entry, second.entry],
      [second.entry, first.entry],
    ])
    .reduce<Part[]>((current, [owner, neighbor]) => (owner && neighbor ? cutRoofsInto(current, owner, neighbor) : current), [...parts]);
  return pairs.reduce((current, [first, second]) => {
    const isFirstLower = eaveHeightOf(first.entry) < eaveHeightOf(second.entry);
    const [lower, upper] = isFirstLower ? [first.entry, second.entry] : [second.entry, first.entry];
    return tuckRoofUnder(current, lower, upper);
  }, cutAtBodies);
}

function eaveHeightOf(entry: PlacedInstance): number {
  return Number(entry.params.wallHeight);
}

/**
 * Det lägre takets utsprång, utanför dess egna väggar, kapas där det går genom
 * det högre takets delar, och vidare utåt från väggen ända ut till kanten, så
 * att det inte blir ett hål i utsprånget där det högre takets hörn sticker igenom.
 */
function tuckRoofUnder(parts: readonly Part[], lower: PlacedInstance, upper: PlacedInstance): Part[] {
  const upperSlabs = parts.filter((part) => isRoofPartOf(part, upper.instance.id)).map(describeSlab);
  const outsideWalls = outsidePlanHalfSpaces(wallPlanOf(lower));
  const center = planCenter(upper);
  const reachAway = (points: Vec3[]) => Math.max(...points.map((point) => Math.hypot(point.x - center.x, point.z - center.z)));
  return parts.flatMap((part) => {
    if (!isRoofPartOf(part, lower.instance.id)) return [part];
    const crossing = upperSlabs.filter((slab) => doSlabsOverlap(describeSlab(part), slab, ROOF_CLASH_TOLERANCE_MM));
    if (crossing.length === 0) return [part];
    const regions = crossing.flatMap((slab) =>
      outsideWalls(0).map((outside) => sweepOutward(part, regionThroughPart(part, [...insideSlab(slab, 0), outside]), outside.normal)),
    );
    const clipped = removeRegionsFromPart(part, regions, reachAway);
    return clipped ? [clipped] : [];
  });
}

/** Så långt ett område dras ut, längre än något tak. */
const SWEEP_LENGTH_MM = 10_000;

/**
 * Området utdraget bort från väggen, i delens plan. `inward` pekar in mot
 * väggen sett uppifrån. Området är konvext, så det utdragna är höljet av
 * området och dess utflyttade kopia.
 */
function sweepOutward(part: Part, region: Vec2[], inward: Vec3): Vec2[] {
  if (region.length < 3) return region;
  const toPart = invertRigidMatrix(part.transform);
  const origin = transformPoint(toPart, vec3(0, 0, 0));
  const away = transformPoint(toPart, vec3(-inward.x, -inward.y, -inward.z));
  const direction = vec2(away.x - origin.x, away.y - origin.y);
  const length = Math.hypot(direction.x, direction.y);
  if (length === 0) return region;
  const shift = vec2((direction.x / length) * SWEEP_LENGTH_MM, (direction.y / length) * SWEEP_LENGTH_MM);
  return convexHull([...region, ...region.map((point) => vec2(point.x + shift.x, point.y + shift.y))]);
}

/** Plattan som halvrum: över undersidan, under ovansidan och innanför kanterna. */
function insideSlab(slab: ConvexSlab, depth: number): WorldHalfSpace[] {
  return [...slabFaces(slab, depth), ...slabEnds(slab, depth)];
}

function slabFaces(slab: ConvexSlab, depth: number): WorldHalfSpace[] {
  const half = slab.corners.length / 2;
  const [firstBottom, firstTop] = [slab.corners[0], slab.corners[half]];
  if (!firstBottom || !firstTop) return [];
  const down = vec3(-slab.normal.x, -slab.normal.y, -slab.normal.z);
  return [
    { normal: down, offset: dot3(down, firstBottom), depth },
    { normal: slab.normal, offset: dot3(slab.normal, firstTop), depth },
  ];
}

/** Innanför plattans kanter. */
function slabEnds(slab: ConvexSlab, depth: number): WorldHalfSpace[] {
  const half = slab.corners.length / 2;
  const bottom = slab.corners.slice(0, half);
  const center = bottom.reduce((sum, point) => vec3(sum.x + point.x / half, sum.y + point.y / half, sum.z + point.z / half), vec3(0, 0, 0));
  return bottom.map((start, index): WorldHalfSpace => {
    const edge = slab.edgeDirections[index] ?? vec3(0, 0, 0);
    const across = cross3(edge, slab.normal);
    const outward = dot3(across, subtract3(center, start)) > 0 ? vec3(-across.x, -across.y, -across.z) : across;
    return { normal: outward, offset: dot3(outward, start), depth };
  });
}

/** Utanför en konvex polygon moturs sett uppifrån, ett halvrum per kant, där polygonens y är z. */
function outsidePlanHalfSpaces(plan: Polygon): (depth: number) => WorldHalfSpace[] {
  return (depth) =>
    plan.map((start, index) => {
      const end = plan[(index + 1) % plan.length] ?? start;
      // Moturs med y som z är (dz, −dx) utåt; utanför kanten är −utåt · p ≤ −utåt · start.
      const inward = vec3(-(end.y - start.y), 0, end.x - start.x);
      return { normal: inward, offset: inward.x * start.x + inward.z * start.y, depth };
    });
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
  return removeRegionsFromPart(part, [regionThroughPart(part, bodyHalfSpaces(neighbor, 0))], reachAway);
}

function planCenter(entry: PlacedInstance): Vec3 {
  const plan = wallPlanOf(entry);
  const x = plan.reduce((sum, point) => sum + point.x, 0) / plan.length;
  const z = plan.reduce((sum, point) => sum + point.y, 0) / plan.length;
  return vec3(x, 0, z);
}

/**
 * Tak från sektioner i olika byggnader som fortfarande går in i varandra
 * efter kapningen kan inte byggas; det skulle behöva en vinkelränna. Den
 * senare sektionen får felet. Kapningen räknas bara när två tak som de byggdes
 * går in i varandra, så att kontrollen går fort.
 */
export function listRoofClashes(sections: readonly SectionInBuilding[]): InteractionConflict[] {
  const pairs = listPairsAcrossBuildings(sections);
  let cutParts: Part[] | undefined;
  const cutRoofPartsOf = (instanceId: string) => {
    cutParts ??= cutRoofsAtNeighbors(sections, sections.flatMap((section) => section.entry.parts));
    return cutParts.filter((part) => isRoofPartOf(part, instanceId));
  };
  const doRawRoofsMeet = (first: PlacedInstance, second: PlacedInstance) =>
    roofPartsOf(first).some((part) => roofPartsOf(second).some((other) => doSlabsOverlap(describeSlab(part), describeSlab(other), ROOF_CLASH_TOLERANCE_MM)));
  const doCutRoofsMeet = (first: PlacedInstance, second: PlacedInstance) =>
    cutRoofPartsOf(first.instance.id).some((part) => cutRoofPartsOf(second.instance.id).some((other) => doPartsOverlap(part, other)));
  return pairs
    .filter(([first, second]) => doRawRoofsMeet(first.entry, second.entry) && doCutRoofsMeet(first.entry, second.entry))
    .map(([, second]) => ({ instanceId: second.entry.instance.id, messageKey: 'rule.roofsMeet' }));
}

/**
 * Delar med hack är inte konvexa. Den del av den ena som når in i den andras
 * hölje fälls därför ner i den andras plan och prövas mot dess egen kontur.
 */
function doPartsOverlap(part: Part, other: Part): boolean {
  if (!doSlabsOverlap(describeSlab(part), describeSlab(other), ROOF_CLASH_TOLERANCE_MM)) return false;
  const toOther = invertRigidMatrix(other.transform);
  return [0, part.thickness].some((depth) => {
    const region = regionOnPart(part, insideSlab(describeSlab(other), depth));
    if (region.length < 3) return false;
    return intersectOutlines(part.outline, region).some((piece) => {
      const inOtherPlane = piece.map((point) => {
        const local = transformPoint(toOther, transformPoint(part.transform, vec3(point.x, point.y, depth)));
        return vec2(local.x, local.y);
      });
      return inOtherPlane.length >= 3 && overlapArea(other.outline, inOtherPlane) > ROOF_CLASH_AREA_MM2;
    });
  });
}

function roofPartsOf(entry: PlacedInstance): Part[] {
  return entry.parts.filter((part) => isRoofPartOf(part, entry.instance.id));
}

function describeSlab(part: Part): ConvexSlab {
  const hull = convexHull(part.outline);
  const face = (z: number) => hull.map((point) => transformPoint(part.transform, vec3(point.x, point.y, z)));
  return slabFromFaces(face(0), face(part.thickness));
}
