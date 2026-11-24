import type { HeightPlane } from '../../../core/geometry/heightPlanes';
import { lowestHeightAt, lowestProfileAlong } from '../../../core/geometry/heightPlanes';
import type { Polygon } from '../../../core/geometry/polygon';
import type { Mm, Vec2 } from '../../../core/geometry/vector';
import { vec2 } from '../../../core/geometry/vector';
import { BUILD_STEP } from '../buildOrder';
import type { CornerRole } from '../../../core/model/joint';
import { buttJoint } from '../joints';
import type { RoofContext } from './roof/roofLayout';
import { buildRoofLayout } from './roof/roofLayout';
import type { SectionParams } from './sectionParams';
import type { PartDraft, UprightLine } from './uprightPart';
import { rectangle, uprightTransform } from './uprightPart';

/** Skillnad i höjd längs en vägg som räknas som rak överkant. */
const LEVEL_TOLERANCE_MM = 0.01;

export type WallId = 'gable-front' | 'gable-back' | 'side-right' | 'side-left';

/** En vägg sett uppifrån: ytterkanten med utsidan åt u × upp. */
interface WallSide extends UprightLine {
  id: WallId;
  labelKey: string;
  pair: 'gable' | 'side';
}

/**
 * Väggarnas ytterkanter. Origo mitt på golvytan, x tvärs över och z längs
 * huset; sett uppifrån är punkternas y lika med z. En tillbyggnad har ingen bakgavel.
 */
export function listWallSides(params: SectionParams, isExtension: boolean): WallSide[] {
  const x = params.width / 2;
  const z = params.depth / 2;
  const sides: WallSide[] = [
    { id: 'side-right', labelKey: 'part.sideWall', pair: 'side', outerStart: vec2(x, z), outerEnd: vec2(x, -z) },
    { id: 'side-left', labelKey: 'part.sideWall', pair: 'side', outerStart: vec2(-x, -z), outerEnd: vec2(-x, z) },
    { id: 'gable-front', labelKey: 'part.gable', pair: 'gable', outerStart: vec2(-x, z), outerEnd: vec2(x, z) },
  ];
  if (!isExtension) sides.push({ id: 'gable-back', labelKey: 'part.gable', pair: 'gable', outerStart: vec2(x, -z), outerEnd: vec2(-x, -z) });
  return sides;
}

/** Planen som väggarna bär, utan tillbyggnadens förlängning in över värden. */
export function wallSupport(params: SectionParams, context: RoofContext): HeightPlane[] {
  return buildRoofLayout(params, { ...context, reachesIntoHost: false }).support;
}

/** Takets undersida längs en linje sett uppifrån, som brytpunkter (avstånd från början, höjd). */
export function profileAlong(support: readonly HeightPlane[], line: UprightLine): Vec2[] {
  return lowestProfileAlong(support, line.outerStart, line.outerEnd);
}

function isSloped(profile: readonly Vec2[]): boolean {
  const heights = profile.map((point) => point.y);
  return Math.max(...heights) - Math.min(...heights) > LEVEL_TOLERANCE_MM;
}

/**
 * Hur väggarna står i hörnen enligt domänens fog. Väggar vars överkant följer
 * en lutande takyta har sned överkant (sadeltakets gavlar, pulpettakets sidor).
 */
export function wallCornerRoles(params: SectionParams, context: RoofContext): { gable: CornerRole; side: CornerRole } {
  const support = wallSupport(params, context);
  const [right, , front] = listWallSides(params, false);
  const roles = buttJoint.assignCornerRoles([
    { id: 'gable', hasSlopedTop: front ? isSloped(profileAlong(support, front)) : false, length: params.width },
    { id: 'side', hasSlopedTop: right ? isSloped(profileAlong(support, right)) : false, length: params.depth },
  ]);
  return { gable: roles.get('gable') ?? 'through', side: roles.get('side') ?? 'between' };
}

/**
 * Väggens ytterkant så lång som den står: hela vägen ut i hörnen eller
 * mellan de väggar som går ut. En tillbyggnads långväggar går ända fram till värdens vägg.
 */
function wallSpan(side: WallSide, role: CornerRole, thickness: Mm, isExtension: boolean): UprightLine {
  const inset = role === 'through' ? 0 : thickness;
  const { outerStart, outerEnd } = side;
  const length = Math.hypot(outerEnd.x - outerStart.x, outerEnd.y - outerStart.y);
  const along = vec2((outerEnd.x - outerStart.x) / length, (outerEnd.y - outerStart.y) / length);
  const isAtHost = (point: Vec2) => isExtension && side.pair === 'side' && point.y < 0;
  const startInset = isAtHost(outerStart) ? 0 : inset;
  const endInset = isAtHost(outerEnd) ? 0 : inset;
  return {
    outerStart: vec2(outerStart.x + along.x * startInset, outerStart.y + along.y * startInset),
    outerEnd: vec2(outerEnd.x - along.x * endInset, outerEnd.y - along.y * endInset),
  };
}

/**
 * Väggens kontur: sned överkant som följer takets undersida längs ytterkanten,
 * eller rak överkant så hög att taket vilar på den utan att väggen går upp i taket.
 */
export function wallOutline(support: readonly HeightPlane[], span: UprightLine, thickness: Mm): Polygon {
  const profile = profileAlong(support, span);
  const length = profile.at(-1)?.x ?? 0;
  if (isSloped(profile)) return [vec2(0, 0), vec2(length, 0), ...[...profile].reverse()];
  return rectangle(length, flatTopHeight(support, span, thickness));
}

/** Rak överkant: den lägsta takhöjden över väggens ovansida, både ytter- och innerkant. */
function flatTopHeight(support: readonly HeightPlane[], span: UprightLine, thickness: Mm): Mm {
  const dx = span.outerEnd.x - span.outerStart.x;
  const dz = span.outerEnd.y - span.outerStart.y;
  const length = Math.hypot(dx, dz);
  // Inåt är till vänster om ytterkanten sett med u × upp utåt.
  const inward = vec2((-dz / length) * -thickness, (dx / length) * -thickness);
  const corners = [span.outerStart, span.outerEnd].flatMap((point) => [point, vec2(point.x + inward.x, point.y + inward.y)]);
  return Math.min(...corners.map((corner) => lowestHeightAt(support, corner)));
}

/** Väggens överkant som höjd längs hela ytterkanten, från början till slut. */
export function wallTopProfile(params: SectionParams, context: RoofContext, side: WallSide): Vec2[] {
  const support = wallSupport(params, context);
  const profile = profileAlong(support, side);
  if (isSloped(profile)) return profile;
  const height = flatTopHeight(support, side, context.thickness);
  return [vec2(0, height), vec2(profile.at(-1)?.x ?? 0, height)];
}

/** Tillbyggnadens väggar sätts upp efter huvudhusets, SPEC.md avsnitt 11. */
function wallStep(isExtension: boolean): number {
  return isExtension ? BUILD_STEP.connections : BUILD_STEP.walls;
}

export function buildWallParts(params: SectionParams, context: RoofContext): PartDraft[] {
  const support = wallSupport(params, context);
  const roles = wallCornerRoles(params, context);
  return listWallSides(params, context.isExtension).map((side) => {
    const span = wallSpan(side, roles[side.pair], context.thickness, context.isExtension);
    return {
      id: side.id,
      labelKey: side.labelKey,
      outline: wallOutline(support, span, context.thickness),
      transform: uprightTransform(span, context.thickness, 0),
      buildStep: wallStep(context.isExtension),
    };
  });
}
