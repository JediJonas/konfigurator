import type { Part } from '../model/part';
import type { PlacedInstance } from './placeInstances';

/** Ett möte mellan objekt som samverkan inte kan lösa, t.ex. två tak som går in i varandra. */
export interface InteractionConflict {
  /** Objektet som får felet, oftast det som lades till sist. */
  instanceId: string;
  /** Nyckel i domänens texter för förklaringen. */
  messageKey: string;
}

/**
 * Samverkan (SPEC.md avsnitt 3 och 6): logik för objekt som möts, t.ex. två
 * tak som bildar en vinkelränna. Den får alla placerade objekt och delarna
 * med påverkan pålagd, och ger tillbaka delarna, ändrade där objekten möts.
 */
export interface InteractionResolver {
  id: string;
  resolve(placed: readonly PlacedInstance[], parts: readonly Part[]): Part[];
  /**
   * Möten som inte går att lösa, prövade på delarna innan samverkan. Blir fel
   * i regelkontrollen, så att samma kontroll gäller i panelen, i förslagen och för ritningen.
   */
  listConflicts?(placed: readonly PlacedInstance[]): InteractionConflict[];
}
