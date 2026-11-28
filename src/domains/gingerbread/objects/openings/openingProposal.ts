import type { Mm } from '../../../../core/geometry/vector';
import type { OpeningShape } from './openingShape';
import { roundToStep } from './wallOpening';

/**
 * Förvalda mått för fönster och dörrar, gemensamma så att dörrens överkant
 * hamnar i samma höjd som fönstrens överkant (ägarens önskan).
 */

export const MIN_WINDOW_SIZE_MM = 15;
export const MIN_SILL_HEIGHT_MM = 5;
/** Det största fönstret som föreslås är så högt i förhållande till väggens höjd vid hörnen. */
const PROPOSED_HEIGHT_SHARE = 0.45;
const PROPOSED_WIDTH_PER_HEIGHT = 0.7;

export interface ProposedWindowSize {
  width: Mm;
  height: Mm;
  sillHeight: Mm;
}

/** Ett fyrkantigt fönster mitt på väggens höjd vid hörnen, i den storlek som `scale` anger av den största. */
export function proposeWindowSize(eaveHeight: Mm, scale: number): ProposedWindowSize {
  const height = roundToStep(eaveHeight * PROPOSED_HEIGHT_SHARE * scale, MIN_WINDOW_SIZE_MM);
  const width = roundToStep(height * PROPOSED_WIDTH_PER_HEIGHT, MIN_WINDOW_SIZE_MM);
  const sillHeight = roundToStep((eaveHeight - height) / 2, MIN_SILL_HEIGHT_MM);
  return { width, height, sillHeight };
}

/**
 * Öppningens höjd för formen. Bredden är diametern på ett runt fönster, och en
 * halvmåne är hälften så hög som bred, så att de alltid blir en cirkel och en halvcirkel.
 */
export function windowOpeningHeight(shape: OpeningShape, width: Mm, chosenHeight: Mm): Mm {
  if (shape === 'circle') return width;
  if (shape === 'halfMoon') return width / 2;
  return chosenHeight;
}

/** Fönstrets överkant över golvet, ur dess värden. `undefined` när värdena inte är ett fönsters. */
export function windowHeadHeightOf(params: Record<string, unknown>): Mm | undefined {
  const { shape, width, height, sillHeight } = params;
  if (typeof width !== 'number' || typeof height !== 'number' || typeof sillHeight !== 'number') return undefined;
  return sillHeight + windowOpeningHeight((shape ?? 'rect') as OpeningShape, width, height);
}

/** Överkanten på det största fönstret som föreslås på en vägg. Den största dörren slutar där. */
export function proposedHeadHeight(eaveHeight: Mm): Mm {
  const { height, sillHeight } = proposeWindowSize(eaveHeight, 1);
  return sillHeight + height;
}
