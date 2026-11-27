import { convexHull } from '../../../core/geometry/hull';
import { transformPoint } from '../../../core/geometry/matrix';
import type { Polygon } from '../../../core/geometry/polygon';
import type { Mm, Vec2, Vec3 } from '../../../core/geometry/vector';
import { dot3, subtract3, vec2, vec3 } from '../../../core/geometry/vector';
import type { Part } from '../../../core/model/part';
import type { InteractionResolver } from '../../../core/pipeline/interaction';
import type { WorldHalfSpace } from '../../../core/pipeline/partRegions';
import { regionOnPart, removeRegionsFromPart } from '../../../core/pipeline/partRegions';
import type { PlacedInstance } from '../../../core/pipeline/placeInstances';
import type { Socket } from '../../../core/model/objectType';
import { SECTION_TYPE_ID } from '../objects/section';
import { WALL_SURFACE } from '../socketKinds';
import { notchHostRoof } from './hostRoofNotches';

/** En del räknas som upprätt (vägg eller takkant) när normalen nästan saknar höjd. */
const UPRIGHT_NORMAL_Y = 0.01;
/** En takyta räknas som lutande nedåt utåt när den sjunker mer än så per mm. */
const DOWNWARD_SLOPE = 1e-6;
/** Takytor och takskivor; takkanterna ("rim-") står upprätt och räknas inte. */
const ROOF_PART_PREFIXES = ['roof', 'spire-'];
/** Områden som möts längs en linje får gå så här mycket in i varandra, så att ingen tunn remsa blir kvar mellan dem. */
const REGION_OVERLAP_MM = 0.01;
/** En kant på en takskiva räknas som takfot när den ligger så nära skivans lägsta undersida. */
const EAVE_TOLERANCE_MM = 0.01;
/** Två takytor på värden möts när deras undersidor har ett hörn så nära varandra. */
const MEETING_CORNER_MM = 0.01;

/** En ändyta på en takskiva: halvrummet där skivan ligger och kantens hörn på undersidan. */
interface SlabEnd {
  space: WorldHalfSpace;
  corners: [Vec3, Vec3];
}

/** En takyta på värden som en skiva: undersidans plan, normal uppåt och tjocklek. */
interface HostRoofSlab {
  underside: Vec3;
  normal: Vec3;
  thickness: Mm;
  /** Skivan sett uppifrån (x, z), konvex och moturs. */
  plan: Polygon;
  /** Skivans lägsta undersida, t.ex. takfotens nederkant. */
  lowestUnderside: Mm;
  /**
   * Skivans ändytor utom takfoten, vinkelräta mot skivan, som halvrum där
   * skivan ligger. Vid ett brott, t.ex. mansardtakets, slutar skivan där i
   * stället för att räknas uppåt rakt ovanför sig, över grannskivan.
   */
  ends: SlabEnd[];
  /** Undersidans hörn, för att se vilka skivor som möts. */
  undersideCorners: Vec3[];
  partId: string;
}

/**
 * Vinkelrännor med snickarmetoden (SPEC.md avsnitt 8): huvudhusets tak
 * förblir helt. Tillbyggnadens tak, som är förlängt in över värden, klipps
 * där dess undersida möter värdens tak, så att det ligger ovanpå värdens tak.
 * Fungerar mot alla taktyper, med olika lutning och bredd och när
 * tillbyggnaden är lika hög som värden.
 *
 * Där tillbyggnadens tak ligger helt under värdens takutsprång får det gå in
 * under utsprånget till väggen. Tillbyggnadens väggar och takkanter kapas där
 * de skulle gå upp i värdens takutsprång.
 */
export const valleyResolver: InteractionResolver = {
  id: 'gb.valleys',
  resolve: (placed, parts) =>
    placed.reduce<Part[]>((current, entry) => {
      const host = findHost(placed, entry);
      const socket = entry.socket;
      if (!host || !socket) return current;
      const slabs = describeHostRoof(host);
      const walls = hostWallPlan(host);
      const outward = socket.frame.normal;
      const reachOutward = (points: Vec3[]) => Math.max(...points.map((point) => dot3(point, outward)));
      const withExtension = current.flatMap((part) => {
        if (part.sourceInstanceId !== entry.instance.id) return [part];
        const regions = isUpright(part)
          ? uprightRegions(part, slabs)
          : [
              ...roofRegions(part, slabs, walls),
              ...besideHostWalls(part, slabs, walls, socket),
              beyondHost(part, walls, outward),
              ...insideHostWhenRising(part, socket),
            ];
        const clipped = removeRegionsFromPart(part, regions, reachOutward);
        return clipped ? [clipped] : [];
      });
      const extensionRoofs = withExtension.filter((part) => part.sourceInstanceId === entry.instance.id && isRoofSlab(part));
      const blocked: HostRoofSlab[] = [];
      const withNotches = withExtension.map((part) => {
        if (part.sourceInstanceId !== host.instance.id || !isRoofSlab(part)) return part;
        const slab = slabs.find((candidate) => candidate.partId === part.id);
        const notch = notchHostRoof(part, extensionRoofs, outward, (point) => isSharedCorner(slabs, part.id, point));
        if (notch.kind === 'blocked' && slab) blocked.push(slab);
        return notch.kind === 'notched' ? notch.part : part;
      });
      if (blocked.length === 0) return withNotches;
      // Går det inte att ta urtaget ur värdens skiva kapas tillbyggnadens tak där det går genom den.
      return withNotches.flatMap((part) => {
        if (part.sourceInstanceId !== entry.instance.id || !isRoofSlab(part)) return [part];
        const clipped = removeRegionsFromPart(part, crossingRegions(part, blocked, outward), reachOutward);
        return clipped ? [clipped] : [];
      });
    }, [...parts]),
};

