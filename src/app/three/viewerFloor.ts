import type { Part } from '../../core/model/part';
import { LIGHT_OFFSET_FROM_VIEWER_MM } from './viewerLight';

/** Fatets minsta radie i 3D-vyn. Fatet är bara bakgrund och ingår inte i underlaget. */
export const MIN_PLATE_RADIUS_MM = 220;
/** Fatets kant utanför huset, så att tillbyggnader också står på fatet. */
export const PLATE_MARGIN_MM = 40;
/** Golvet som tar emot skuggan runt fatet; långt större än vad som syns. */
export const SHADOW_FLOOR_RADIUS_MM = 3000;
/** Skuggkamerans minsta halva bredd, som före skuggan fick falla utanför fatet. */
const MIN_SHADOW_HALF_SIZE_MM = 300;
/** Marginal runt skuggan, så att den aldrig klipps rakt av. */
const SHADOW_MARGIN_MM = 40;

/** Hur långt huset når från mitten längs golvet och hur högt det är, i mm. */
export interface PartsExtent {
  reachMm: number;
  heightMm: number;
}

export function measurePartsExtent(parts: Part[]): PartsExtent {
  let reachMm = 0;
  let heightMm = 0;
  for (const part of parts) {
    const m = part.transform;
    for (const point of part.outline) {
      const x = (m[0] ?? 0) * point.x + (m[4] ?? 0) * point.y + (m[12] ?? 0);
      const y = (m[1] ?? 0) * point.x + (m[5] ?? 0) * point.y + (m[13] ?? 0);
      const z = (m[2] ?? 0) * point.x + (m[6] ?? 0) * point.y + (m[14] ?? 0);
      reachMm = Math.max(reachMm, Math.hypot(x, z));
      heightMm = Math.max(heightMm, y);
    }
  }
  return { reachMm, heightMm };
}

/** Fatet växer med huset när man bygger till. */
export function plateRadius(extent: PartsExtent): number {
  return Math.max(MIN_PLATE_RADIUS_MM, extent.reachMm + PLATE_MARGIN_MM);
}

/** Hur långt skuggan av en punkt faller längs golvet per mm höjd. */
export function shadowLengthPerHeight(): number {
  const offset = LIGHT_OFFSET_FROM_VIEWER_MM;
  return Math.hypot(offset.right, offset.towardViewer) / offset.up;
}

export interface ShadowCameraBox {
  halfSizeMm: number;
  farMm: number;
}

/**
 * Skuggkamerans ruta, så att både huset och hela skuggan på golvet ryms,
 * även den del som faller utanför fatet. Skuggans spets ligger som längst
 * husets räckvidd plus höjden gånger skuggans längd per mm från mitten.
 */
export function shadowCameraBox(extent: PartsExtent): ShadowCameraBox {
  const shadowReach = extent.reachMm + extent.heightMm * shadowLengthPerHeight();
  const houseReach = Math.hypot(extent.reachMm, extent.heightMm);
  const halfSizeMm = Math.max(MIN_SHADOW_HALF_SIZE_MM, Math.max(shadowReach, houseReach) + SHADOW_MARGIN_MM);
  const offset = LIGHT_OFFSET_FROM_VIEWER_MM;
  const lightDistance = Math.hypot(offset.right, offset.towardViewer, offset.up);
  return { halfSizeMm, farMm: lightDistance + 2 * halfSizeMm };
}
