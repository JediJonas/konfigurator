import { z } from 'zod';
import type { Matrix4 } from '../../../../core/geometry/matrix';
import type { Mm, Vec2 } from '../../../../core/geometry/vector';
import { degreesToRadians, vec2, vec3 } from '../../../../core/geometry/vector';
import { clipByHalfPlanes } from '../../../../core/geometry/halfPlane';
import type { Modifier } from '../../../../core/model/modifier';
import type { ObjectType, SurfaceArea } from '../../../../core/model/objectType';
import type { Part } from '../../../../core/model/part';
import { BUILD_STEP } from '../../buildOrder';
import { WALL_SURFACE } from '../../socketKinds';
import { planeMatrix } from '../uprightPart';
import { DOOR_SHAPES, openingOutline, toWallPlane, wallRectangle } from './openingShape';
import { eaveHeightOf, OPENING_MARGIN_MM, roundToStep, targetWallId, wallOpeningMountMatrix } from './wallOpening';
import { proposedHeadHeight, windowHeadHeightOf } from './openingProposal';

export const DOOR_TYPE_ID = 'gb.door';

/**
 * En enkeldörr har ett dörrblad med gångjärnet till vänster (ägarens val),
 * dubbeldörrar två blad och en öppning inget.
 */
const DOOR_KINDS = ['single', 'double', 'opening'] as const;
type HingeSide = 'left' | 'right';
const MIN_DOOR_WIDTH_MM = 20;
const MIN_DOOR_HEIGHT_MM = 30;
/** Dörren står alltid på glänt, så att man ser att den går att öppna (ägarens val). */
const OPEN_ANGLE_DEGREES = 45;

export const doorParams = z.object({
  kind: z
    .enum(DOOR_KINDS)
    .default('single')
    .meta({ labelKey: 'param.doorKind', optionLabelKeys: Object.fromEntries(DOOR_KINDS.map((kind) => [kind, `doorKind.${kind}`])) }),
  width: z.number().min(MIN_DOOR_WIDTH_MM).max(150).default(35).meta({ labelKey: 'param.openingWidth', unit: 'mm', step: 5 }),
  height: z.number().min(MIN_DOOR_HEIGHT_MM).max(250).default(70).meta({ labelKey: 'param.openingHeight', unit: 'mm', step: 5 }),
  shape: z
    .enum(DOOR_SHAPES)
    .default('rect')
    .meta({ labelKey: 'param.openingShape', optionLabelKeys: Object.fromEntries(DOOR_SHAPES.map((shape) => [shape, `shape.${shape}`])) }),
});

export type DoorParams = z.infer<typeof doorParams>;

/**
 * Öppningen går en bit under golvet, så att den skär rent genom väggens
 * nederkant i stället för att lämna en kant som bara nuddar.
 */
const DOOR_OVERCUT_MM = 1;
const PROPOSAL_SCALES = [1, 0.8, 0.6, 0.45];
const PROPOSED_WIDTH_PER_HEIGHT = 0.55;
/** Fönstret som dörren linjerar med heter så i domänen. Dörren kan inte importera fönstret, som importerar dörren. */
const WINDOW_TYPE_ID = 'gb.window';

/**
 * Dörr: en öppning från golvet och ett dörrblad med samma form, som står på
 * glänt utåt. Dörrbladet kan skäras ur biten som blir över när öppningen tas upp.
 * En dubbeldörr har två blad, varsin halva av öppningen med gångjärnen i
 * öppningens kanter. En öppning är samma hål utan dörrblad.
 */
export const doorType: ObjectType<DoorParams> = {
  id: DOOR_TYPE_ID,
  labelKey: 'object.door',
  params: doorParams,
  instanceIdPrefix: 'D',
  attachesTo: [WALL_SURFACE],
  sockets: () => [],
  parts: (instance, params, context) => buildDoorLeaves(instance.id, params, context.thickness),
  modifiers: (_instance, params, context) => buildDoorOpening(params, targetWallId(context)),
  mountMatrix: () => wallOpeningMountMatrix(),
  socketOutline: (params) => wallRectangle(-params.width / 2, 0, params.width / 2, params.height),
  surfaceAreas: (params, context) => describeDoorSurface(params, targetWallId(context)),
  prefersSizeOverCenter: true,
  paramCandidates: (socket, _context, _inherited, findRelated) => listDoorCandidates(eaveHeightOf(socket), windowHeadOf(findRelated(WINDOW_TYPE_ID))),
};

function buildDoorOpening(params: DoorParams, targetPartId: string | undefined): Modifier[] {
  if (!targetPartId) return [];
  const outline = openingOutline({ shape: params.shape, width: params.width, height: params.height + DOOR_OVERCUT_MM, bottom: -DOOR_OVERCUT_MM });
  return [{ kind: 'removeRegion', targetPartId, region: toWallPlane(outline) }];
}

