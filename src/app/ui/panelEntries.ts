import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import { isLeafInstance } from './socketSelection';

/** Ett objekt med egen rubrik i panelen och objekten som är samlade under det. */
export interface PanelEntry {
  entry: PlacedInstance;
  /** Objekt som sitter på det här objektet och inte bär något själva, t.ex. fönster och dörrar, i den ordning de skapades. */
  nested: PlacedInstance[];
}

/**
 * Ordnar objekten för panelen: objekt som bär andra objekt, t.ex. sektioner, får
 * en egen rubrik, och objekt utan egna kopplingspunkter, t.ex. fönster och dörrar,
 * samlas under objektet de sitter på. Roten visas inte.
 */
export function groupPanelEntries(placed: readonly PlacedInstance[]): PanelEntry[] {
  const children = placed.filter((entry) => entry.parentId !== undefined);
  const carrierIds = new Set(children.filter((entry) => !isLeafInstance(entry)).map((entry) => entry.instance.id));
  const isNested = (entry: PlacedInstance) => isLeafInstance(entry) && entry.parentId !== undefined && carrierIds.has(entry.parentId);
  return children
    .filter((entry) => !isNested(entry))
    .map((entry) => ({ entry, nested: children.filter((child) => isNested(child) && child.parentId === entry.instance.id) }));
}
