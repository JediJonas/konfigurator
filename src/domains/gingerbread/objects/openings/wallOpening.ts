import type { Matrix4 } from '../../../../core/geometry/matrix';
import { basisMatrix } from '../../../../core/geometry/matrix';
import type { Mm } from '../../../../core/geometry/vector';
import { vec3 } from '../../../../core/geometry/vector';
import type { BuildContext, Socket } from '../../../../core/model/objectType';
import { DORMER_WALL } from '../../socketKinds';

/**
 * Så mycket hel vägg som måste finnas runt ett fönster eller en dörr, mot
 * väggens kanter, mot andra öppningar och mot hål där andra sektioner möter
 * väggen (SPEC.md avsnitt 5, `minClearance`).
 */
export const OPENING_MARGIN_MM = 15;
/**
 * Kanten runt ett fönster i en takkupas framvägg (ägarens val). Framväggen är
 * så låg att ett fönster med `OPENING_MARGIN_MM` runt sig sällan ryms.
 */
export const DORMER_OPENING_MARGIN_MM = 5;

/** Så mycket hel vägg som behövs runt en öppning i väggen kopplingspunkten hör till. */
export function openingMarginOf(socket: Socket | undefined): Mm {
  return socket?.kind === DORMER_WALL ? DORMER_OPENING_MARGIN_MM : OPENING_MARGIN_MM;
}
/** Fönster och dörrar föreslås i jämna mått, som fälten. */
export const OPENING_SIZE_STEP_MM = 5;

/**
 * Fönster och dörrar sitter i väggens plan: eget x längs väggen, y uppåt och
 * z utåt, med origo på väggens utsida i golvhöjd. Kopplingspunktens u går åt
 * andra hållet än väggen (se `sectionSockets.ts`), så eget x är −u.
 */
export function wallOpeningMountMatrix(): Matrix4 {
  return basisMatrix(vec3(-1, 0, 0), vec3(0, 0, 1), vec3(0, 1, 0), vec3(0, 0, 0));
}

/** Delen som öppningen tas upp i: väggen objektet sitter på. */
export function targetWallId(context: BuildContext): string | undefined {
  return context.socket?.ownerPartId;
}

/**
 * Väggens höjd vid hörnen, där den är lägst: det lägsta av överkantens
 * punkter i kopplingspunktens yta. Förslagen räknar fönstrens mått från den.
 */
export function eaveHeightOf(socket: Socket): Mm {
  const tops = socket.bounds.map((point) => point.y).filter((height) => height > 0);
  return tops.length > 0 ? Math.min(...tops) : 0;
}

export function roundToStep(value: Mm, minimum: Mm): Mm {
  return Math.max(minimum, Math.round(value / OPENING_SIZE_STEP_MM) * OPENING_SIZE_STEP_MM);
}
