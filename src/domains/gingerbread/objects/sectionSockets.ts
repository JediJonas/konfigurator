import type { HalfPlane } from '../../../core/geometry/halfPlane';
import { clipByHalfPlanes, halfPlaneLeftOf, shrinkHalfPlane, squareAround } from '../../../core/geometry/halfPlane';
import { convexHull } from '../../../core/geometry/hull';
import type { Matrix4 } from '../../../core/geometry/matrix';
import { basisMatrix, identityMatrix } from '../../../core/geometry/matrix';
import type { Polygon } from '../../../core/geometry/polygon';
import { signedArea } from '../../../core/geometry/polygon';
import type { Mm, Vec2, Vec3 } from '../../../core/geometry/vector';
import { dot3, subtract3, vec2, vec3 } from '../../../core/geometry/vector';
import type { Instance } from '../../../core/model/design';
import type { Modifier } from '../../../core/model/modifier';
import type { BuildContext, Socket } from '../../../core/model/objectType';
import { WALL_BESIDE, WALL_SURFACE } from '../socketKinds';
import { isExtension, isNeighbor, listRoofCorners, roofContext } from './sectionGeometry';
import type { SectionParams } from './sectionParams';
import type { WallSide } from './sectionWalls';
import { listWallSides, profileAlong, wallSupport, wallTopProfile } from './sectionWalls';

/**
 * Öppningen går en bit under golvet, så att den skär rent genom väggens
 * nederkant i stället för att lämna en kant som bara nuddar.
 */
const OPENING_OVERCUT_MM = 1;
/**
 * Så mycket av värdens vägg som står kvar innanför tillbyggnadens väggar och
 * tak, runt öppningen (ägarens önskan). Tillbyggnaden får då en kant att
 * fästas mot med glasyr, i stället för att bara möta väggens snittyta.
 */
export const OPENING_INSET_MM = 10;
/** En sektion bredvid ska ha kontakt med väggen minst så många tjocklekar, så att hörnen står mot något. */
const MIN_CONTACT_THICKNESSES = 1;
/** Stort nog att rymma vilken öppning som helst innan den klipps till. */
const OPENING_WORK_AREA_MM = 2000;

/** Väggarna numreras runt huset med början på framgaveln (ägarens val): Vägg 1, Vägg 2 … */
const WALL_NUMBER_ORDER = ['gable-front', 'side-right', 'gable-back', 'side-left'];
/** Fälten som ändrar väggen: långväggarna följer längden och gavlarna bredden. Höjden gäller alla. */
const WALL_PARAM_KEYS: Record<WallSide['pair'], (keyof SectionParams)[]> = {
  side: ['depth', 'wallHeight'],
  gable: ['width', 'wallHeight'],
};

/** "socket.wall1" för den första väggen runt huset bland de väggar sektionen har. En tillbyggnad saknar bakre gavel. */
function wallLabelKey(sideId: string, sides: readonly WallSide[]): string {
  const numbered = WALL_NUMBER_ORDER.filter((id) => sides.some((side) => side.id === id));
  return `socket.wall${numbered.indexOf(sideId) + 1}`;
}

/**
 * Väggytorna som tillbyggnader kan fästa i. Origo ligger mitt på väggens
 * utsida i golvhöjd, så att (u, v) är läge längs väggen och höjd.
 *
 * Tillbyggnadens väggar ska rymmas inom väggen, hörn till hörn (ägarens val,
 * så att den kan vara lika bred som väggen) och under väggens överkant. Taket får gå högre, upp till
 * husets tak sett rakt mot väggen, eftersom vinkelrännan lägger det ovanpå.
 *
 * Varje sektion har också en punkt per vägg för en sektion bredvid
 * (`WALL_BESIDE`). Den har samma ram och yta, men det är bara grannens mitt
 * som behöver ligga på väggen. Även en tillbyggnad har dem, så att t.ex. ett
 * torn kan stå bredvid ett block som sitter på ett annat torn i en borg.
 */
export function buildSectionSockets(instance: Instance, params: SectionParams, context: BuildContext): Socket[] {
  const surfaces = buildWallSurfaceSockets(instance, params, context);
  return [...surfaces, ...surfaces.map((socket) => ({ ...socket, id: `${BESIDE_SOCKET_PREFIX}${socket.id}`, kind: WALL_BESIDE, topBounds: undefined }))];
}

/** Början på id:t för punkterna där en sektion kan stå bredvid, t.ex. "beside-side-right". */
const BESIDE_SOCKET_PREFIX = 'beside-';

