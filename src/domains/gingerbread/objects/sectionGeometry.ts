import { transformPoint } from '../../../core/geometry/matrix';
import type { Vec3 } from '../../../core/geometry/vector';
import { vec3 } from '../../../core/geometry/vector';
import type { BuildContext } from '../../../core/model/objectType';
import { WALL_BESIDE, WALL_SURFACE } from '../socketKinds';
import type { RoofContext } from './roof/roofLayout';
import { buildRoofParts } from './roof/roofParts';
import type { SectionParams } from './sectionParams';

/**
 * Mått som sektionens delar, kopplingspunkter och regler delar på.
 * Koordinater: origo mitt på golvytan, x tvärs över, y uppåt och z längs huset.
 */

/** En tillbyggnad sitter mot en vägg och har ingen egen vägg eller takutsprång där. */
export function isExtension(context: BuildContext): boolean {
  return context.socket?.kind === WALL_SURFACE;
}

/** En sektion som står på fatet bredvid en annan sektions vägg. Den är ingen tillbyggnad och har alla sina väggar. */
export function isNeighbor(context: BuildContext): boolean {
  return context.socket?.kind === WALL_BESIDE;
}

/** Det taket och väggarna behöver veta om sammanhanget. */
export function roofContext(context: BuildContext, reachesIntoHost: boolean): RoofContext {
  return { thickness: context.thickness, isExtension: isExtension(context), reachesIntoHost };
}

/**
 * Takets alla hörn på både undersidan och ovansidan, i sektionens
 * koordinater. En tillbyggnads tak räknas som om det slutade mot värdens vägg.
 */
export function listRoofCorners(params: SectionParams, context: BuildContext): Vec3[] {
  return buildRoofParts(params, roofContext(context, false)).flatMap((part) =>
    [0, context.thickness].flatMap((z) => part.outline.map((point) => transformPoint(part.transform, vec3(point.x, point.y, z)))),
  );
}
