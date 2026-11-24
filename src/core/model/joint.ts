import type { Mm } from '../geometry/vector';

/** En vägg (eller ett par motstående väggar) som möter andra väggar i hörnen, så som fogen ser den. */
export interface CornerWall {
  id: string;
  /** Sned överkant, t.ex. en vägg som följer ett lutande tak. */
  hasSlopedTop: boolean;
  length: Mm;
}

/**
 * Går hela vägen ut i hörnen, eller kortas med 2 × tjockleken och står mellan
 * väggarna som går ut.
 */
export type CornerRole = 'through' | 'between';

/** Fog (SPEC.md avsnitt 3): hur delar möts i hörnen. Domänen bestämmer vilka som finns. */
export interface JointStyle {
  id: string;
  labelKey: string;
  assignCornerRoles(walls: readonly CornerWall[]): Map<string, CornerRole>;
}
