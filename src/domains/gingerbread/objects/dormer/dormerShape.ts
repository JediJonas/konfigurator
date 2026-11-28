import type { Matrix4 } from '../../../../core/geometry/matrix';
import { translationMatrix } from '../../../../core/geometry/matrix';
import type { Mm, Vec3 } from '../../../../core/geometry/vector';
import { vec3 } from '../../../../core/geometry/vector';
import type { BuildContext } from '../../../../core/model/objectType';
import type { RoofContext } from '../roof/roofLayout';
import type { SectionParams } from '../sectionParams';
import { sectionParams } from '../sectionParams';
import { measureHostPitch, uprightOnRoofMatrix } from '../roofMount';
import { wallSupport } from '../sectionWalls';
import type { DormerParams } from './dormerParams';

/**
 * Väggarna börjar så här långt under takets ovansida och kapas sedan mot den
 * (`interactions/dormers.ts`), så att de går ner till taket hela vägen.
 */
export const WALL_DROP_MM = 1;
/** Sidoväggarna räknas så här mycket längre in än där de möter taket, innan de kapas. */
const DEPTH_MARGIN_MM = 2;
/** Djupet i utkastet som takets plan räknas ur; vilket som helst går. */
const PROVISIONAL_DEPTH_MM = 100;
/** Längre än något takfall. Ett tak som aldrig möter husets tak räknas så långt. */
const MAX_REACH_MM = 1000;
/** Kupans tak måste närma sig husets takyta minst så här mycket per mm uppför den för att mötas. */
const MIN_CLOSING = 1e-3;
/** Så mycket av husets takfall som står kvar innanför kupans väggar runt hålet, som för en tillbyggnad. */
export const DORMER_HOLE_INSET_MM = 10;
/** Så mycket helt tak som behövs runt kupan, mot takets kanter, nocken och andra kupor (som för fönster). */
export const DORMER_MARGIN_MM = 15;

const SECTION_DEFAULTS = sectionParams.parse({});

/**
 * Takkupan byggs som en liten tillbyggnad med sadel- eller pulpettak, men står på ett
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
  const roofContext: RoofContext = { thickness, isExtension: true, reachesIntoHost };
  // Takets plan i kupans koordinater beror inte på djupet, så djupet kan räknas ur ett första utkast.
  const draft = shapeWithDepth(params, hostPitch, roofContext, PROVISIONAL_DEPTH_MM);
  const reach = Math.min(MAX_REACH_MM, meetingDistance(draft, params.width / 2, false));
  return shapeWithDepth(params, hostPitch, roofContext, reach * Math.cos(hostPitch) + 2 * thickness + DEPTH_MARGIN_MM);
}

function shapeWithDepth(params: DormerParams, hostPitch: number, roofContext: RoofContext, depth: Mm): DormerShape {
  const section: SectionParams = {
    ...SECTION_DEFAULTS,
    width: params.width,
    depth,
    wallHeight: params.wallHeight + WALL_DROP_MM,
    roof: params.roof,
    isRoofTurned: false,
    roofPitch: params.roofPitch,
    eaveOverhang: params.eaveOverhang,
    gableOverhang: params.gableOverhang,
  };
  return { section, sectionToDormer: translationMatrix(vec3(0, -WALL_DROP_MM, -depth / 2)), roofContext, hostPitch };
}

/** Kupan står upprätt på det lutande takfallet, med origo `eaveDistance` uppför takfallet från takfoten. */
export function dormerMountMatrix(params: DormerParams, context: BuildContext): Matrix4 {
  return uprightOnRoofMatrix(params.eaveDistance, context);
}

/** En punkt på husets takyta, `alongSlope` uppför den från framväggens utsida. */
export function pointOnHostRoof(shape: DormerShape, x: Mm, alongSlope: Mm): Vec3 {
  return vec3(x, alongSlope * Math.sin(shape.hostPitch), -alongSlope * Math.cos(shape.hostPitch));
}

/** Ett takplan i kupans koordinater: y = slopeX · x + slopeZ · z + height. */
interface DormerPlane {
  slopeX: number;
  slopeZ: number;
  height: Mm;
}

/** Planen som kupans tak vilar på, undersidan eller ovansidan, i kupans koordinater. */
export function dormerRoofPlanes(shape: DormerShape, isTop: boolean): DormerPlane[] {
  const depth = shape.section.depth;
  return wallSupport(shape.section, shape.roofContext).map((plane) => ({
    slopeX: plane.slopeX,
    slopeZ: plane.slopeZ,
    // Sektionens z är kupans z + djup/2 och golvet ligger `WALL_DROP_MM` under kupans origo.
    height: plane.slopeZ * (depth / 2) + plane.height - WALL_DROP_MM + (isTop ? shape.roofContext.thickness * Math.hypot(1, plane.slopeX, plane.slopeZ) : 0),
  }));
}

/**
 * Hur långt uppför husets takyta, från framväggens utsida, kupans tak möter
 * den vid x: undersidan, eller ovansidan med `isTop`. Ett takplan som stiger
 * lika brant som husets tak eller brantare möter det aldrig (oändligt långt).
 */
export function meetingDistance(shape: DormerShape, x: Mm, isTop: boolean): Mm {
  const [cos, sin] = [Math.cos(shape.hostPitch), Math.sin(shape.hostPitch)];
  // På takytan är punkten (x, s · sin, −s · cos); planet når den där s · sin = slopeX · x − slopeZ · s · cos + höjd.
  const distances = dormerRoofPlanes(shape, isTop).map((plane) => {
    const closing = sin + plane.slopeZ * cos;
    return closing > MIN_CLOSING ? (plane.slopeX * x + plane.height) / closing : Number.POSITIVE_INFINITY;
  });
  return Math.min(...distances);
}

/** Som `meetingDistance`, men aldrig längre än `MAX_REACH_MM`, så att ytorna går att rita. */
function reachAt(shape: DormerShape, x: Mm, isTop: boolean): Mm {
  return Math.min(MAX_REACH_MM, meetingDistance(shape, x, isTop));
}

/**
 * Det kupan tar av husets takfall, på takytan: framväggen, sidorna upp till
 * där taket möter husets tak och spetsen där nocken gör det. Med `margin` blir
 * ytan så mycket större åt alla håll.
 */
export function dormerFootprintOnRoof(params: DormerParams, shape: DormerShape, margin: Mm): Vec3[] {
  const half = params.width / 2 + margin;
  const side = Math.max(reachAt(shape, params.width / 2, true), reachAt(shape, -params.width / 2, true)) + margin;
  const ridge = reachAt(shape, 0, true) + margin;
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
  const backAt = (x: Mm) => reachAt(shape, x, false) - DORMER_HOLE_INSET_MM;
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
  // Sadeltaket har takfotens utsprång på sidorna och pulpettaket fram; det största räcker för båda.
  const overhang = Math.max(params.eaveOverhang, params.gableOverhang) + thickness;
  const half = params.width / 2 + overhang;
  const front = overhang;
  const [cos, sin] = [Math.cos(shape.hostPitch), Math.sin(shape.hostPitch)];
  const underRoofTop = dormerRoofPlanes(shape, true).map((plane) => ({ normal: vec3(-plane.slopeX, 1, -plane.slopeZ), offset: plane.height }));
  return [
    { normal: vec3(0, -cos, -sin), offset: 0 },
    { normal: vec3(1, 0, 0), offset: half },
    { normal: vec3(-1, 0, 0), offset: half },
    { normal: vec3(0, 0, 1), offset: front },
    ...underRoofTop,
  ];
}