function buildWallSurfaceSockets(instance: Instance, params: SectionParams, context: BuildContext): Socket[] {
  const roofCorners = listRoofCorners(params, context);
  const sides = listWallSides(params, isExtension(context));
  return sides.map((side) => {
    const start = vec3(side.outerStart.x, 0, side.outerStart.y);
    const end = vec3(side.outerEnd.x, 0, side.outerEnd.y);
    const origin = vec3((start.x + end.x) / 2, 0, (start.z + end.z) / 2);
    const length = Math.hypot(end.x - start.x, end.z - start.z);
    // Kopplingspunktens u går åt andra hållet än väggens, så att u × normal pekar uppåt.
    const u = vec3((start.x - end.x) / length, 0, (start.z - end.z) / length);
    const normal = vec3(u.z, 0, -u.x);
    const bounds = wallBounds(wallTopProfile(params, roofContext(context, false), side), length);
    const roofInSocket = roofCorners.map((corner) => vec2(dot3(subtract3(corner, origin), u), corner.y));
    return {
      id: side.id,
      kind: WALL_SURFACE,
      labelKey: wallLabelKey(side.id, sides),
      frame: { origin, u, normal },
      bounds,
      topBounds: convexHull([...bounds, ...roofInSocket]),
      ownerPartId: `${instance.id}/${side.id}`,
      paramKeys: WALL_PARAM_KEYS[side.pair],
    };
  });
}

/**
 * Väggens yta i kopplingspunktens (u, v), från hörn till hörn och upp till
 * överkanten. Överkanten är given från väggens början, där u = length / 2.
 */
function wallBounds(topProfile: readonly Vec2[], length: Mm): Vec2[] {
  const halfLength = length / 2;
  const toSocket = (point: Vec2) => vec2(length / 2 - point.x, point.y);
  const top = topProfile.map(toSocket).filter((point) => Math.abs(point.x) < halfLength);
  const ends = [halfLength, -halfLength].map((u) => vec2(u, interpolateTop(topProfile.map(toSocket), u)));
  // Från höger nere moturs: nederkanten, höger ände, överkanten åt vänster, vänster ände.
  const upper = [ends[0], ...top.sort((a, b) => b.x - a.x), ends[1]].filter((point): point is Vec2 => point !== undefined);
  return [vec2(-halfLength, 0), vec2(halfLength, 0), ...upper];
}

/** Överkantens höjd vid `u`, rakt mellan brytpunkterna. */
function interpolateTop(points: readonly Vec2[], u: Mm): Mm {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  for (let index = 0; index < sorted.length - 1; index++) {
    const left = sorted[index];
    const right = sorted[index + 1];
    if (left && right && u >= left.x && u <= right.x) return right.x === left.x ? Math.max(left.y, right.y) : left.y + ((u - left.x) / (right.x - left.x)) * (right.y - left.y);
  }
  return Math.min(...points.map((point) => point.y));
}

/**
 * En tillbyggnad, och en sektion bredvid, står upprätt med bakre änden mot
 * väggen och framgaveln utåt: eget y uppåt (u × normal), eget z utåt (normal) och eget x mot −u.
 */
export function wallMountMatrix(params: SectionParams, context: BuildContext): Matrix4 {
  if (!isExtension(context) && !isNeighbor(context)) return identityMatrix();
  return basisMatrix(vec3(-1, 0, 0), vec3(0, 0, 1), vec3(0, 1, 0), vec3(0, params.depth / 2, 0));
}

/**
 * Öppningen i värdens vägg följer tillbyggnadens insida, men är mindre med
 * `OPENING_INSET_MM` mot långväggarna och takets undersida, och lämnar minst
 * lika mycket av värdens vägg under dess överkant. Nertill går den ända till golvet.
 */
export function buildOpening(params: SectionParams, context: BuildContext): Modifier[] {
  const targetPartId = context.socket?.ownerPartId;
  if (!isExtension(context) || !targetPartId || !context.socket) return [];
  const backZ = -params.depth / 2;
  const innerHalf = params.width / 2 - context.thickness - OPENING_INSET_MM;
  const halfPlanes: HalfPlane[] = [
    { normal: vec2(1, 0), offset: innerHalf },
    { normal: vec2(-1, 0), offset: innerHalf },
    { normal: vec2(0, -1), offset: OPENING_OVERCUT_MM },
    ...undersideHalfPlanes(params, context),
    ...hostTopHalfPlanes(context.socket, context.attachment?.u ?? 0),
  ];
  const region = clipByHalfPlanes(squareAround(vec2(0, 0), OPENING_WORK_AREA_MM), halfPlanes);
  return [{ kind: 'removeRegion', targetPartId, region: region.map((point) => vec3(point.x, point.y, backZ)) }];
}

/** Under takets undersida längs tillbyggnadens bakkant, `OPENING_INSET_MM` mätt vinkelrätt mot taket. */
function undersideHalfPlanes(params: SectionParams, context: BuildContext): HalfPlane[] {
  const halfWidth = params.width / 2;
  const line = { outerStart: vec2(-halfWidth, -params.depth / 2), outerEnd: vec2(halfWidth, -params.depth / 2) };
  const profile = profileAlong(wallSupport(params, roofContext(context, false)), line).map((point) => vec2(point.x - halfWidth, point.y));
  return profile.slice(1).map((end, index) => shrinkHalfPlane(halfPlaneLeftOf(end, profile[index] ?? end), OPENING_INSET_MM));
}

