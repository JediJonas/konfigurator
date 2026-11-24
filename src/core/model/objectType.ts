import type { Matrix4 } from '../geometry/matrix';
import type { Polygon } from '../geometry/polygon';
import type { Mm, Vec2, Vec3 } from '../geometry/vector';
import type { Instance } from './design';
import type { Modifier } from './modifier';
import type { ParamSchema } from './paramForm';
import type { Part } from './part';

/** Kopplingstyp, t.ex. "ground" eller "wall-surface". Domänen bestämmer vilka som finns. */
export type SocketKind = string;

/**
 * Kopplingspunktens koordinatsystem. Ett barn placeras så att dess lokala x
 * följer `u`, lokala y följer `normal` och lokala z följer u × normal.
 * Punktens (u, v) är koordinater längs `u` och u × normal.
 */
export interface Frame3 {
  origin: Vec3;
  u: Vec3;
  normal: Vec3;
}

export interface Socket {
  /** Unikt på objektet, t.ex. "side-right". */
  id: string;
  kind: SocketKind;
  /** Nyckel i domänens texter, för listor i panelen. */
  labelKey: string;
  frame: Frame3;
  /** Ytan i (u, v) som det som fästs här måste rymmas inom, sett vinkelrätt mot punkten. */
  bounds: Vec2[];
  /** Hela id:t på delen som påverkas av t.ex. hål. Saknas när punkten inte hör till någon del. */
  ownerPartId?: string;
}

/** Det objekttyperna får veta om designen när de räknar fram delar. */
export interface BuildContext {
  thickness: Mm;
  /** Kopplingspunkten på föräldern som objektet sitter i. Saknas för roten. */
  socket?: Socket;
}

export interface ObjectType<P = Record<string, unknown>> {
  id: string;
  labelKey: string;
  params: ParamSchema;
  /** Början på id:t för nya objekt, t.ex. "S" ger S1, S2 … */
  instanceIdPrefix: string;
  /** Kopplingstyper som detta objekt kan fästa i. Tom för roten. */
  attachesTo: SocketKind[];
  sockets(instance: Instance, params: P, context: BuildContext): Socket[];
  /** Delar i objektets eget koordinatsystem; flödet lägger på placeringen. */
  parts(instance: Instance, params: P, context: BuildContext): Part[];
  /** Påverkan på andra objekts delar, t.ex. en öppning i förälderns vägg. */
  modifiers?(instance: Instance, params: P, context: BuildContext): Modifier[];
  /**
   * Hur objektets eget koordinatsystem sitter i kopplingspunktens (x → u,
   * y → normal, z → u × normal). Saknas den sitter objektets origo i punkten utan vridning.
   */
  mountMatrix?(params: P, context: BuildContext): Matrix4;
  /**
   * Det av objektet som måste rymmas inom kopplingspunktens yta, som punkter i
   * eget koordinatsystem. Saknas den används hela objektets delar.
   */
  socketOutline?(params: P, context: BuildContext): Vec3[];
  /** Ytan objektet tar på marken, i eget x och z. Används för att objekt inte ska gå in i varandra. */
  footprint?(params: P, context: BuildContext): Polygon;
  /**
   * Förslag på parametrar för ett nytt objekt i en kopplingspunkt, från det
   * största till det minsta. Det första som klarar reglerna används.
   * `inherited` är förälderns värden för fälten som ärvs, och läggs ovanpå varje förslag.
   */
  paramCandidates?(socket: Socket, context: BuildContext, inherited: Record<string, unknown>): Record<string, unknown>[];
}
