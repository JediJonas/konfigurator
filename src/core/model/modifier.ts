import type { Vec3 } from '../geometry/vector';

/**
 * Hur ett objekt ändrar delar som hör till ett annat objekt, SPEC.md avsnitt 3.
 * Bara `removeRegion` finns än; klippning och borttagning kommer med taken.
 */
export interface RemoveRegionModifier {
  kind: 'removeRegion';
  /** Hela id:t på delen som ska få öppningen, t.ex. "S1/side-right". */
  targetPartId: string;
  /**
   * Området som tas bort, som punkter i objektets eget koordinatsystem. Det
   * läggs vinkelrätt mot delen, så det räcker att det ligger i ett plan parallellt med den.
   */
  region: Vec3[];
}

export type Modifier = RemoveRegionModifier;
