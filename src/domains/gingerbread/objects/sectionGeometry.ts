import type { Matrix4 } from '../../../core/geometry/matrix';
import { basisMatrix } from '../../../core/geometry/matrix';
import type { Polygon } from '../../../core/geometry/polygon';
import type { Mm, Vec3 } from '../../../core/geometry/vector';
import { cross3, degreesToRadians, vec2 } from '../../../core/geometry/vector';
import type { BuildContext } from '../../../core/model/objectType';
import type { CornerRole } from '../joints';
import { assignCornerRoles } from '../joints';
import { WALL_SURFACE } from '../socketKinds';
import type { SectionParams } from './sectionParams';

/**
 * Mått som sektionens delar, kopplingspunkter och regler delar på.
 * Koordinater: origo mitt på golvytan, x tvärs över, y uppåt och z längs huset.
 */

export function rectangle(width: Mm, height: Mm): Polygon {
  return [vec2(0, 0), vec2(width, 0), vec2(width, height), vec2(0, height)];
}

/** Delens plan: lokalt x längs `u`, lokalt y längs `v`, tjockleken längs u × v. */
export function planeMatrix(u: Vec3, v: Vec3, origin: Vec3): Matrix4 {
  return basisMatrix(u, v, cross3(u, v), origin);
}

/** En tillbyggnad sitter mot en vägg och har ingen egen vägg eller takutsprång där. */
export function isExtension(context: BuildContext): boolean {
  return context.socket?.kind === WALL_SURFACE;
}

/**
 * Sektionens tvärsnitt ut till en viss halv bredd: rak nederkant, raka sidor
 * och en topp som följer takets undersida. Med hela halva bredden är det en
 * gavel som går ut i hörnen; med den inre bredden är det öppningen i en värds vägg.
 */
export function crossSectionOutline(params: SectionParams, halfWidth: Mm): Polygon {
  const sideTop = roofUndersideHeight(params, halfWidth);
  const ridgeHeight = roofUndersideHeight(params, 0);
  return [vec2(-halfWidth, 0), vec2(halfWidth, 0), vec2(halfWidth, sideTop), vec2(0, ridgeHeight), vec2(-halfWidth, sideTop)];
}

/** Hur sektionens väggar står i hörnen, enligt domänens fog. */
export function sectionCornerRoles(params: SectionParams): { gable: CornerRole; side: CornerRole } {
  const roles = assignCornerRoles([
    { id: 'gable', hasSlopedTop: true, length: params.width },
    { id: 'side', hasSlopedTop: false, length: params.depth },
  ]);
  return { gable: roles.get('gable') ?? 'through', side: roles.get('side') ?? 'between' };
}

/** Takets ändar längs huset. En tillbyggnads tak slutar mot värdens vägg. */
export function roofEnds(params: SectionParams, context: BuildContext): { back: Mm; front: Mm } {
  const back = isExtension(context) ? -params.depth / 2 : -(params.depth / 2 + params.gableOverhang);
  return { back, front: params.depth / 2 + params.gableOverhang };
}

/** Takhalvans mått: längs huset och längs lutningen från takfoten till nocken. */
export function roofHalfSize(params: SectionParams, context: BuildContext): { length: Mm; slopeLength: Mm } {
  const pitch = degreesToRadians(params.roofPitch);
  const ends = roofEnds(params, context);
  return {
    length: ends.front - ends.back,
    slopeLength: params.width / 2 / Math.cos(pitch) + params.eaveOverhang,
  };
}

/** Takfotens nederkant, utanför väggen med takutsprånget mätt längs lutningen. */
export function eaveEdge(params: SectionParams): { x: Mm; y: Mm } {
  const pitch = degreesToRadians(params.roofPitch);
  return {
    x: params.width / 2 + params.eaveOverhang * Math.cos(pitch),
    y: params.wallHeight - params.eaveOverhang * Math.sin(pitch),
  };
}

/** Höjden på takets undersida en bit ut från mitten, där den går genom långväggarnas yttre överkant. */
export function roofUndersideHeight(params: SectionParams, distanceFromCenter: Mm): Mm {
  return params.wallHeight + (params.width / 2 - distanceFromCenter) * Math.tan(degreesToRadians(params.roofPitch));
}
