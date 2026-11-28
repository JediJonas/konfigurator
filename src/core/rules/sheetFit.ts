import { boundsHeight, boundsOf, boundsWidth } from '../geometry/polygon';
import type { Mm } from '../geometry/vector';
import type { Part } from '../model/part';
import type { PlacedInstance } from '../pipeline/placeInstances';

/** Hur mycket större än skivan en del får vara, för avrundning. */
const SHEET_TOLERANCE_MM = 0.05;

export interface SheetSize {
  width: Mm;
  height: Mm;
}

/**
 * Om delens omslutande rektangel ryms på skivan, som den ligger eller vriden
 * 90°, som i packningen (SPEC.md avsnitt 10).
 */
export function doesPartFitSheet(part: Part, sheet: SheetSize): boolean {
  const bounds = boundsOf(part.outline);
  const [short, long] = [boundsWidth(bounds), boundsHeight(bounds)].sort((a, b) => a - b) as [Mm, Mm];
  const [sheetShort, sheetLong] = [sheet.width, sheet.height].sort((a, b) => a - b) as [Mm, Mm];
  return short <= sheetShort + SHEET_TOLERANCE_MM && long <= sheetLong + SHEET_TOLERANCE_MM;
}

/**
 * Objekt som har en del som inte ryms på skivan. Innan samverkan har körts
 * hoppas delar som väntar på att klippas över (`Part.isAwaitingTrim`), eftersom
 * de är förlängda med flit; den fullständiga kontrollen prövar dem.
 */
export function findTooBigForSheet(entries: readonly PlacedInstance[], parts: readonly Part[], sheet: SheetSize, hasAllInteractions: boolean): string[] {
  const ids = new Set(entries.map((entry) => entry.instance.id));
  const isMeasurable = (part: Part) => hasAllInteractions || !part.isAwaitingTrim;
  const failing = new Set(parts.filter((part) => ids.has(part.sourceInstanceId) && isMeasurable(part) && !doesPartFitSheet(part, sheet)).map((part) => part.sourceInstanceId));
  return entries.filter((entry) => failing.has(entry.instance.id)).map((entry) => entry.instance.id);
}
