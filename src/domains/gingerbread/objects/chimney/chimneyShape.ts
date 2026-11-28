import type { Polygon } from '../../../../core/geometry/polygon';
import type { Mm, Vec3 } from '../../../../core/geometry/vector';
import { vec2, vec3 } from '../../../../core/geometry/vector';
import type { PartDraft } from '../uprightPart';
import { planeMatrix, rectangle } from '../uprightPart';
import type { ChimneyParams } from './chimneyParams';

/** Så mycket helt tak som behövs runt skorstenen, mot takets kanter, nocken och andra objekt (som runt fönstret i en takkupa). */
export const CHIMNEY_MARGIN_MM = 5;

const UP = vec3(0, 1, 0);

/**
 * Skorstenens egna koordinater är som takkupans: x längs taket (åt höger sett
 * utifrån), y uppåt och z vågrätt utåt, ner mot takfoten. Origo ligger mitt
 * på framsidans utsida, på husets takyta, som stiger inåt (−z) med lutningen.
 *
 * Sidorna har sned nederkant mot takplanet (SPEC.md avsnitt 8) och går hela
 * vägen ut, som väggar med sned kant i hörnregeln; fram- och baksidan står
 * mellan dem. Varje sida når ner till takytan vid sin nedre yta, så att det
 * inte blir någon glipa som syns.
 */
export function buildChimneyDrafts(params: ChimneyParams, thickness: Mm, hostPitch: number): PartDraft[] {
  const { width, depth } = params;
  const slope = Math.tan(hostPitch);
  const top = chimneyTop(params, hostPitch);
  const between = width - 2 * thickness;
  const backBase = (depth - thickness) * slope;
  const draft = (id: string, labelKey: string, outline: Polygon, [u, origin]: [Vec3, Vec3]): PartDraft => ({
    id,
    labelKey,
    outline,
    transform: planeMatrix(u, UP, origin),
    buildStep: 0,
    hasInsideAtZero: true,
  });
  return [
    draft('front', 'part.chimneyFront', rectangle(between, top), [vec3(1, 0, 0), vec3(-width / 2 + thickness, 0, -thickness)]),
    draft('back', 'part.chimneyBack', rectangle(between, top - backBase), [vec3(-1, 0, 0), vec3(width / 2 - thickness, backBase, -depth + thickness)]),
    draft('side-right', 'part.chimneySide', [vec2(0, 0), vec2(depth, depth * slope), vec2(depth, top), vec2(0, top)], [vec3(0, 0, -1), vec3(width / 2 - thickness, 0, 0)]),
    draft('side-left', 'part.chimneySide', [vec2(0, depth * slope), vec2(depth, 0), vec2(depth, top), vec2(0, top)], [vec3(0, 0, 1), vec3(-width / 2 + thickness, 0, -depth)]),
  ];
}

/** Skorstenens överkant över framsidans fot: höjden över taket på baksidan plus takets stigning under skorstenen. */
export function chimneyTop(params: ChimneyParams, hostPitch: number): Mm {
  return params.height + params.depth * Math.tan(hostPitch);
}

/** En punkt på husets takyta, `alongSlope` uppför den från framsidans utsida. */
function pointOnRoof(hostPitch: number, x: Mm, alongSlope: Mm): Vec3 {
  return vec3(x, alongSlope * Math.sin(hostPitch), -alongSlope * Math.cos(hostPitch));
}

/** Det skorstenen tar av takfallet, på takytan. Med `margin` blir ytan så mycket större åt alla håll. */
export function chimneyFootprintOnRoof(params: ChimneyParams, hostPitch: number, margin: Mm): Vec3[] {
  const half = params.width / 2 + margin;
  const back = params.depth / Math.cos(hostPitch) + margin;
  return [pointOnRoof(hostPitch, -half, -margin), pointOnRoof(hostPitch, half, -margin), pointOnRoof(hostPitch, half, back), pointOnRoof(hostPitch, -half, back)];
}

/** Ett halvrum `normal · p ≤ offset` i skorstenens koordinater. */
export interface ChimneyHalfSpace {
  normal: Vec3;
  offset: number;
}

/** Skorstenens kropp: ovanför husets takyta, under överkanten och innanför sidorna. Ett annat objekt som går in i den krockar med skorstenen. */
export function chimneyBody(params: ChimneyParams, hostPitch: number): ChimneyHalfSpace[] {
  const [cos, sin] = [Math.cos(hostPitch), Math.sin(hostPitch)];
  return [
    { normal: vec3(0, -cos, -sin), offset: 0 },
    { normal: vec3(1, 0, 0), offset: params.width / 2 },
    { normal: vec3(-1, 0, 0), offset: params.width / 2 },
    { normal: vec3(0, 0, 1), offset: 0 },
    { normal: vec3(0, 0, -1), offset: params.depth },
    { normal: vec3(0, 1, 0), offset: chimneyTop(params, hostPitch) },
  ];
}
