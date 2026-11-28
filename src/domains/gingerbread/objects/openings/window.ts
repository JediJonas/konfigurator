import { z } from 'zod';
import type { ObjectType, RelatedParamsLookup, Socket, SurfaceArea } from '../../../../core/model/objectType';
import type { Modifier } from '../../../../core/model/modifier';
import type { Part } from '../../../../core/model/part';
import { identityMatrix } from '../../../../core/geometry/matrix';
import type { Mm } from '../../../../core/geometry/vector';
import { BUILD_STEP } from '../../buildOrder';
import { DORMER_WALL, WALL_SURFACE } from '../../socketKinds';
import type { OpeningShape, OpeningSize } from './openingShape';
import { arePanesBigEnough, listPanes, MULLION_STYLES, WINDOW_SHAPES, shutterOutlines, toWallPlane, wallRectangle } from './openingShape';
import { eaveHeightOf, openingMarginOf, roundToStep, targetWallId, wallOpeningMountMatrix } from './wallOpening';
import { DOOR_TYPE_ID } from './door';
import { MIN_SILL_HEIGHT_MM, MIN_WINDOW_SIZE_MM, proposeWindowSize, windowOpeningHeight } from './openingProposal';

export const WINDOW_TYPE_ID = 'gb.window';

/** Formerna där höjden väljs fritt. Runt och halvmåne får höjden ur bredden. */
const SHAPES_WITH_HEIGHT = ['arch', 'rect', 'slanted', 'pointed', 'triangle'] as const;
/** Formerna som kan vara speglade (Invertera). */
const SHAPES_WITH_INVERT: readonly OpeningShape[] = ['slanted', 'triangle'];

export const windowParams = z.object({
  width: z.number().min(MIN_WINDOW_SIZE_MM).max(200).default(30).meta({ labelKey: 'param.openingWidth', unit: 'mm', step: 5, isInherited: true }),
  height: z
    .number()
    .min(MIN_WINDOW_SIZE_MM)
    .max(250)
    .default(40)
    .meta({ labelKey: 'param.openingHeight', unit: 'mm', step: 5, isInherited: true, visibleWhen: { shape: SHAPES_WITH_HEIGHT } }),
  sillHeight: z.number().min(MIN_SILL_HEIGHT_MM).max(300).default(30).meta({ labelKey: 'param.sillHeight', unit: 'mm', step: 5, isInherited: true }),
  shape: z
    .enum(WINDOW_SHAPES)
    .default('rect')
    .meta({ labelKey: 'param.openingShape', isInherited: true, optionLabelKeys: Object.fromEntries(WINDOW_SHAPES.map((shape) => [shape, `shape.${shape}`])) }),
  mullions: z
    .enum(MULLION_STYLES)
    .default('none')
    .meta({ labelKey: 'param.mullions', isInherited: true, optionLabelKeys: Object.fromEntries(MULLION_STYLES.map((style) => [style, `mullions.${style}`])) }),
  isInverted: z.boolean().default(false).meta({ labelKey: 'param.isInverted', isInherited: true, visibleWhen: { shape: SHAPES_WITH_INVERT } }),
  hasShutters: z.boolean().default(false).meta({ labelKey: 'param.hasShutters', isInherited: true }),
});

export type WindowParams = z.infer<typeof windowParams>;

/** Fälten som ärvs även när förra fönstrets storlek inte ryms. */
const STYLE_KEYS = ['shape', 'isInverted', 'mullions', 'hasShutters'] as const;
/** Förslagens storlekar i förhållande till den största, från störst till minst. */
const PROPOSAL_SCALES = [1, 0.8, 0.6, 0.45];
/** Steget mellan höjderna över golvet som ett nytt fönster prövas på när det inte ryms på sin vanliga höjd. */
const SILL_SEARCH_STEP_MM = 10;

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
  attachesTo: [WALL_SURFACE, DORMER_WALL],
  sockets: () => [],
  parts: (instance, params, context) => (hasShutters(params) ? buildShutters(instance.id, params, context.thickness) : []),
  modifiers: (_instance, params, context) => buildWindowOpening(params, targetWallId(context)),
  mountMatrix: () => wallOpeningMountMatrix(),
  socketOutline: (params) => wallRectangle(-params.width / 2, params.sillHeight, params.width / 2, params.sillHeight + windowSizeOf(params).height),
  surfaceAreas: (params, context) => describeWindowSurface(params, targetWallId(context), openingMarginOf(context.socket)),
  prefersSizeOverCenter: true,
  isParamsValid: (params) => arePanesBigEnough(windowSizeOf(params), params.mullions),
  paramCandidates: (socket, _context, inherited, findRelated) =>
    listCandidatesAtHeights(listWindowCandidates(eaveHeightOf(socket), inherited, doorHeadFor(socket, findRelated)), wallTopOf(socket), openingMarginOf(socket)),
};

/** Fönstrets öppning, med höjden ur bredden för runda fönster och halvmånar. */
export function windowSizeOf(params: WindowParams): OpeningSize {
  const isInverted = SHAPES_WITH_INVERT.includes(params.shape) && params.isInverted;
  return { shape: params.shape, width: params.width, height: windowOpeningHeight(params.shape, params.width, params.height), bottom: params.sillHeight, isInverted };
}

function hasShutters(params: WindowParams): boolean {
  return params.hasShutters;
}

function buildWindowOpening(params: WindowParams, targetPartId: string | undefined): Modifier[] {
  if (!targetPartId) return [];
  const size = windowSizeOf(params);
  const panes = listPanes(size, params.mullions);
  return panes.map((pane) => ({ kind: 'removeRegion', targetPartId, region: toWallPlane(pane) }));
}

