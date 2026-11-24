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
import { sectionParams } from './sectionParams';

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
/**
 * Så långt från väggens hörn och överkant som en tillbyggnad minst ska stå
 * (ägarens val), så att den aldrig blir lika bred eller hög som väggen.
 */
export const WALL_EDGE_MARGIN_MM = 10;

/** Djup och tak för en ny tillbyggnad. Bredd och vägghöjd räknas från väggen den sitter på. */
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

/**
 * `WALL_EDGE_MARGIN_MM` innanför husets hörn och under takfotens nederkant.
 * Väggen kvar vid öppningen är minst `OPENING_INSET_MM`, eftersom öppningen
 * är så mycket mindre än tillbyggnadens insida.
 */
function sideWallBounds(params: SectionParams): Vec2[] {
  const halfLength = params.depth / 2 - WALL_EDGE_MARGIN_MM;
  const top = eaveEdge(params).y - WALL_EDGE_MARGIN_MM;
  return [vec2(-halfLength, 0), vec2(halfLength, 0), vec2(halfLength, top), vec2(-halfLength, top)];
}

/** `WALL_EDGE_MARGIN_MM` innanför husets hörn och under takets undersida, mätt lodrätt. */
function gableWallBounds(params: SectionParams): Vec2[] {
  const halfWidth = params.width / 2 - WALL_EDGE_MARGIN_MM;
  const sideTop = roofUndersideHeight(params, halfWidth) - WALL_EDGE_MARGIN_MM;
  const ridgeTop = roofUndersideHeight(params, 0) - WALL_EDGE_MARGIN_MM;
  return [vec2(-halfWidth, 0), vec2(halfWidth, 0), vec2(halfWidth, sideTop), vec2(0, ridgeTop), vec2(-halfWidth, sideTop)];
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

/**
 * Det som ska rymmas i värdens kopplingspunkt. Som tillbyggnad: väggarna och
 * takets ovansida sett mot väggen, utan takutsprången, som får gå förbi hörnet
 * så länge de ligger under värdens tak. På fatet: golvytan med takutsprången.
 */
export function sectionSocketOutline(params: SectionParams, context: BuildContext): Vec3[] {
  if (!isExtension(context)) return sectionFootprint(params, context).map((point) => vec3(point.x, 0, point.y));
  const pitch = degreesToRadians(params.roofPitch);
  const halfWidth = params.width / 2;
  const backZ = -params.depth / 2;
  // Takets ovansida: rak linje över väggarna, och nocken där takhalvornas övre hörn slutar (skåran fylls med glasyr).
  const eaveTop = params.wallHeight + context.thickness / Math.cos(pitch);
  const ridgeTop = roofUndersideHeight(params, 0) + context.thickness * Math.cos(pitch);
  const ridgeHalf = context.thickness * Math.sin(pitch);
  return [
    vec3(-halfWidth, 0, backZ),
    vec3(halfWidth, 0, backZ),
    vec3(halfWidth, eaveTop, backZ),
    vec3(ridgeHalf, ridgeTop, backZ),
    vec3(-ridgeHalf, ridgeTop, backZ),
    vec3(-halfWidth, eaveTop, backZ),
  ];
}

/** Golvytan med takutsprången, så att två sektioners tak inte går in i varandra. */
export function sectionFootprint(params: SectionParams, context: BuildContext): Polygon {
  const pitch = degreesToRadians(params.roofPitch);
  const halfWidth: Mm = eaveEdge(params).x + context.thickness * Math.sin(pitch);
  const ends = roofEnds(params, context);
  return [vec2(-halfWidth, ends.back), vec2(halfWidth, ends.back), vec2(halfWidth, ends.front), vec2(-halfWidth, ends.front)];
}

/**
 * Förslagen till en ny tillbyggnad tar högst så stor del av väggen, så att
 * det finns plats att flytta den längs väggen efteråt.
 */
const EXTENSION_MAX_WALL_SHARE = 0.6;
/** Steget mellan storlekarna som prövas. */
const EXTENSION_SIZE_STEP_MM = 20;
/** Vägghöjden prövas i samma steg som fältet för vägghöjd. */
const WALL_HEIGHT_SEARCH_STEP_MM = sectionParams.shape.wallHeight.meta()?.step as number;
const WIDTH_FIELD_STEP_MM = sectionParams.shape.width.meta()?.step as number;
/** Förslagen avrundas nedåt till jämna centimeter. */
const EXTENSION_ROUNDING_MM = 10;
/** Schemats minsta bredd och vägghöjd för en sektion. */
const SECTION_MIN_WIDTH_MM = sectionParams.shape.width.unwrap().minValue ?? 0;
const SECTION_MIN_WALL_HEIGHT_MM = sectionParams.shape.wallHeight.unwrap().minValue ?? 0;

/**
 * Storlekar att pröva, största först. Kopplingspunkten ligger redan
 * `WALL_EDGE_MARGIN_MM` innanför väggens kanter, så förslaget blir smalare
 * och lägre än väggen och en rad tillbyggnader på varandras gavlar trappas
 * ner. Ryms inte den minsta storleken finns inga förslag.
 */
export function listExtensionCandidates(socket: Socket): Record<string, unknown>[] {
  const xs = socket.bounds.map((point) => point.x);
  const usableLength = Math.max(...xs) - Math.min(...xs);
  const wallLength = usableLength + 2 * WALL_EDGE_MARGIN_MM;
  const widths = listSizesDown(Math.min(wallLength * EXTENSION_MAX_WALL_SHARE, usableLength), SECTION_MIN_WIDTH_MM);
  // På en kort vägg blir den så bred som marginalen till hörnen tillåter, om det är minst den minsta bredden.
  const widestFitting = Math.floor(usableLength / WIDTH_FIELD_STEP_MM) * WIDTH_FIELD_STEP_MM;
  const fittingWidths = widths.length > 0 || widestFitting < SECTION_MIN_WIDTH_MM ? widths : [widestFitting];
  // Väggarna föreslås lika stor del av väggens höjd i hörnet som bredden tar av längden (ägarens val), så att
  // raden på gavlarna trappas ner. Är det lägre än minsta höjden börjar förslaget med marginalen under väggens höjd.
  // Ryms inte taket prövas höjderna i fältets steg, så att taket hamnar så nära marginalen som går.
  const cornerHeight = measureCornerHeight(socket);
  const shareHeight = cornerHeight * EXTENSION_MAX_WALL_SHARE;
  const highestWall = shareHeight >= SECTION_MIN_WALL_HEIGHT_MM ? shareHeight : cornerHeight - WALL_EDGE_MARGIN_MM;
  const wallHeights = listSizesDown(highestWall, SECTION_MIN_WALL_HEIGHT_MM, WALL_HEIGHT_SEARCH_STEP_MM);
  return fittingWidths.flatMap((width) =>
    wallHeights.map((wallHeight) => ({
      width,
      depth: EXTENSION_DEPTH_MM,
      wallHeight,
      roofPitch: EXTENSION_PITCH_DEGREES,
      eaveOverhang: EXTENSION_OVERHANG_MM,
      gableOverhang: EXTENSION_OVERHANG_MM,
    })),
  );
}

/**
 * Väggens höjd i hörnet, utan marginalen: gavelns långväggshöjd eller
 * långväggens takfot. Kopplingspunktens överkant förlängs ut till hörnet,
 * eftersom den på en gavel stiger mot nocken.
 */
function measureCornerHeight(socket: Socket): Mm {
  const halfLength = Math.max(...socket.bounds.map((point) => point.x));
  const corner = socket.bounds.find((point) => point.x === halfLength && point.y > 0);
  const top = socket.bounds.reduce((highest, point) => (point.y > highest.y ? point : highest));
  if (!corner) return 0;
  const slope = halfLength === top.x ? 0 : (top.y - corner.y) / (top.x - halfLength);
  return corner.y + slope * WALL_EDGE_MARGIN_MM + WALL_EDGE_MARGIN_MM;
}

/** Från `largest` avrundat nedåt till ett helt `step`, i steg om `step`, och sist `smallest`, som ofta är den som ryms. */
function listSizesDown(largest: Mm, smallest: Mm, step: Mm = EXTENSION_SIZE_STEP_MM): Mm[] {
  const sizes: Mm[] = [];
  const rounding = Math.min(step, EXTENSION_ROUNDING_MM);
  for (let size = Math.floor(largest / rounding) * rounding; size > smallest; size -= step) sizes.push(size);
  if (largest >= smallest) sizes.push(smallest);
  return sizes;
}
