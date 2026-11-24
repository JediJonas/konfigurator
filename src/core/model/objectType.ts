import type { Mm, Vec2, Vec3 } from '../geometry/vector';
import type { Instance } from './design';
import type { ParamSchema } from './paramForm';
import type { Part } from './part';

/** Kopplingstyp, t.ex. "ground" eller "wall-surface". Domänen bestämmer vilka som finns. */
export type SocketKind = string;

/**
 * Kopplingspunktens koordinatsystem. Ett barn placeras så att dess lokala x
 * följer `u`, lokala y följer `normal` och lokala z följer u × normal.
 */
export interface Frame3 {
  origin: Vec3;
  u: Vec3;
  normal: Vec3;
}

export interface Socket {
  id: string;
  kind: SocketKind;
  frame: Frame3;
  /** Tillåten yta i (u, v). */
  bounds: Vec2[];
  /** Delen som påverkas av t.ex. hål. Saknas när punkten inte hör till någon del. */
  ownerPartId?: string;
}

/** Det objekttyperna får veta om designen när de räknar fram delar. */
export interface BuildContext {
  thickness: Mm;
}

export interface ObjectType<P = Record<string, unknown>> {
  id: string;
  labelKey: string;
  params: ParamSchema;
  /** Kopplingstyper som detta objekt kan fästa i. Tom för roten. */
  attachesTo: SocketKind[];
  sockets(instance: Instance, params: P, context: BuildContext): Socket[];
  /** Delar i objektets eget koordinatsystem; flödet lägger på placeringen. */
  parts(instance: Instance, params: P, context: BuildContext): Part[];
}
