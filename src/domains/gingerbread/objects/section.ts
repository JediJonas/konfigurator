import type { Matrix4 } from '../../../core/geometry/matrix';
import { basisMatrix } from '../../../core/geometry/matrix';
import type { Polygon } from '../../../core/geometry/polygon';
import type { Mm, Vec3 } from '../../../core/geometry/vector';
import { degreesToRadians, vec2, vec3 } from '../../../core/geometry/vector';
import type { Instance } from '../../../core/model/design';
import type { BuildContext, ObjectType } from '../../../core/model/objectType';
import type { Part } from '../../../core/model/part';
import { BUILD_STEP } from '../buildOrder';
import type { SectionParams } from './sectionParams';
import { sectionParams } from './sectionParams';

export const SECTION_TYPE_ID = 'gb.section';

/**
 * Sektion med sadeltak. Koordinater: origo mitt på golvytan, x tvärs över
 * (gavelbredd), y uppåt och z längs huset. Gavlarna står vid z = ±djup/2.
 *
 * Stumfog: gavlarna går hela vägen ut och långväggarna kortas med 2 × tjockleken
 * och står mellan dem. Då följer gavelns snedkant takets undersida ända ut till
 * takfoten, så att inget hål syns i hörnen under taket. Takets undersida vilar på
 * långväggarnas yttre överkant, och takhalvornas undersidor möts i nocken.
 * Skåran ovanpå nocken fylls med glasyr.
 */
export const sectionType: ObjectType<SectionParams> = {
  id: SECTION_TYPE_ID,
  labelKey: 'object.section',
  params: sectionParams,
  attachesTo: ['ground'],
  sockets: () => [],
  parts: (instance, params, context) => [
    ...buildSideWalls(instance, params, context),
    ...buildGables(instance, params, context),
    ...buildRoofHalves(instance, params, context),
  ],
};

/** Gemensamma fält för alla delar i en sektion. */
function sectionPart(instance: Instance, context: BuildContext, fields: Omit<Part, 'sourceInstanceId' | 'holes' | 'thickness'>): Part {
  return { ...fields, id: `${instance.id}/${fields.id}`, sourceInstanceId: instance.id, holes: [], thickness: context.thickness };
}

function rectangle(width: Mm, height: Mm): Polygon {
  return [vec2(0, 0), vec2(width, 0), vec2(width, height), vec2(0, height)];
}

const UP = vec3(0, 1, 0);

/** Delens plan: lokalt x längs `u`, lokalt y längs `v`, tjockleken längs u × v. */
function planeMatrix(u: Vec3, v: Vec3, origin: Vec3): Matrix4 {
  const normal = vec3(u.y * v.z - u.z * v.y, u.z * v.x - u.x * v.z, u.x * v.y - u.y * v.x);
  return basisMatrix(u, v, normal, origin);
}

function buildSideWalls(instance: Instance, params: SectionParams, context: BuildContext): Part[] {
  const { width, depth, wallHeight } = params;
  const innerX = width / 2 - context.thickness;
  const innerZ = depth / 2 - context.thickness;
  const outline = rectangle(depth - 2 * context.thickness, wallHeight);
  const common = { labelKey: 'part.sideWall', outline, buildStep: BUILD_STEP.walls };
  return [
    sectionPart(instance, context, { ...common, id: 'side-right', transform: planeMatrix(vec3(0, 0, -1), UP, vec3(innerX, 0, innerZ)) }),
    sectionPart(instance, context, { ...common, id: 'side-left', transform: planeMatrix(vec3(0, 0, 1), UP, vec3(-innerX, 0, -innerZ)) }),
  ];
}

/** Femhörning över hela husets bredd, med en topp som följer takets undersida. */
export function gableOutline(params: SectionParams): Polygon {
  const halfWidth = params.width / 2;
  const ridgeHeight = params.wallHeight + halfWidth * Math.tan(degreesToRadians(params.roofPitch));
  return [vec2(-halfWidth, 0), vec2(halfWidth, 0), vec2(halfWidth, params.wallHeight), vec2(0, ridgeHeight), vec2(-halfWidth, params.wallHeight)];
}

function buildGables(instance: Instance, params: SectionParams, context: BuildContext): Part[] {
  const innerZ = params.depth / 2 - context.thickness;
  const common = { labelKey: 'part.gable', outline: gableOutline(params), buildStep: BUILD_STEP.walls };
  return [
    sectionPart(instance, context, { ...common, id: 'gable-front', transform: planeMatrix(vec3(1, 0, 0), UP, vec3(0, 0, innerZ)) }),
    sectionPart(instance, context, { ...common, id: 'gable-back', transform: planeMatrix(vec3(-1, 0, 0), UP, vec3(0, 0, -innerZ)) }),
  ];
}

/** Takhalvans mått: längs huset och längs lutningen från takfoten till nocken. */
export function roofHalfSize(params: SectionParams): { length: Mm; slopeLength: Mm } {
  const pitch = degreesToRadians(params.roofPitch);
  return {
    length: params.depth + 2 * params.gableOverhang,
    slopeLength: params.width / 2 / Math.cos(pitch) + params.eaveOverhang,
  };
}

function buildRoofHalves(instance: Instance, params: SectionParams, context: BuildContext): Part[] {
  const pitch = degreesToRadians(params.roofPitch);
  const cos = Math.cos(pitch);
  const sin = Math.sin(pitch);
  const { length, slopeLength } = roofHalfSize(params);
  const outline = rectangle(length, slopeLength);
  // Takfotens nederkant, utanför väggen med takutsprånget mätt längs lutningen.
  const eaveX = params.width / 2 + params.eaveOverhang * cos;
  const eaveY = params.wallHeight - params.eaveOverhang * sin;
  const endZ = params.depth / 2 + params.gableOverhang;
  const common = { labelKey: 'part.roof', outline, buildStep: BUILD_STEP.roof };
  return [
    sectionPart(instance, context, {
      ...common,
      id: 'roof-right',
      transform: planeMatrix(vec3(0, 0, -1), vec3(-cos, sin, 0), vec3(eaveX, eaveY, endZ)),
    }),
    sectionPart(instance, context, {
      ...common,
      id: 'roof-left',
      transform: planeMatrix(vec3(0, 0, 1), vec3(cos, sin, 0), vec3(-eaveX, eaveY, -endZ)),
    }),
  ];
}
