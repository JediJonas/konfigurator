import { lowestHeightAt } from '../../../../core/geometry/heightPlanes';
import type { Matrix4 } from '../../../../core/geometry/matrix';
import { basisMatrix, translationMatrix } from '../../../../core/geometry/matrix';
import type { Mm, Vec3 } from '../../../../core/geometry/vector';
import { degreesToRadians, vec2, vec3 } from '../../../../core/geometry/vector';
import type { BuildContext } from '../../../../core/model/objectType';
import type { RoofContext } from '../roof/roofLayout';
import type { SectionParams } from '../sectionParams';
import { sectionParams } from '../sectionParams';
import { wallSupport } from '../sectionWalls';
import type { DormerParams } from './dormerParams';

/**
 * Väggarna börjar så här långt under takets ovansida och kapas sedan mot den
 * (`interactions/dormers.ts`), så att de går ner till taket hela vägen.
 */
const WALL_DROP_MM = 1;
/** Sidoväggarna räknas så här mycket längre in än där de möter taket, innan de kapas. */
const DEPTH_MARGIN_MM = 2;
/** Husets taklutning när kupan ännu inte sitter på något tak, t.ex. i tester. */
const FALLBACK_PITCH_DEGREES = 45;
/** Så mycket av husets takfall som står kvar innanför kupans väggar runt hålet, som för en tillbyggnad. */
export const DORMER_HOLE_INSET_MM = 10;
/** Så mycket helt tak som behövs runt kupan, mot takets kanter, nocken och andra kupor (som för fönster). */
export const DORMER_MARGIN_MM = 15;

const SECTION_DEFAULTS = sectionParams.parse({});

/**
 * Takkupan byggs som en liten tillbyggnad med sadeltak, men står på ett
 * takfall i stället för mot en vägg. Kupans egna koordinater: x längs taket
 * (åt höger sett utifrån), y uppåt och z vågrätt utåt, ner mot takfoten.
 * Origo ligger mitt på framväggens utsida, på husets takyta.
 *
 * Husets takyta går genom origo och stiger inåt (−z) med husets lutning.
 * Väggarna och taket räknas med sektionens kod, i en sektion vars golv ligger
 * strax under takytan och vars bakre ände går in under husets tak.
 */
export interface DormerShape {
  /** Sektionen som kupans väggar och tak räknas i. */
  section: SectionParams;
  /** Från sektionens koordinater till kupans. */
  sectionToDormer: Matrix4;
  roofContext: RoofContext;
  /** Husets taklutning i radianer. */
  hostPitch: number;
}

export function describeDormer(params: DormerParams, context: BuildContext, reachesIntoHost: boolean): DormerShape {
  const hostPitch = measureHostPitch(context);
  const thickness = context.thickness;
  const depth = params.wallHeight / Math.tan(hostPitch) + 2 * thickness + DEPTH_MARGIN_MM;
  const section: SectionParams = {
    ...SECTION_DEFAULTS,
    width: params.width,
    depth,
    wallHeight: params.wallHeight + WALL_DROP_MM,
    roof: 'gable',
    isRoofTurned: false,
    roofPitch: params.roofPitch,
    eaveOverhang: params.eaveOverhang,
    gableOverhang: params.gableOverhang,
  };
  return {
    section,
    sectionToDormer: translationMatrix(vec3(0, -WALL_DROP_MM, -depth / 2)),
    roofContext: { thickness, isExtension: true, reachesIntoHost },
    hostPitch,
  };
}

/** Lutningen på takfallet kupan sitter på, ur kopplingspunktens normal. */
function measureHostPitch(context: BuildContext): number {
  const normal = context.socket?.frame.normal;
  if (!normal) return degreesToRadians(FALLBACK_PITCH_DEGREES);
  return Math.acos(Math.min(1, Math.max(-1, normal.y / Math.hypot(normal.x, normal.y, normal.z))));
}

/**
 * Kupan står upprätt på det lutande takfallet: eget x längs −u, y uppåt och z
 * utåt, med origo `eaveDistance` uppför takfallet från takfoten.
 */
export function dormerMountMatrix(params: DormerParams, context: BuildContext): Matrix4 {
  const pitch = measureHostPitch(context);
  const [cos, sin] = [Math.cos(pitch), Math.sin(pitch)];
  return basisMatrix(vec3(-1, 0, 0), vec3(0, cos, sin), vec3(0, sin, -cos), vec3(0, 0, params.eaveDistance));
}