/** Värden när objektet är en tillbyggnad på en annan sektions vägg. */
function findHost(placed: readonly PlacedInstance[], entry: PlacedInstance): PlacedInstance | undefined {
  if (entry.instance.type !== SECTION_TYPE_ID || entry.socket?.kind !== WALL_SURFACE) return undefined;
  const host = placed.find((candidate) => candidate.instance.id === entry.parentId);
  return host?.instance.type === SECTION_TYPE_ID ? host : undefined;
}

function partNormal(part: Part): Vec3 {
  const origin = transformPoint(part.transform, vec3(0, 0, 0));
  return subtract3(transformPoint(part.transform, vec3(0, 0, 1)), origin);
}

/** Takytor och takskivor, inte takkanterna. */
function isRoofSlab(part: Part): boolean {
  return ROOF_PART_PREFIXES.some((prefix) => part.id.slice(part.id.indexOf('/') + 1).startsWith(prefix)) && !isUpright(part);
}

function isUpright(part: Part): boolean {
  return Math.abs(partNormal(part).y) < UPRIGHT_NORMAL_Y;
}

/** Värdens lutande takytor och takskivor som de byggdes, före samverkan. */
function describeHostRoof(host: PlacedInstance): HostRoofSlab[] {
  const roofParts = host.parts.filter(isRoofSlab);
  const undersideOf = (part: Part) => part.outline.map((point) => transformPoint(part.transform, vec3(point.x, point.y, 0)));
  const allCorners = roofParts.map(undersideOf);
  return roofParts.map((part, index) => {
    const underside = allCorners[index] ?? [];
    const otherCorners = allCorners.filter((_, otherIndex) => otherIndex !== index).flat();
    const top = part.outline.map((point) => transformPoint(part.transform, vec3(point.x, point.y, part.thickness)));
    return {
      underside: transformPoint(part.transform, vec3(0, 0, 0)),
      normal: partNormal(part),
      thickness: part.thickness,
      plan: convexHull([...underside, ...top].map((point) => vec2(point.x, point.z))),
      lowestUnderside: Math.min(...underside.map((point) => point.y)),
      ends: describeSlabEnds(part, underside, otherCorners),
      undersideCorners: underside,
      partId: part.id,
    };
  });
}

/** Om hörnet är ett hörn på en annan av värdens takskivor än `partId`. */
function isSharedCorner(slabs: readonly HostRoofSlab[], partId: string, point: Vec3): boolean {
  return slabs.some((slab) => slab.partId !== partId && isNear(point, slab.undersideCorners));
}

function isNear(point: Vec3, corners: readonly Vec3[]): boolean {
  return corners.some((corner) => Math.hypot(point.x - corner.x, point.y - corner.y, point.z - corner.z) < MEETING_CORNER_MM);
}

/** Ändytan på `slab` där den möter `other`, dvs. där båda kantens hörn är hörn på den andra skivan. */
function findMeetingEnd(slab: HostRoofSlab, other: HostRoofSlab): SlabEnd | undefined {
  return slab.ends.find((end) => end.corners.every((corner) => isNear(corner, other.undersideCorners)));
}

/** Utanför en ändyta, dvs. på andra sidan om den än skivan. */
function beyondEnd(end: SlabEnd): WorldHalfSpace {
  const { normal, offset, depth } = end.space;
  return { normal: vec3(-normal.x, -normal.y, -normal.z), offset: -offset, depth };
}

