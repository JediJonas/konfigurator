import { clipByHalfPlanes } from '../../../../core/geometry/halfPlane';
import type { Polygon } from '../../../../core/geometry/polygon';
import type { Mm, Vec2, Vec3 } from '../../../../core/geometry/vector';
import { vec2, vec3 } from '../../../../core/geometry/vector';

/** Formerna på dörrar: fyrkantig eller med rundbåge. */
export const DOOR_SHAPES = ['rect', 'arch'] as const;
/** Fönster kan dessutom vara runda (en cirkel) eller en halvmåne (en halvcirkel med rak underkant). */
export const WINDOW_SHAPES = [...DOOR_SHAPES, 'circle', 'halfMoon'] as const;
export type OpeningShape = (typeof WINDOW_SHAPES)[number];

/** Så många raka bitar rundbågen ritas med. Fler ger en jämnare båge men fler hörn att skära. */
const ARCH_SEGMENTS = 16;
/** Spröjsens bredd, så att de håller när degen bakas. */
export const MULLION_WIDTH_MM = 5;

/** En öppning i objektets eget koordinatsystem: x längs väggen från mitten, y uppåt från golvet. */
export interface OpeningSize {
  shape: OpeningShape;
  width: Mm;
  height: Mm;
  /** Underkantens höjd över golvet. */
  bottom: Mm;
}

/**
 * Öppningens kontur moturs. Rundbågen är en halv ellips över hela bredden,
 * en halvcirkel när öppningen är minst hälften så hög som bred. Den runda
 * öppningen är en ellips i rutan, och halvmånen en halv ellips från underkanten.
 * Fönstret ger dem mått som gör dem till en cirkel och en halvcirkel (`windowSizeOf`).
 */
export function openingOutline(size: OpeningSize): Vec2[] {
  const { width, height, bottom } = size;
  const half = width / 2;
  const top = bottom + height;
  if (size.shape === 'rect') return [vec2(-half, bottom), vec2(half, bottom), vec2(half, top), vec2(-half, top)];
  if (size.shape === 'circle') return ellipseOutline(half, height / 2, bottom + height / 2);
  const rise = size.shape === 'halfMoon' ? height : Math.min(half, height);
  const spring = top - rise;
  const arch = Array.from({ length: ARCH_SEGMENTS + 1 }, (_, index) => {
    const angle = (Math.PI * index) / ARCH_SEGMENTS;
    return vec2(half * Math.cos(angle), spring + rise * Math.sin(angle));
  });
  // Bågen går från höger ände över till vänster. Är öppningen bara båge sluter nederkanten den.
  return spring > bottom ? [vec2(-half, bottom), vec2(half, bottom), ...arch] : arch;
}

/** En hel ellips runt (0, centerY), moturs, med lika många bitar per halva som rundbågen. */
function ellipseOutline(radiusX: Mm, radiusY: Mm, centerY: Mm): Vec2[] {
  const segments = 2 * ARCH_SEGMENTS;
  return Array.from({ length: segments }, (_, index) => {
    const angle = (2 * Math.PI * index) / segments;
    return vec2(radiusX * Math.cos(angle), centerY + radiusY * Math.sin(angle));
  });
}

/**
 * Rutorna mellan spröjsen: öppningen delad i fyra av ett kors mitt i, så att
 * spröjsen blir kvar av väggen. Öppningen är konvex, så varje ruta klipps med halvplan.
 */
export function crossPanes(size: OpeningSize): Vec2[][] {
  const outline = openingOutline(size);
  const middle = size.bottom + size.height / 2;
  const bar = MULLION_WIDTH_MM / 2;
  const quadrants = [
    [vec2(-1, 0), vec2(0, -1)],
    [vec2(1, 0), vec2(0, -1)],
    [vec2(-1, 0), vec2(0, 1)],
    [vec2(1, 0), vec2(0, 1)],
  ] as const;
  return quadrants
    .map(([sideways, vertical]) =>
      clipByHalfPlanes(outline, [
        { normal: vec2(-sideways.x, 0), offset: -bar },
        { normal: vec2(0, -vertical.y), offset: -vertical.y * middle - bar },
      ]),
    )
    .filter((pane) => pane.length >= 3);
}

/**
 * Luckorna uppslagna mot väggen: varje halva av öppningen speglad ut åt sitt
 * håll, så att luckan täcker sin halva när den stängs.
 */
export function shutterOutlines(size: OpeningSize): [Vec2[], Vec2[]] {
  const outline = openingOutline(size);
  const half = size.width / 2;
  const left = clipByHalfPlanes(outline, [{ normal: vec2(1, 0), offset: 0 }]);
  const right = clipByHalfPlanes(outline, [{ normal: vec2(-1, 0), offset: 0 }]);
  const mirror = (polygon: Polygon, axis: Mm) => polygon.map((point) => vec2(2 * axis - point.x, point.y)).reverse();
  return [mirror(left, -half), mirror(right, half)];
}

/** En rektangel i väggens plan, som punkter i objektets eget koordinatsystem. */
export function wallRectangle(left: Mm, bottom: Mm, right: Mm, top: Mm): Vec3[] {
  return [vec3(left, bottom, 0), vec3(right, bottom, 0), vec3(right, top, 0), vec3(left, top, 0)];
}

export function toWallPlane(polygon: Polygon): Vec3[] {
  return polygon.map((point) => vec3(point.x, point.y, 0));
}