/** Kanten runt dörren ska vara hel vägg; nertill går den till golvet. */
function describeDoorSurface(params: DoorParams, targetPartId: string | undefined): SurfaceArea[] {
  if (!targetPartId) return [];
  const half = params.width / 2;
  return [
    {
      targetPartId,
      solidRegion: wallRectangle(-half - OPENING_MARGIN_MM, 0, half + OPENING_MARGIN_MM, params.height + OPENING_MARGIN_MM),
      coveredRegion: wallRectangle(-half, 0, half, params.height),
    },
  ];
}

function buildDoorLeaves(instanceId: string, params: DoorParams, thickness: Mm): Part[] {
  const opening = openingOutline({ shape: params.shape, width: params.width, height: params.height, bottom: 0 });
  const edge = params.width / 2;
  const leafOf = (id: string, outline: Vec2[], hinge: HingeSide): Part =>
    buildDoorLeaf(instanceId, { id, outline: leafFromHinge(outline, hinge, edge), hinge, hingeX: hinge === 'left' ? -edge : edge, angle: OPEN_ANGLE_DEGREES }, thickness);
  if (params.kind === 'opening') return [];
  if (params.kind === 'single') return [leafOf(`${instanceId}/leaf`, opening, 'left')];
  const [left, right] = splitInHalves(opening);
  return [leafOf(`${instanceId}/leaf-left`, left, 'left'), leafOf(`${instanceId}/leaf-right`, right, 'right')];
}

/** Öppningens vänstra och högra halva, delade mitt i. */
function splitInHalves(opening: Vec2[]): [Vec2[], Vec2[]] {
  return [clipByHalfPlanes(opening, [{ normal: vec2(1, 0), offset: 0 }]), clipByHalfPlanes(opening, [{ normal: vec2(-1, 0), offset: 0 }])];
}

/**
 * Bladets kontur med x från gångjärnet: med gångjärnet till vänster flyttad dit,
 * med det till höger speglad, så att x alltid växer bort från gångjärnet.
 */
function leafFromHinge(outline: Vec2[], hinge: HingeSide, edge: Mm): Vec2[] {
  if (hinge === 'left') return outline.map((point) => vec2(point.x + edge, point.y));
  return outline.map((point) => vec2(edge - point.x, point.y)).reverse();
}

interface DoorLeaf {
  id: string;
  /** Bladets kontur med x från gångjärnet. */
  outline: Vec2[];
  hinge: HingeSide;
  /** Gångjärnets läge längs väggen, i öppningens kant. */
  hingeX: Mm;
  angle: number;
}

/**
 * Dörrbladet har öppningens form och sitter i väggens tjocklek när det är
 * stängt. Det vrids utåt runt gångjärnet, som sitter i öppningens kant på väggens utsida.
 */
function buildDoorLeaf(instanceId: string, leaf: DoorLeaf, thickness: Mm): Part {
  return {
    id: leaf.id,
    sourceInstanceId: instanceId,
    labelKey: 'part.doorLeaf',
    outline: leaf.outline,
    holes: [],
    thickness,
    transform: doorLeafTransform(leaf, thickness),
    buildStep: BUILD_STEP.details,
  };
}

/**
 * Bladets x går från gångjärnet ut mot den andra kanten. Med gångjärnet till
 * vänster ligger tjockleken innanför bladets plan och med det till höger utanför,
 * så att bladet i båda fallen fyller öppningen när det är stängt.
 */
function doorLeafTransform({ hinge, hingeX, angle: angleDegrees }: DoorLeaf, thickness: Mm): Matrix4 {
  const angle = degreesToRadians(angleDegrees);
  const up = vec3(0, 1, 0);
  if (hinge === 'left') {
    const along = vec3(Math.cos(angle), 0, Math.sin(angle));
    const normal = vec3(-Math.sin(angle), 0, Math.cos(angle));
    return planeMatrix(along, up, vec3(hingeX - thickness * normal.x, 0, -thickness * normal.z));
  }
  const along = vec3(-Math.cos(angle), 0, Math.sin(angle));
  return planeMatrix(along, up, vec3(hingeX, 0, 0));
}

/**
 * Förslag från den största dörren till den minsta. Den största slutar i samma
 * höjd som fönstrens överkant (ägarens önskan): fönstret som sektionen redan har,
 * eller annars fönstret som skulle föreslås på väggen.
 */
function listDoorCandidates(eaveHeight: Mm, windowHead: Mm | undefined): Record<string, unknown>[] {
  const largestHeight = windowHead ?? proposedHeadHeight(eaveHeight);
  return PROPOSAL_SCALES.map((scale) => {
    const height = roundToStep(largestHeight * scale, MIN_DOOR_HEIGHT_MM);
    const width = roundToStep(height * PROPOSED_WIDTH_PER_HEIGHT, MIN_DOOR_WIDTH_MM);
    return { kind: 'single', width, height, shape: 'rect' };
  });
}

function windowHeadOf(windowParams: Record<string, unknown> | undefined): Mm | undefined {
  return windowParams ? windowHeadHeightOf(windowParams) : undefined;
}