/** Ändytorna längs konturens kanter, utom takfoten: en kant i skivans lägsta höjd som ingen annan skiva möter. */
function describeSlabEnds(part: Part, underside: readonly Vec3[], otherCorners: readonly Vec3[]): SlabEnd[] {
  const lowest = Math.min(...underside.map((point) => point.y));
  const origin = transformPoint(part.transform, vec3(0, 0, 0));
  return part.outline.flatMap((start, index) => {
    const nextIndex = (index + 1) % part.outline.length;
    const end = part.outline[nextIndex] ?? start;
    const [startWorld, endWorld] = [underside[index], underside[nextIndex]];
    if (!startWorld || !endWorld) return [];
    const isLowest = Math.max(startWorld.y, endWorld.y) - lowest < EAVE_TOLERANCE_MM;
    if (isLowest && !(isNear(startWorld, otherCorners) && isNear(endWorld, otherCorners))) return [];
    // Konturen går moturs, så kantens utåtriktade normal i delens plan är (dy, −dx).
    const outwardInPlane = subtract3(transformPoint(part.transform, vec3(end.y - start.y, -(end.x - start.x), 0)), origin);
    return [{ space: { normal: outwardInPlane, offset: dot3(outwardInPlane, startWorld), depth: 0 }, corners: [startWorld, endWorld] }];
  });
}

/** Värdens väggar sett uppifrån, ytterkanten. */
function hostWallPlan(host: PlacedInstance): Polygon {
  const halfWidth = Number(host.params.width) / 2;
  const halfDepth = Number(host.params.depth) / 2;
  const corners = [vec3(-halfWidth, 0, -halfDepth), vec3(halfWidth, 0, -halfDepth), vec3(halfWidth, 0, halfDepth), vec3(-halfWidth, 0, halfDepth)];
  return convexHull(corners.map((corner) => transformPoint(host.matrix, corner)).map((point) => vec2(point.x, point.z)));
}

/** Inom en konvex polygon sett uppifrån, där polygonens y är z. */
function insidePlan(plan: Polygon, depth: Mm): WorldHalfSpace[] {
  return plan.map((start, index) => {
    const end = plan[(index + 1) % plan.length] ?? start;
    const normal = vec3(end.y - start.y, 0, -(end.x - start.x));
    return { normal, offset: normal.x * start.x + normal.z * start.y, depth };
  });
}

function belowTopOf(slab: HostRoofSlab, depth: Mm): WorldHalfSpace {
  const top = vec3(slab.underside.x + slab.normal.x * slab.thickness, slab.underside.y + slab.normal.y * slab.thickness, slab.underside.z + slab.normal.z * slab.thickness);
  return { normal: slab.normal, offset: dot3(slab.normal, top), depth };
}

function belowUndersideOf(slab: HostRoofSlab, depth: Mm): WorldHalfSpace {
  return { normal: slab.normal, offset: dot3(slab.normal, slab.underside), depth };
}

function aboveUndersideOf(slab: HostRoofSlab, depth: Mm): WorldHalfSpace {
  const normal = vec3(-slab.normal.x, -slab.normal.y, -slab.normal.z);
  return { normal, offset: dot3(normal, slab.underside), depth };
}

/** Om takytan sjunker när man går utåt från värden, som ett takfall ner mot takfoten. Normalen pekar uppåt. */
function slopesDownOutward(surface: { normal: Vec3 }, outward: Vec3): boolean {
  return (-surface.normal.x * outward.x - surface.normal.z * outward.z) / surface.normal.y < -DOWNWARD_SLOPE;
}

/**
 * Det som tas bort från en takyta på tillbyggnaden: allt under värdens tak
 * innanför värdens väggar. Där taket går genom en takyta på värden utanför
 * väggarna, t.ex. in under takutsprånget, får värdens takyta ett urtag i
 * stället (`notchHostRoof`).
 */
function roofRegions(part: Part, slabs: readonly HostRoofSlab[], walls: Polygon): Vec2[][] {
  const throughSlabs = slabs.flatMap((slab) => [
    regionOnPart(part, [...insidePlan(slab.plan, 0), ...insidePlan(walls, 0), belowTopOf(slab, 0), ...slab.ends.map((end) => end.space)]),
    regionOnPart(part, [...insidePlan(slab.plan, 0), ...insidePlan(walls, 0), belowUndersideOf(slab, 0)]),
  ]);
  return [...throughSlabs, ...grooveRegions(part, slabs)];
}

/**
 * Där tillbyggnadens tak går genom en takskiva på värden som inte kan få ett
 * urtag. Mot ett takfall som sjunker utåt räknas allt som når över takfotens
 * nederkant som genom takytan, så att taket antingen ligger ovanpå eller går
 * hela vägen in under utsprånget, aldrig båda.
 */
function crossingRegions(part: Part, slabs: readonly HostRoofSlab[], outward: Vec3): Vec2[][] {
  const top = part.thickness;
  return slabs.map((slab) => {
    const crossing: WorldHalfSpace = slopesDownOutward(slab, outward)
      ? { normal: vec3(0, -1, 0), offset: -slab.lowestUnderside, depth: top }
      : aboveUndersideOf(slab, top);
    return regionOnPart(part, [...insidePlan(slab.plan, 0), belowTopOf(slab, 0), crossing, ...slab.ends.map((end) => end.space)]);
  });
}

