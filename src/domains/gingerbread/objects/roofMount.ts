import type { Matrix4 } from '../../../core/geometry/matrix';
import { basisMatrix } from '../../../core/geometry/matrix';
import type { Mm, Vec3 } from '../../../core/geometry/vector';
import { degreesToRadians, vec3 } from '../../../core/geometry/vector';
import type { BuildContext } from '../../../core/model/objectType';

/** Husets taklutning när objektet ännu inte sitter på något tak, t.ex. i tester. */
const FALLBACK_PITCH_DEGREES = 45;

/** Lutningen i radianer på takfallet som objektet sitter på, ur kopplingspunktens normal. */
export function measureHostPitch(context: BuildContext): number {
  const normal = context.socket?.frame.normal;
  return normal ? pitchOfNormal(normal) : degreesToRadians(FALLBACK_PITCH_DEGREES);
}

/** Lutningen i radianer på en yta med normalen `normal`. */
export function pitchOfNormal(normal: Vec3): number {
  return Math.acos(Math.min(1, Math.max(-1, normal.y / Math.hypot(normal.x, normal.y, normal.z))));
}

/**
 * Ett objekt som står upprätt på ett lutande takfall, t.ex. en takkupa eller
 * en skorsten: eget x längs −u (åt höger sett utifrån), y uppåt och z vågrätt
 * utåt, ner mot takfoten. Origo ligger `eaveDistance` uppför takfallet från takfoten.
 */
export function uprightOnRoofMatrix(eaveDistance: Mm, context: BuildContext): Matrix4 {
  const pitch = measureHostPitch(context);
  const [cos, sin] = [Math.cos(pitch), Math.sin(pitch)];
  return basisMatrix(vec3(-1, 0, 0), vec3(0, cos, sin), vec3(0, sin, -cos), vec3(0, 0, eaveDistance));
}
