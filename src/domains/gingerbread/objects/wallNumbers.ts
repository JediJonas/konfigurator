import type { WallSide } from './sectionWalls';

/** Väggarna numreras runt huset med början på framgaveln (ägarens val): Vägg 1, Vägg 2 … */
const WALL_NUMBER_ORDER = ['gable-front', 'side-right', 'gable-back', 'side-left'];

/** Väggens nummer runt huset bland de väggar sektionen har. En tillbyggnad saknar bakre gavel. */
export function wallNumberOf(sideId: string, sides: readonly WallSide[]): number {
  const numbered = WALL_NUMBER_ORDER.filter((id) => sides.some((side) => side.id === id));
  return numbered.indexOf(sideId) + 1;
}