/**
 * Där två takytor på värden möts i ett utåtgående brott, t.ex. mansardtakets
 * brytlinje eller nocken, lämnar skivornas ovansidor en skåra. Den räknas som
 * fylld, så att tillbyggnadens tak inte får en udd ner i den: under båda
 * ovansidorna, ovanför någon av undersidorna och bortom båda skivornas ändytor
 * där de möts.
 * Värdens tak är konvext, så det gäller alla skivor som möts.
 */
function grooveRegions(part: Part, slabs: readonly HostRoofSlab[]): Vec2[][] {
  const top = part.thickness;
  return slabs.flatMap((slab, index) =>
    slabs.slice(index + 1).flatMap((other) => {
      const [slabEnd, otherEnd] = [findMeetingEnd(slab, other), findMeetingEnd(other, slab)];
      if (!slabEnd || !otherEnd) return [];
      const groove = [...insidePlan(convexHull([...slab.plan, ...other.plan]), 0), belowTopOf(slab, 0), belowTopOf(other, 0), beyondEnd(slabEnd), beyondEnd(otherEnd)];
      return [regionOnPart(part, [...groove, aboveUndersideOf(slab, top)]), regionOnPart(part, [...groove, aboveUndersideOf(other, top)])];
    }),
  );
}

/**
 * Innanför väggen som tillbyggnaden sitter på, för en takyta som stiger in
 * mot värden, t.ex. ett pulpettak som är högst mot väggen. Den möter aldrig
 * värdens tak ovanifrån som en ränna, utan skulle gå upp genom det och
 * fortsätta ovanför, så den slutar vid väggen.
 */
function insideHostWhenRising(part: Part, socket: Socket): Vec2[][] {
  const outward = socket.frame.normal;
  if (!slopesDownOutward({ normal: partNormal(part) }, outward)) return [];
  return [regionOnPart(part, [{ normal: outward, offset: dot3(outward, socket.frame.origin), depth: 0 }])];
}

/**
 * Bortom värdens bortre vägg. Ett tak som ryms enligt reglerna klipps alltid
 * före den, men när en tillbyggnad är för hög ska det förlängda taket inte
 * sticka ut genom hela huset medan felet visas.
 */
function beyondHost(part: Part, walls: Polygon, outward: Vec3): Vec2[] {
  const far = Math.min(...walls.map((corner) => corner.x * outward.x + corner.y * outward.z));
  return regionOnPart(part, [{ normal: outward, offset: far, depth: 0 }]);
}

/**
 * Bredvid värdens väggar, innanför väggen som tillbyggnaden sitter på. När
 * tillbyggnaden når ut till värdens hörn går dess takutsprång förbi värdens
 * vägg, och det förlängda taket ska då inte gå in längs huset, varken under
 * värdens takutsprång eller bredvid värdens tak. Ovanpå värdens takutsprång
 * får det ligga kvar, där det är en del av rännan.
 */
function besideHostWalls(part: Part, slabs: readonly HostRoofSlab[], walls: Polygon, socket: Socket): Vec2[][] {
  if (slabs.length === 0) return [];
  const middle = part.thickness / 2;
  const outward = socket.frame.normal;
  const insideWall: WorldHalfSpace = { normal: outward, offset: dot3(outward, socket.frame.origin), depth: middle };
  const outsideOf = (plan: Polygon, overlap: Mm) =>
    insidePlan(plan, middle).map((edge) => {
      const length = Math.hypot(edge.normal.x, edge.normal.z);
      return { ...edge, normal: vec3(-edge.normal.x, 0, -edge.normal.z), offset: -edge.offset + overlap * length };
    });
  const roofPlan = convexHull(slabs.flatMap((slab) => slab.plan));
  const besideRoof = outsideOf(roofPlan, REGION_OVERLAP_MM).map((edge) => regionOnPart(part, [edge, insideWall]));
  const underOverhang = outsideOf(walls, 0).flatMap((edge) =>
    slabs.map((slab) => regionOnPart(part, [edge, insideWall, ...insidePlan(slab.plan, middle), belowTopOf(slab, middle)])),
  );
  return [...besideRoof, ...underOverhang];
}

/** Det som tas bort från en vägg eller takkant: där den når upp i en takyta på värden. */
function uprightRegions(part: Part, slabs: readonly HostRoofSlab[]): Vec2[][] {
  const middle = part.thickness / 2;
  return slabs.map((slab) => regionOnPart(part, [...insidePlan(slab.plan, middle), aboveUndersideOf(slab, middle)]));
}
