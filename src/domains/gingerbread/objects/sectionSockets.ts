import type { Matrix4 } from '../../../core/geometry/matrix';
import { basisMatrix, identityMatrix } from '../../../core/geometry/matrix';
import type { Polygon } from '../../../core/geometry/polygon';
import type { Mm, Vec2, Vec3 } from '../../../core/geometry/vector';
import { degreesToRadians, vec2, vec3 } from '../../../core/geometry/vector';
import type { Instance } from '../../../core/model/design';
import type { Modifier } from '../../../core/model/modifier';
import type { BuildContext, Socket } from '../../../core/model/objectType';
import { WALL_SURFACE } from '../socketKinds';
import { crossSectionOutline, eaveEdge, isExtension, roofEnds, roofUndersideHeight } from './sectionGeometry';
import type { SectionParams } from './sectionParams';

/**
 * Minst så mycket vägg ska finnas kvar vid sidan av en öppning, SPEC.md
 * avsnitt 5 (minClearance). Annars blir remsan för skör att baka och bära.
 */
export const MIN_WALL_STRIP_MM = 15;
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

/** Storlekar att pröva för en ny tillbyggnad, största först. Djup och tak är desamma. */
const EXTENSION_WIDTHS_MM = [120, 100, 80, 60] as const;
const EXTENSION_WALL_HEIGHTS_MM = [80, 60, 40] as const;
const EXTENSION_DEPTH_MM = 80;
const EXTENSION_OVERHANG_MM = 8;
const EXTENSION_PITCH_DEGREES = 45;

interface WallSocketSpec {
  id: string;
  labelKey: string;
  origin: Vec3;
  /** Längs väggen så att u × normal pekar uppåt. */
  u: Vec3;
  normal: Vec3;
  bounds: Vec2[];
}

/**
 * Väggytorna som tillbyggnader kan fästa i. Origo ligger mitt på väggens
 * utsida i golvhöjd, så att (u, v) är läge längs väggen och höjd.
 */
export function buildSectionSockets(instance: Instance, params: SectionParams, context: BuildContext): Socket[] {
  const halfWidth = params.width / 2;
  const halfDepth = params.depth / 2;
  const sideBounds = sideWallBounds(params);
  const gableBounds = gableWallBounds(params);
  const specs: WallSocketSpec[] = [
    { id: 'side-right', labelKey: 'socket.sideRight', origin: vec3(halfWidth, 0, 0), u: vec3(0, 0, 1), normal: vec3(1, 0, 0), bounds: sideBounds },
    { id: 'side-left', labelKey: 'socket.sideLeft', origin: vec3(-halfWidth, 0, 0), u: vec3(0, 0, -1), normal: vec3(-1, 0, 0), bounds: sideBounds },
    { id: 'gable-front', labelKey: 'socket.gableFront', origin: vec3(0, 0, halfDepth), u: vec3(-1, 0, 0), normal: vec3(0, 0, 1), bounds: gableBounds },
  ];
  if (!isExtension(context)) {
    specs.push({ id: 'gable-back', labelKey: 'socket.gableBack', origin: vec3(0, 0, -halfDepth), u: vec3(1, 0, 0), normal: vec3(0, 0, -1), bounds: gableBounds });
  }
  return specs.map((spec) => ({
    id: spec.id,
    kind: WALL_SURFACE,
    labelKey: spec.labelKey,
    frame: { origin: spec.origin, u: spec.u, normal: spec.normal },
    bounds: spec.bounds,
    ownerPartId: `${instance.id}/${spec.id}`,
  }));
}

/** Under takfotens nederkant, och en remsa från gavlarna i båda ändar. */
function sideWallBounds(params: SectionParams): Vec2[] {
  const halfLength = params.depth / 2 - MIN_WALL_STRIP_MM;
  const top = eaveEdge(params).y;
  return [vec2(-halfLength, 0), vec2(halfLength, 0), vec2(halfLength, top), vec2(-halfLength, top)];
}

/** Under takets undersida, och en remsa från långväggarna på båda sidor. */
function gableWallBounds(params: SectionParams): Vec2[] {
  const halfWidth = params.width / 2 - MIN_WALL_STRIP_MM;
  const sideTop = roofUndersideHeight(params, halfWidth);
  return [vec2(-halfWidth, 0), vec2(halfWidth, 0), vec2(halfWidth, sideTop), vec2(0, roofUndersideHeight(params, 0)), vec2(-halfWidth, sideTop)];
}

/**
 * En tillbyggnad står upprätt med bakre änden mot väggen och framgaveln utåt:
 * eget y uppåt (u × normal), eget z utåt (normal) och eget x mot −u.
 */
export function extensionMountMatrix(params: SectionParams, context: BuildContext): Matrix4 {
  if (!isExtension(context)) return identityMatrix();
  return basisMatrix(vec3(-1, 0, 0), vec3(0, 0, 1), vec3(0, 1, 0), vec3(0, params.depth / 2, 0));
}

/**
 * Öppningen i värdens vägg följer tillbyggnadens insida, men är mindre med
 * `OPENING_INSET_MM` mot långväggarna och takets undersida. Nertill går den ända till golvet.
 */
export function buildOpening(params: SectionParams, context: BuildContext): Modifier[] {
  const targetPartId = context.socket?.ownerPartId;
  if (!isExtension(context) || !targetPartId) return [];
  const backZ = -params.depth / 2;
  // Sänks lodrätt så mycket att kanten blir OPENING_INSET_MM mätt vinkelrätt mot taket.
  const topDrop = OPENING_INSET_MM / Math.cos(degreesToRadians(params.roofPitch));
  const halfWidth = params.width / 2 - context.thickness - OPENING_INSET_MM;
  const region = crossSectionOutline(params, halfWidth).map((point) => vec3(point.x, point.y > 0 ? point.y - topDrop : -OPENING_OVERCUT_MM, backZ));
  return [{ kind: 'removeRegion', targetPartId, region }];
}

/** Golvytan med takutsprången, så att två sektioners tak inte går in i varandra. */
export function sectionFootprint(params: SectionParams, context: BuildContext): Polygon {
  const pitch = degreesToRadians(params.roofPitch);
  const halfWidth: Mm = eaveEdge(params).x + context.thickness * Math.sin(pitch);
  const ends = roofEnds(params, context);
  return [vec2(-halfWidth, ends.back), vec2(halfWidth, ends.back), vec2(halfWidth, ends.front), vec2(-halfWidth, ends.front)];
}

export function listExtensionCandidates(): Record<string, unknown>[] {
  return EXTENSION_WIDTHS_MM.flatMap((width) =>
    EXTENSION_WALL_HEIGHTS_MM.map((wallHeight) => ({
      width,
      depth: EXTENSION_DEPTH_MM,
      wallHeight,
      roofPitch: EXTENSION_PITCH_DEGREES,
      eaveOverhang: EXTENSION_OVERHANG_MM,
      gableOverhang: EXTENSION_OVERHANG_MM,
    })),
  );
}