/**
 * Under värdens väggöverkant, `OPENING_INSET_MM` mätt vinkelrätt mot den, så
 * att en hög tillbyggnad inte delar väggen. Kopplingspunktens u blir
 * tillbyggnadens x = läget − u.
 */
function hostTopHalfPlanes(socket: Socket, offset: Mm): HalfPlane[] {
  const inOwnCoordinates = socket.bounds.map((point) => vec2(offset - point.x, point.y));
  const counterClockwise = signedArea(inOwnCoordinates) > 0 ? inOwnCoordinates : [...inOwnCoordinates].reverse();
  return counterClockwise.flatMap((start, index) => {
    const end = counterClockwise[(index + 1) % counterClockwise.length] ?? start;
    // Överkantens kanter går åt vänster i en polygon moturs.
    return end.x < start.x - 1e-9 ? [shrinkHalfPlane(halfPlaneLeftOf(start, end), OPENING_INSET_MM)] : [];
  });
}

/**
 * Tillbyggnadens väggar sett mot värdens vägg: långväggarnas bakre ände, där
 * de möter värden. Taket prövas för sig, se `sectionSocketTopOutline`. På
 * fatet: golvytan med takutsprången. Bredvid en vägg: bara den punkt på den
 * bakre gaveln som ligger närmast väggens mitt, minst en tjocklek innanför
 * gavelns hörn (ägarens val). Sektionen får då vara större än väggen och
 * flyttas så långt man vill, så länge den har kontakt med väggen.
 */
export function sectionSocketOutline(params: SectionParams, context: BuildContext): Vec3[] {
  if (isNeighbor(context)) return [vec3(nearestContactX(params, context), 0, -params.depth / 2)];
  if (!isExtension(context)) return sectionFootprint(params, context).map((point) => vec3(point.x, 0, point.y));
  const backZ = -params.depth / 2;
  const [right, left] = listWallSides(params, true);
  const heightAtBack = (side: typeof right) => {
    if (!side) return params.wallHeight;
    const profile = wallTopProfile(params, roofContext(context, false), side);
    const atBack = side.outerStart.y < side.outerEnd.y ? profile[0] : profile.at(-1);
    return atBack?.y ?? params.wallHeight;
  };
  const halfWidth = params.width / 2;
  return [vec3(-halfWidth, 0, backZ), vec3(halfWidth, 0, backZ), vec3(halfWidth, heightAtBack(right), backZ), vec3(-halfWidth, heightAtBack(left), backZ)];
}

/**
 * Var på den bakre gaveln, i sektionens x, som ligger närmast väggens mitt.
 * Väggens mitt ligger vid sektionens x = läget (se `hostTopHalfPlanes`).
 */
function nearestContactX(params: SectionParams, context: BuildContext): Mm {
  const reach = Math.max(0, params.width / 2 - context.thickness * MIN_CONTACT_THICKNESSES);
  return Math.min(reach, Math.max(-reach, context.attachment?.u ?? 0));
}

/**
 * Tillbyggnadens tak sett mot värdens vägg, inom väggarnas bredd. Takutsprången
 * får gå förbi hörnet, så länge de ligger under värdens tak, och räknas inte.
 */
export function sectionSocketTopOutline(params: SectionParams, context: BuildContext): Vec3[] {
  if (!isExtension(context)) return [];
  const halfWidth = params.width / 2;
  const seen = convexHull(listRoofCorners(params, context).map((corner) => vec2(corner.x, corner.y)));
  const withinWalls = clipByHalfPlanes(seen, [
    { normal: vec2(1, 0), offset: halfWidth },
    { normal: vec2(-1, 0), offset: halfWidth },
  ]);
  return withinWalls.map((point) => vec3(point.x, point.y, -params.depth / 2));
}

/**
 * Ytan på marken som ingen annan sektion får ta. En tillbyggnad räknar med
 * takutsprången, så att två tillbyggnaders tak inte går in i varandra. En
 * sektion som står på fatet räknar bara väggarna, så att sektioner kan stå
 * vägg i vägg; deras tak prövas av samverkan (`interactions/neighbors.ts`).
 */
export function sectionBodyFootprint(params: SectionParams, context: BuildContext): Polygon {
  if (isExtension(context)) return sectionFootprint(params, context);
  const halfWidth = params.width / 2;
  const halfDepth = params.depth / 2;
  return [vec2(-halfWidth, -halfDepth), vec2(halfWidth, -halfDepth), vec2(halfWidth, halfDepth), vec2(-halfWidth, halfDepth)];
}

/** Golvytan med takutsprången. */
export function sectionFootprint(params: SectionParams, context: BuildContext): Polygon {
  const halfWidth = params.width / 2;
  const halfDepth = params.depth / 2;
  const walls = [vec2(-halfWidth, -halfDepth), vec2(halfWidth, -halfDepth), vec2(halfWidth, halfDepth), vec2(-halfWidth, halfDepth)];
  const roof = listRoofCorners(params, context).map((corner) => vec2(corner.x, corner.z));
  return convexHull([...walls, ...roof]);
}
