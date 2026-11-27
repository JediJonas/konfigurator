import type { Matrix4 } from '../geometry/matrix';
import type { Polygon } from '../geometry/polygon';
import type { Mm, Vec2, Vec3 } from '../geometry/vector';
import type { Attachment, Instance } from './design';
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
  /**
   * Ytan som objektets topp får nå upp i, när den får gå högre än `bounds`,
   * t.ex. ett tak som läggs ovanpå ägarens tak. Saknas den gäller `bounds` för hela objektet.
   */
  topBounds?: Vec2[];
  /** Hela id:t på delen som påverkas av t.ex. hål. Saknas när punkten inte hör till någon del. */
  ownerPartId?: string;
  /** Fälten i objektets parametrar som ändrar punktens del, t.ex. väggens längd och höjd. Panelen visar dem vid delen. */
  paramKeys?: string[];
}

/**
 * Hur ett objekt använder ytan på en annan del, t.ex. ett fönster i en vägg.
 * Områdena är punkter i objektets eget koordinatsystem och läggs vinkelrätt mot delen.
 */
export interface SurfaceArea {
  /** Hela id:t på delen, t.ex. "S1/side-right". */
  targetPartId: string;
  /** Måste vara hel del, utom där objektets egna öppningar går, t.ex. en kant runt ett fönster. */
  solidRegion: Vec3[];
  /** Det objektet tar av ytan, t.ex. öppningen och luckorna. Två objekt får inte ta samma yta. */
  coveredRegion: Vec3[];
}

/** Det objekttyperna får veta om designen när de räknar fram delar. */
export interface BuildContext {
  thickness: Mm;
  /** Kopplingspunkten på föräldern som objektet sitter i. Saknas för roten. */
  socket?: Socket;
  /** Var objektet sitter i kopplingspunkten. Saknas för roten och för förslag som ännu inte har ett läge. */
  attachment?: Attachment;
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
  /** Ytor på andra delar som objektet behöver, t.ex. väggen runt ett fönster. Prövas av regeln `onSolidPart`. */
  surfaceAreas?(params: P, context: BuildContext): SurfaceArea[];
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
  /**
   * Objektets topp som ska rymmas inom kopplingspunktens `topBounds`, som
   * punkter i eget koordinatsystem. Saknas den prövas bara `socketOutline`.
   */
  socketTopOutline?(params: P, context: BuildContext): Vec3[];
  /** Ytan objektet tar på marken, i eget x och z. Används för att objekt inte ska gå in i varandra. */
  footprint?(params: P, context: BuildContext): Polygon;
  /**
   * Förslag på parametrar för ett nytt objekt i en kopplingspunkt, från det
   * största till det minsta. Det första som klarar reglerna används.
   * `inherited` är förälderns värden för fälten som ärvs. Objekttypen lägger dem
   * på varje förslag, och får byta ut ett ärvt värde som inte går i kopplingspunkten.
   */
  /**
   * Sant när ett nytt objekt hellre ska behålla sin storlek och flyttas från
   * mitten än bli mindre, t.ex. ett andra fönster bredvid det första. Annars
   * prövas alla storlekar i mitten innan objektet flyttas.
   */
  prefersSizeOverCenter?: boolean;
  paramCandidates?(socket: Socket, context: BuildContext, inherited: Record<string, unknown>): Record<string, unknown>[];
}
