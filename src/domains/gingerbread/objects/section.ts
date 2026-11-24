import type { Mm } from '../../../core/geometry/vector';
import { degreesToRadians, vec3 } from '../../../core/geometry/vector';
import type { Instance } from '../../../core/model/design';
import type { BuildContext, ObjectType } from '../../../core/model/objectType';
import type { Part } from '../../../core/model/part';
import { BUILD_STEP } from '../buildOrder';
import { GROUND, WALL_SURFACE } from '../socketKinds';
import { crossSectionOutline, eaveEdge, isExtension, planeMatrix, rectangle, roofEnds, roofHalfSize, sectionCornerRoles } from './sectionGeometry';
import { listExtensionCandidates } from './extensionProposal';
import { buildOpening, buildSectionSockets, extensionMountMatrix, sectionFootprint, sectionSocketOutline } from './sectionSockets';
import type { SectionParams } from './sectionParams';
import { sectionParams } from './sectionParams';

export const SECTION_TYPE_ID = 'gb.section';

/**
 * Sektion med sadeltak. Koordinater: origo mitt på golvytan, x tvärs över
 * (gavelbredd), y uppåt och z längs huset. Gavlarna står vid z = ±djup/2.
 *
 * Stumfog enligt hörnregeln i `joints.ts`: gavlarna har sned överkant och går
 * hela vägen ut, och långväggarna står mellan dem. Takets undersida vilar på
 * långväggarnas yttre överkant, och takhalvornas undersidor möts i nocken.
 * Skåran ovanpå nocken fylls med glasyr.
 *
 * Som tillbyggnad står sektionen med bakre änden mot en vägg på en annan
 * sektion. Den har då ingen bakre gavel och inget takutsprång där, och tar
 * i stället upp en öppning i värdens vägg.
 */
export const sectionType: ObjectType<SectionParams> = {
  id: SECTION_TYPE_ID,
  labelKey: 'object.section',
  params: sectionParams,
  instanceIdPrefix: 'S',
  attachesTo: [GROUND, WALL_SURFACE],
  sockets: (instance, params, context) => buildSectionSockets(instance, params, context),
  parts: (instance, params, context) => [
    ...buildSideWalls(instance, params, context),
    ...buildGables(instance, params, context),
    ...buildRoofHalves(instance, params, context),
  ],
  modifiers: (_instance, params, context) => buildOpening(params, context),
  mountMatrix: (params, context) => extensionMountMatrix(params, context),
  footprint: (params, context) => sectionFootprint(params, context),
  socketOutline: (params, context) => sectionSocketOutline(params, context),
  paramCandidates: (socket, context) => listExtensionCandidates(socket, context),
};

/** Gemensamma fält för alla delar i en sektion. */
function sectionPart(instance: Instance, context: BuildContext, fields: Omit<Part, 'sourceInstanceId' | 'holes' | 'thickness'>): Part {
  return { ...fields, id: `${instance.id}/${fields.id}`, sourceInstanceId: instance.id, holes: [], thickness: context.thickness };
}

const UP = vec3(0, 1, 0);

/** Tillbyggnadens väggar sätts upp efter huvudhusets, SPEC.md avsnitt 11. */
function wallStep(context: BuildContext): number {
  return isExtension(context) ? BUILD_STEP.connections : BUILD_STEP.walls;
}

/** Långväggarnas ändar längs huset. De står mellan gavlarna, och en tillbyggnads väggar går ända fram till värdens vägg. */
function sideWallEnds(params: SectionParams, context: BuildContext): { back: Mm; front: Mm } {
  const isSideThrough = sectionCornerRoles(params).side === 'through';
  const cornerEnd = isSideThrough ? params.depth / 2 : params.depth / 2 - context.thickness;
  return { back: isExtension(context) ? -params.depth / 2 : -cornerEnd, front: cornerEnd };
}

function buildSideWalls(instance: Instance, params: SectionParams, context: BuildContext): Part[] {
  const innerX = params.width / 2 - context.thickness;
  const ends = sideWallEnds(params, context);
  const outline = rectangle(ends.front - ends.back, params.wallHeight);
  const common = { labelKey: 'part.sideWall', outline, buildStep: wallStep(context) };
  return [
    sectionPart(instance, context, { ...common, id: 'side-right', transform: planeMatrix(vec3(0, 0, -1), UP, vec3(innerX, 0, ends.front)) }),
    sectionPart(instance, context, { ...common, id: 'side-left', transform: planeMatrix(vec3(0, 0, 1), UP, vec3(-innerX, 0, ends.back)) }),
  ];
}

function buildGables(instance: Instance, params: SectionParams, context: BuildContext): Part[] {
  const innerZ: Mm = params.depth / 2 - context.thickness;
  const isGableThrough = sectionCornerRoles(params).gable === 'through';
  const halfWidth = isGableThrough ? params.width / 2 : params.width / 2 - context.thickness;
  const common = { labelKey: 'part.gable', outline: crossSectionOutline(params, halfWidth), buildStep: wallStep(context) };
  const front = sectionPart(instance, context, { ...common, id: 'gable-front', transform: planeMatrix(vec3(1, 0, 0), UP, vec3(0, 0, innerZ)) });
  if (isExtension(context)) return [front];
  return [front, sectionPart(instance, context, { ...common, id: 'gable-back', transform: planeMatrix(vec3(-1, 0, 0), UP, vec3(0, 0, -innerZ)) })];
}

function buildRoofHalves(instance: Instance, params: SectionParams, context: BuildContext): Part[] {
  const pitch = degreesToRadians(params.roofPitch);
  const cos = Math.cos(pitch);
  const sin = Math.sin(pitch);
  const { length, slopeLength } = roofHalfSize(params, context);
  const outline = rectangle(length, slopeLength);
  const eave = eaveEdge(params);
  const ends = roofEnds(params, context);
  const common = { labelKey: 'part.roof', outline, buildStep: BUILD_STEP.roof };
  return [
    sectionPart(instance, context, {
      ...common,
      id: 'roof-right',
      transform: planeMatrix(vec3(0, 0, -1), vec3(-cos, sin, 0), vec3(eave.x, eave.y, ends.front)),
    }),
    sectionPart(instance, context, {
      ...common,
      id: 'roof-left',
      transform: planeMatrix(vec3(0, 0, 1), vec3(cos, sin, 0), vec3(-eave.x, eave.y, ends.back)),
    }),
  ];
}
