import { z } from 'zod';
import type { ObjectType, SurfaceArea } from '../../../../core/model/objectType';
import type { Modifier } from '../../../../core/model/modifier';
import type { Part } from '../../../../core/model/part';
import { identityMatrix } from '../../../../core/geometry/matrix';
import type { Mm } from '../../../../core/geometry/vector';
import { BUILD_STEP } from '../../buildOrder';
import { WALL_SURFACE } from '../../socketKinds';
import type { OpeningSize } from './openingShape';
import { crossPanes, OPENING_SHAPES, openingOutline, shutterOutlines, toWallPlane, wallRectangle } from './openingShape';
import { eaveHeightOf, OPENING_MARGIN_MM, roundToStep, targetWallId, wallOpeningMountMatrix } from './wallOpening';

export const WINDOW_TYPE_ID = 'gb.window';

const MULLION_STYLES = ['none', 'cross'] as const;
const MIN_WINDOW_SIZE_MM = 15;
const MIN_SILL_HEIGHT_MM = 5;

export const windowParams = z.object({
  width: z.number().min(MIN_WINDOW_SIZE_MM).max(200).default(30).meta({ labelKey: 'param.openingWidth', unit: 'mm', step: 5, isInherited: true }),
  height: z.number().min(MIN_WINDOW_SIZE_MM).max(250).default(40).meta({ labelKey: 'param.openingHeight', unit: 'mm', step: 5, isInherited: true }),
  sillHeight: z.number().min(MIN_SILL_HEIGHT_MM).max(300).default(30).meta({ labelKey: 'param.sillHeight', unit: 'mm', step: 5, isInherited: true }),
  shape: z
    .enum(OPENING_SHAPES)
    .default('rect')
    .meta({ labelKey: 'param.openingShape', isInherited: true, optionLabelKeys: Object.fromEntries(OPENING_SHAPES.map((shape) => [shape, `shape.${shape}`])) }),
  mullions: z
    .enum(MULLION_STYLES)
    .default('none')
    .meta({ labelKey: 'param.mullions', isInherited: true, optionLabelKeys: Object.fromEntries(MULLION_STYLES.map((style) => [style, `mullions.${style}`])) }),
  hasShutters: z.boolean().default(false).meta({ labelKey: 'param.hasShutters', isInherited: true }),
});

export type WindowParams = z.infer<typeof windowParams>;

/** Fälten som ärvs även när förra fönstrets storlek inte ryms. */
const STYLE_KEYS = ['shape', 'mullions', 'hasShutters'] as const;
/** Förslagens storlekar i förhållande till den största, från störst till minst. */
const PROPOSAL_SCALES = [1, 0.8, 0.6, 0.45];
/** Det största förslaget är så högt i förhållande till väggens höjd vid hörnen. */
const PROPOSED_HEIGHT_SHARE = 0.45;
const PROPOSED_WIDTH_PER_HEIGHT = 0.7;

/**
 * Fönster: ett hål i väggen, med eller utan spröjs och fönsterluckor.
 * Spröjsen blir kvar av väggen, så att fönstret bara är rutor som skärs ut.
 * Luckorna är egna delar som limmas uppslagna mot väggen bredvid fönstret.
 */
export const windowType: ObjectType<WindowParams> = {
  id: WINDOW_TYPE_ID,
  labelKey: 'object.window',
  params: windowParams,
  instanceIdPrefix: 'F',
  attachesTo: [WALL_SURFACE],
  sockets: () => [],
  parts: (instance, params, context) => (params.hasShutters ? buildShutters(instance.id, params, context.thickness) : []),
  modifiers: (_instance, params, context) => buildWindowOpening(params, targetWallId(context)),
  mountMatrix: () => wallOpeningMountMatrix(),
  socketOutline: (params) => wallRectangle(-params.width / 2, params.sillHeight, params.width / 2, params.sillHeight + params.height),
  surfaceAreas: (params, context) => describeWindowSurface(params, targetWallId(context)),
  prefersSizeOverCenter: true,
  paramCandidates: (socket, _context, inherited) => listWindowCandidates(eaveHeightOf(socket), inherited),
};

function sizeOf(params: WindowParams): OpeningSize {
  return { shape: params.shape, width: params.width, height: params.height, bottom: params.sillHeight };
}

function buildWindowOpening(params: WindowParams, targetPartId: string | undefined): Modifier[] {
  if (!targetPartId) return [];
  const size = sizeOf(params);
  const panes = params.mullions === 'cross' ? crossPanes(size) : [openingOutline(size)];
  return panes.map((pane) => ({ kind: 'removeRegion', targetPartId, region: toWallPlane(pane) }));
}

/** Kanten runt fönstret ska vara hel vägg, och luckorna ska ligga mot väggen. */
function describeWindowSurface(params: WindowParams, targetPartId: string | undefined): SurfaceArea[] {
  if (!targetPartId) return [];
  const half = params.width / 2;
  const coveredHalf = params.hasShutters ? params.width : half;
  const solidHalf = Math.max(half + OPENING_MARGIN_MM, coveredHalf);
  const top = params.sillHeight + params.height;
  return [
    {
      targetPartId,
      solidRegion: wallRectangle(-solidHalf, params.sillHeight - OPENING_MARGIN_MM, solidHalf, top + OPENING_MARGIN_MM),
      coveredRegion: wallRectangle(-coveredHalf, params.sillHeight, coveredHalf, top),
    },
  ];
}

function buildShutters(instanceId: string, params: WindowParams, thickness: Mm): Part[] {
  return shutterOutlines(sizeOf(params)).map((outline, index) => ({
    id: `${instanceId}/shutter-${index === 0 ? 'left' : 'right'}`,
    sourceInstanceId: instanceId,
    labelKey: 'part.shutter',
    outline,
    holes: [],
    thickness,
    // Luckan ligger mot väggens utsida, med tjockleken utåt.
    transform: identityMatrix(),
    buildStep: BUILD_STEP.details,
  }));
}

/**
 * Förslag från väggens höjd vid hörnen: ett fönster ungefär mitt på väggen, utan spröjs.
 * Finns det redan ett fönster på sektionen prövas dess värden först, och de mindre
 * förslagen får samma form, spröjs och luckor. Regeln om hel vägg runt fönstret väljer bland dem.
 */
function listWindowCandidates(eaveHeight: Mm, inherited: Record<string, unknown>): Record<string, unknown>[] {
  const scaled = PROPOSAL_SCALES.map((scale) => {
    const height = roundToStep(eaveHeight * PROPOSED_HEIGHT_SHARE * scale, MIN_WINDOW_SIZE_MM);
    const width = roundToStep(height * PROPOSED_WIDTH_PER_HEIGHT, MIN_WINDOW_SIZE_MM);
    const sillHeight = roundToStep((eaveHeight - height) / 2, MIN_SILL_HEIGHT_MM);
    return { width, height, sillHeight, shape: 'rect', mullions: 'none', hasShutters: false };
  });
  if (Object.keys(inherited).length === 0) return scaled;
  const style = Object.fromEntries(STYLE_KEYS.filter((key) => key in inherited).map((key) => [key, inherited[key]]));
  return [{ ...scaled[0], ...inherited }, ...scaled.map((candidate) => ({ ...candidate, ...style }))];
}
