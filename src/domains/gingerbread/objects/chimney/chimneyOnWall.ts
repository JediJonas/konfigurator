import type { Matrix4 } from '../../../../core/geometry/matrix';
import { basisMatrix } from '../../../../core/geometry/matrix';
import type { Mm, Vec2, Vec3 } from '../../../../core/geometry/vector';
import { vec3 } from '../../../../core/geometry/vector';
import type { BuildContext, SurfaceArea } from '../../../../core/model/objectType';
import type { PartDraft } from '../uprightPart';
import { planeMatrix, rectangle } from '../uprightPart';
import type { ChimneyParams } from './chimneyParams';
import type { ChimneyHalfSpace } from './chimneyShape';

const UP = vec3(0, 1, 0);

/**
 * En skorsten mot en vägg står på fatet med baksidan mot väggens utsida och
 * går upp förbi takutsprånget, som en utvändig skorsten. Egna koordinater: x
 * längs väggen (åt höger sett utifrån), y uppåt och z utåt från väggen, med
 * origo på väggens utsida vid fatet. Den kan flyttas längs väggen så länge
 * den har minst en tjocklek kontakt med den, som en sektion bredvid.
 */
export function wallChimneyMountMatrix(): Matrix4 {
  return basisMatrix(vec3(-1, 0, 0), vec3(0, 0, 1), vec3(0, 1, 0), vec3(0, 0, 0));
}

/** Sidorna går hela vägen ut och fram- och baksidan står mellan dem, som på taket. */
export function buildWallChimneyDrafts(params: ChimneyParams, thickness: Mm, top: Mm): PartDraft[] {
  const { width, depth } = params;
  const between = width - 2 * thickness;
  const draft = (id: string, labelKey: string, length: Mm, [u, origin]: [Vec3, Vec3]): PartDraft => ({
    id,
    labelKey,
    outline: rectangle(length, top),
    transform: planeMatrix(u, UP, origin),
    buildStep: 0,
    hasInsideAtZero: true,
  });
  return [
    draft('front', 'part.chimneyFront', between, [vec3(1, 0, 0), vec3(-width / 2 + thickness, 0, depth - thickness)]),
    draft('back', 'part.chimneyBack', between, [vec3(-1, 0, 0), vec3(width / 2 - thickness, 0, thickness)]),
    draft('side-right', 'part.chimneySide', depth, [vec3(0, 0, -1), vec3(width / 2 - thickness, 0, depth)]),
    draft('side-left', 'part.chimneySide', depth, [vec3(0, 0, 1), vec3(-width / 2 + thickness, 0, 0)]),
  ];
}

/**
 * Överkanten: husets tak sett rakt mot väggen (kopplingspunktens `topBounds`),
 * där det är högst ovanför skorstenen, plus höjden över taket.
 */
export function wallChimneyTop(params: ChimneyParams, context: BuildContext): Mm {
  const socket = context.socket;
  const outline = socket?.topBounds ?? socket?.bounds ?? [];
  const u = context.attachment?.u ?? 0;
  return measureHighestWithin(outline, u - params.width / 2, u + params.width / 2) + params.height;
}

/** Det högsta en konvex yta når mellan `from` och `to`, eller vid närmaste kant när den ligger helt bredvid. */
export function measureHighestWithin(outline: readonly Vec2[], from: Mm, to: Mm): Mm {
  if (outline.length === 0) return 0;
  const xs = outline.map((point) => point.x);
  const [low, high] = [Math.min(...xs), Math.max(...xs)];
  const clamp = (x: Mm) => Math.min(high, Math.max(low, x));
  const [start, end] = [clamp(from), clamp(to)];
  const inside = outline.filter((point) => point.x >= start && point.x <= end).map((point) => point.y);
  return Math.max(...inside, ...crossingHeights(outline, start), ...crossingHeights(outline, end));
}

/** Höjderna där ytans kanter korsar den lodräta linjen vid x. */
function crossingHeights(outline: readonly Vec2[], x: Mm): Mm[] {
  return outline.flatMap((point, index) => {
    const next = outline[(index + 1) % outline.length];
    if (!next || (point.x - x) * (next.x - x) > 0) return [];
    if (point.x === next.x) return [point.y, next.y];
    return [point.y + ((x - point.x) / (next.x - point.x)) * (next.y - point.y)];
  });
}

/**
 * Baksidan tar väggens yta, så att inget fönster hamnar bakom skorstenen. En
 * ruta en tjocklek bred, så nära väggens mitt som skorstenen når, måste ligga
 * på väggen: då har den kontakt med väggen var den än står.
 */
export function describeWallChimneySurface(params: ChimneyParams, context: BuildContext, top: Mm): SurfaceArea[] {
  const targetPartId = context.socket?.ownerPartId;
  if (!targetPartId) return [];
  const thickness = context.thickness;
  const half = params.width / 2;
  const reach = Math.max(0, half - thickness / 2);
  // Väggens mitt ligger vid eget x = läget, eftersom eget x går mot kopplingspunktens −u.
  const contact = Math.min(reach, Math.max(-reach, context.attachment?.u ?? 0));
  const box = (left: Mm, right: Mm, height: Mm) => [vec3(left, 0, 0), vec3(right, 0, 0), vec3(right, height, 0), vec3(left, height, 0)];
  return [{ targetPartId, solidRegion: box(contact - thickness / 2, contact + thickness / 2, thickness), coveredRegion: box(-half, half, top) }];
}

/** Skorstenens kropp mot väggen, för takutsprånget som den går upp genom och för krockar. */
export function wallChimneyBody(params: ChimneyParams, top: Mm): ChimneyHalfSpace[] {
  return [
    { normal: vec3(1, 0, 0), offset: params.width / 2 },
    { normal: vec3(-1, 0, 0), offset: params.width / 2 },
    { normal: vec3(0, 0, -1), offset: 0 },
    { normal: vec3(0, 0, 1), offset: params.depth },
    { normal: vec3(0, -1, 0), offset: 0 },
    { normal: vec3(0, 1, 0), offset: top },
  ];
}
