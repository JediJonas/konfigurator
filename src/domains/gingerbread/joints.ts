import type { Mm } from '../../core/geometry/vector';

/** En vägg som möter andra väggar i hörnen, så som fogen ser den. */
export interface CornerWall {
  id: string;
  /** Sned överkant, som en gavel under ett sadeltak. */
  hasSlopedTop: boolean;
  length: Mm;
}

/**
 * Går hela vägen ut i hörnen, eller kortas med 2 × tjockleken och står mellan
 * väggarna som går ut.
 */
export type CornerRole = 'through' | 'between';

/** Hur långt utanför en vägg ska räknas som lika lång när de längsta väljs. */
const EQUAL_LENGTH_TOLERANCE_MM = 0.5;

/**
 * Hörnregeln för stumfog (ägarens val, se CLAUDE.md): en vägg med sned
 * överkant går hela vägen ut, och väggar med rak överkant står mellan. Då
 * följer den sneda väggen takets undersida ut till hörnet och inget hål syns
 * under taket. Har alla väggar rak överkant går de längsta ut.
 *
 * Regeln gäller de yttre hörnen. En tillbyggnads väggar går stumt mot
 * värdens vägg, och det hörnet har ingen vägg som går ut.
 */
export function assignCornerRoles(walls: readonly CornerWall[]): Map<string, CornerRole> {
  const hasSloped = walls.some((wall) => wall.hasSlopedTop);
  const longest = Math.max(...walls.map((wall) => wall.length));
  const isThrough = (wall: CornerWall) => (hasSloped ? wall.hasSlopedTop : wall.length >= longest - EQUAL_LENGTH_TOLERANCE_MM);
  return new Map(walls.map((wall) => [wall.id, isThrough(wall) ? 'through' : 'between']));
}