/** En punkt på husets takyta, `alongSlope` uppför den från framväggens utsida. */
export function pointOnHostRoof(shape: DormerShape, x: Mm, alongSlope: Mm): Vec3 {
  return vec3(x, alongSlope * Math.sin(shape.hostPitch), -alongSlope * Math.cos(shape.hostPitch));
}

/** Hur långt uppför husets takyta något är när det ligger på höjden `height` över framväggens nederkant. */
function slopeDistanceAt(shape: DormerShape, height: Mm): Mm {
  return height / Math.sin(shape.hostPitch);
}

/** Kupans takundersida vid x, i kupans koordinater. */
function undersideAt(shape: DormerShape, x: Mm): Mm {
  return lowestHeightAt(wallSupport(shape.section, shape.roofContext), vec2(x, 0)) - WALL_DROP_MM;
}

/** Hur mycket högre takets ovansida ligger än undersidan, rakt ovanför. */
function roofTopRise(shape: DormerShape): Mm {
  return shape.roofContext.thickness / Math.cos(degreesToRadians(shape.section.roofPitch));
}

/**
 * Det kupan tar av husets takfall, på takytan: framväggen, sidorna upp till
 * där taket möter husets tak och spetsen där nocken gör det. Med `margin` blir
 * ytan så mycket större åt alla håll.
 */
export function dormerFootprintOnRoof(params: DormerParams, shape: DormerShape, margin: Mm): Vec3[] {
  const half = params.width / 2 + margin;
  const side = slopeDistanceAt(shape, undersideAt(shape, params.width / 2) + roofTopRise(shape)) + margin;
  const ridge = slopeDistanceAt(shape, undersideAt(shape, 0) + roofTopRise(shape)) + margin;
  return [
    pointOnHostRoof(shape, -half, -margin),
    pointOnHostRoof(shape, half, -margin),
    pointOnHostRoof(shape, half, side),
    pointOnHostRoof(shape, 0, ridge),
    pointOnHostRoof(shape, -half, side),
  ];
}

/**
 * Hålet i husets takfall: innanför kupans väggar och under dess tak, men
 * `DORMER_HOLE_INSET_MM` mindre, så att kupan har en kant att stå på. Tomt
 * när kupan är för liten för ett hål.
 */
export function dormerHoleOnRoof(params: DormerParams, shape: DormerShape): Vec3[] {
  const thickness = shape.roofContext.thickness;
  const half = params.width / 2 - thickness - DORMER_HOLE_INSET_MM;
  const front = thickness / Math.cos(shape.hostPitch) + DORMER_HOLE_INSET_MM;
  const backAt = (x: Mm) => slopeDistanceAt(shape, undersideAt(shape, x)) - DORMER_HOLE_INSET_MM;
  if (half <= 0 || backAt(half) <= front) return [];
  return [
    pointOnHostRoof(shape, -half, front),
    pointOnHostRoof(shape, half, front),
    pointOnHostRoof(shape, half, backAt(half)),
    pointOnHostRoof(shape, 0, backAt(0)),
    pointOnHostRoof(shape, -half, backAt(-half)),
  ];
}

/** Ett halvrum `normal · p ≤ offset` i kupans koordinater. */
export interface DormerHalfSpace {
  normal: Vec3;
  offset: number;
}

/**
 * Kupans kropp: ovanför husets takyta, under kupans takovansida och inom
 * takutsprången. Ett annat tak som går in i den krockar med kupan.
 */
export function dormerBody(params: DormerParams, shape: DormerShape): DormerHalfSpace[] {
  const thickness = shape.roofContext.thickness;
  const half = params.width / 2 + params.eaveOverhang + thickness;
  const front = params.gableOverhang + thickness;
  const [cos, sin] = [Math.cos(shape.hostPitch), Math.sin(shape.hostPitch)];
  const depth = shape.section.depth;
  const underRoofTop = wallSupport(shape.section, shape.roofContext).map((plane) => ({
    // y = slopeX · x + slopeZ · (z + djup/2) + höjd − fall, plus takets tjocklek rakt upp.
    normal: vec3(-plane.slopeX, 1, -plane.slopeZ),
    offset: plane.slopeZ * (depth / 2) + plane.height - WALL_DROP_MM + thickness * Math.hypot(1, plane.slopeX, plane.slopeZ),
  }));
  return [
    { normal: vec3(0, -cos, -sin), offset: 0 },
    { normal: vec3(1, 0, 0), offset: half },
    { normal: vec3(-1, 0, 0), offset: half },
    { normal: vec3(0, 0, 1), offset: front },
    ...underRoofTop,
  ];
}
