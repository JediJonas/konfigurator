import { z } from 'zod';
import type { Matrix4 } from '../../../../core/geometry/matrix';
import type { Mm } from '../../../../core/geometry/vector';
import { degreesToRadians, vec3 } from '../../../../core/geometry/vector';
import type { Modifier } from '../../../../core/model/modifier';
import type { ObjectType, SurfaceArea } from '../../../../core/model/objectType';
import type { Part } from '../../../../core/model/part';
import { BUILD_STEP } from '../../buildOrder';
import { WALL_SURFACE } from '../../socketKinds';
import { planeMatrix } from '../uprightPart';
import { OPENING_SHAPES, openingOutline, toWallPlane, wallRectangle } from './openingShape';
import { eaveHeightOf, OPENING_MARGIN_MM, roundToStep, targetWallId, wallOpeningMountMatrix } from './wallOpening';

export const DOOR_TYPE_ID = 'gb.door';

const HINGE_SIDES = ['left', 'right'] as const;
const MIN_DOOR_WIDTH_MM = 20;
const MIN_DOOR_HEIGHT_MM = 30;
/** Dörren står på glänt, så att man ser att den går att öppna. */
const DEFAULT_OPEN_ANGLE_DEGREES = 30;

export const doorParams = z.object({
  width: z.number().min(MIN_DOOR_WIDTH_MM).max(150).default(35).meta({ labelKey: 'param.openingWidth', unit: 'mm', step: 5 }),
  height: z.number().min(MIN_DOOR_HEIGHT_MM).max(250).default(65).meta({ labelKey: 'param.openingHeight', unit: 'mm', step: 5 }),
  shape: z
    .enum(OPENING_SHAPES)
    .default('rect')
    .meta({ labelKey: 'param.openingShape', optionLabelKeys: Object.fromEntries(OPENING_SHAPES.map((shape) => [shape, `shape.${shape}`])) }),
  hinge: z
    .enum(HINGE_SIDES)
    .default('left')
    .meta({ labelKey: 'param.hinge', optionLabelKeys: Object.fromEntries(HINGE_SIDES.map((side) => [side, `hinge.${side}`])) }),
  openAngle: z.number().min(0).max(90).default(DEFAULT_OPEN_ANGLE_DEGREES).meta({ labelKey: 'param.openAngle', unit: '°', step: 5 }),
});

export type DoorParams = z.infer<typeof doorParams>;

/**
 * Öppningen går en bit under golvet, så att den skär rent genom väggens
 * nederkant i stället för att lämna en kant som bara nuddar.
 */
const DOOR_OVERCUT_MM = 1;
const PROPOSAL_SCALES = [1, 0.8, 0.6, 0.45];
/** Den största dörren som föreslås är så hög i förhållande till väggens höjd vid hörnen. */
const PROPOSED_HEIGHT_SHARE = 0.65;
const PROPOSED_WIDTH_PER_HEIGHT = 0.55;

/**
 * Dörr: en öppning från golvet och ett dörrblad med samma form, som står på
 * glänt utåt. Dörrbladet kan skäras ur biten som blir över när öppningen tas upp.
 */
export const doorType: ObjectType<DoorParams> = {
  id: DOOR_TYPE_ID,
  labelKey: 'object.door',
  params: doorParams,
  instanceIdPrefix: 'D',
  attachesTo: [WALL_SURFACE],
  sockets: () => [],
  parts: (instance, params, context) => [buildDoorLeaf(instance.id, params, context.thickness)],
  modifiers: (_instance, params, context) => buildDoorOpening(params, targetWallId(context)),
  mountMatrix: () => wallOpeningMountMatrix(),
  socketOutline: (params) => wallRectangle(-params.width / 2, 0, params.width / 2, params.height),
  surfaceAreas: (params, context) => describeDoorSurface(params, targetWallId(context)),
  prefersSizeOverCenter: true,
  paramCandidates: (socket) => listDoorCandidates(eaveHeightOf(socket)),
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

/**
 * Dörrbladet har öppningens form och sitter i väggens tjocklek när det är
 * stängt. Det vrids utåt runt gångjärnet, som sitter i öppningens kant på väggens utsida.
 */
function buildDoorLeaf(instanceId: string, params: DoorParams, thickness: Mm): Part {
  const outline = openingOutline({ shape: params.shape, width: params.width, height: params.height, bottom: 0 }).map((point) => ({ x: point.x + params.width / 2, y: point.y }));
  return {
    id: `${instanceId}/leaf`,
    sourceInstanceId: instanceId,
    labelKey: 'part.doorLeaf',
    outline,
    holes: [],
    thickness,
    transform: doorLeafTransform(params, thickness),
    buildStep: BUILD_STEP.details,
  };
}

/**
 * Bladets x går från gångjärnet ut mot den andra kanten. Med gångjärnet till
 * vänster ligger tjockleken innanför bladets plan och med det till höger utanför,
 * så att bladet i båda fallen fyller öppningen när det är stängt.
 */
export function doorLeafTransform(params: DoorParams, thickness: Mm): Matrix4 {
  const angle = degreesToRadians(params.openAngle);
  const up = vec3(0, 1, 0);
  if (params.hinge === 'left') {
    const along = vec3(Math.cos(angle), 0, Math.sin(angle));
    const normal = vec3(-Math.sin(angle), 0, Math.cos(angle));
    const hinge = vec3(-params.width / 2, 0, 0);
    return planeMatrix(along, up, vec3(hinge.x - thickness * normal.x, 0, hinge.z - thickness * normal.z));
  }
  const along = vec3(-Math.cos(angle), 0, Math.sin(angle));
  return planeMatrix(along, up, vec3(params.width / 2, 0, 0));
}

/** Förslag från väggens höjd vid hörnen, från den största dörren till den minsta. */
function listDoorCandidates(eaveHeight: Mm): Record<string, unknown>[] {
  return PROPOSAL_SCALES.map((scale) => {
    const height = roundToStep(eaveHeight * PROPOSED_HEIGHT_SHARE * scale, MIN_DOOR_HEIGHT_MM);
    const width = roundToStep(height * PROPOSED_WIDTH_PER_HEIGHT, MIN_DOOR_WIDTH_MM);
    return { width, height, shape: 'rect', hinge: 'left', openAngle: DEFAULT_OPEN_ANGLE_DEGREES };
  });
}
