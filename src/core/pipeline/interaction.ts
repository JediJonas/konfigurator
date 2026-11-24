import type { Part } from '../model/part';
import type { PlacedInstance } from './placeInstances';

/**
 * Samverkan (SPEC.md avsnitt 3 och 6): logik för objekt som möts, t.ex. två
 * tak som bildar en vinkelränna. Den får alla placerade objekt och delarna
 * med påverkan pålagd, och ger tillbaka delarna, ändrade där objekten möts.
 */
export interface InteractionResolver {
  id: string;
  resolve(placed: readonly PlacedInstance[], parts: readonly Part[]): Part[];
}