/** Kanten runt fönstret ska vara hel vägg, och luckorna ska ligga mot väggen. */
function describeWindowSurface(params: WindowParams, targetPartId: string | undefined, margin: Mm): SurfaceArea[] {
  if (!targetPartId) return [];
  const half = params.width / 2;
  const coveredHalf = hasShutters(params) ? params.width : half;
  const solidHalf = Math.max(half + margin, coveredHalf);
  const top = params.sillHeight + windowSizeOf(params).height;
  return [
    {
      targetPartId,
      solidRegion: wallRectangle(-solidHalf, params.sillHeight - margin, solidHalf, top + margin),
      coveredRegion: wallRectangle(-coveredHalf, params.sillHeight, coveredHalf, top),
    },
  ];
}

function buildShutters(instanceId: string, params: WindowParams, thickness: Mm): Part[] {
  return shutterOutlines(windowSizeOf(params)).map((outline, index) => ({
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
 * Dörrens överkant när fönstret ska linjera med en dörr: när sektionen (eller
 * närmaste förälder uppåt) har en dörr. Fönster i en takkupa rättar sig inte
 * efter husets dörrar, eftersom kupans framvägg sitter högt upp på taket.
 */
function doorHeadFor(socket: Socket, findRelated: RelatedParamsLookup): Mm | undefined {
  if (socket.kind === DORMER_WALL) return undefined;
  const height = findRelated(DOOR_TYPE_ID)?.height;
  return typeof height === 'number' ? height : undefined;
}

/**
 * Förslag från väggens höjd vid hörnen: ett fönster ungefär mitt på väggen, utan spröjs.
 * Finns det en dörr men inget fönster på sektionen slutar fönstret i dörrens
 * överkant (ägarens önskan). Finns det redan ett fönster prövas dess värden först,
 * och de mindre förslagen får samma form, spröjs och luckor. Regeln om hel vägg
 * runt fönstret väljer bland dem.
 */
function listWindowCandidates(eaveHeight: Mm, inherited: Record<string, unknown>, doorHead: Mm | undefined): Record<string, unknown>[] {
  const scaled = PROPOSAL_SCALES.map((scale) => {
    const { width, height, sillHeight } = proposeWindowSize(eaveHeight, scale);
    const alignedSill = doorHead === undefined ? sillHeight : Math.max(MIN_SILL_HEIGHT_MM, doorHead - height);
    return { width, height, sillHeight: alignedSill, shape: 'rect', mullions: 'none', hasShutters: false };
  });
  if (Object.keys(inherited).length === 0) return scaled;
  const style = Object.fromEntries(STYLE_KEYS.filter((key) => key in inherited).map((key) => [key, inherited[key]]));
  return [{ ...scaled[0], ...inherited }, ...scaled.map((candidate) => fitToShape({ ...candidate, ...style }, eaveHeight))];
}

/**
 * Ett runt fönster eller en halvmåne får bredden ur förslagets höjd, så att
 * öppningen blir lika hög som förslaget, och står lika mitt på väggen.
 */
function fitToShape(candidate: Record<string, unknown>, eaveHeight: Mm): Record<string, unknown> {
  const { shape, height } = candidate as { shape: WindowParams['shape']; height: Mm };
  if (shape !== 'circle' && shape !== 'halfMoon') return candidate;
  const width = roundToStep(shape === 'circle' ? height : 2 * height, MIN_WINDOW_SIZE_MM);
  const openingHeight = windowOpeningHeight(shape, width, height);
  return { ...candidate, width, sillHeight: roundToStep((eaveHeight - openingHeight) / 2, MIN_SILL_HEIGHT_MM) };
}

/**
 * Varje förslag på alla höjder innan nästa, mindre förslag. Det sista prövas
 * igen på sin egen höjd, så att ett fönster som inte ryms någonstans visas
 * där, i mitten av väggen, med sina regelbrott.
 */
function listCandidatesAtHeights(candidates: Record<string, unknown>[], wallTop: Mm, margin: Mm): Record<string, unknown>[] {
  const smallest = candidates.at(-1);
  const atHeights = candidates.flatMap((candidate) => listSillHeights(candidate, wallTop, margin));
  return smallest ? [...atHeights, smallest] : atHeights;
}

/**
 * Förslaget på sin egen höjd över golvet först, sedan samma storlek högre och
 * lägre, närmast först. Ryms fönstret inte bredvid en dörr eller ett annat
 * fönster kan det då hamna ovanför eller under dem i stället för att bli mindre.
 */
function listSillHeights(candidate: Record<string, unknown>, wallTop: Mm, margin: Mm): Record<string, unknown>[] {
  const { shape, width, height, sillHeight } = candidate as Pick<WindowParams, 'shape' | 'width' | 'height' | 'sillHeight'>;
  const highestSill = wallTop - windowOpeningHeight(shape, width, height) - margin;
  const others: Mm[] = [];
  for (let sill = MIN_SILL_HEIGHT_MM; sill <= highestSill; sill += SILL_SEARCH_STEP_MM) if (sill !== sillHeight) others.push(sill);
  others.sort((a, b) => Math.abs(a - sillHeight) - Math.abs(b - sillHeight));
  return [candidate, ...others.map((sill) => ({ ...candidate, sillHeight: sill }))];
}

/** Väggens högsta punkt i kopplingspunktens yta, t.ex. gavelns topp under nocken. */
function wallTopOf(socket: Socket): Mm {
  return Math.max(0, ...socket.bounds.map((point) => point.y));
}
