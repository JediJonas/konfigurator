import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import { isShownUnderParent } from './socketSelection';

/** Ett objekt med egen rubrik i panelen och objekten som är samlade under det. */
export interface PanelEntry {
  entry: PlacedInstance;
  /**
   * Objekt som visas under det här objektet, t.ex. fönster, dörrar och
   * takkupor, och fönstren i kuporna, i den ordning de skapades.
   */
  nested: PlacedInstance[];
}

/**
 * Ordnar objekten för panelen: objekt som bär andra objekt, t.ex. sektioner, får
 * en egen rubrik, och objekt som fönster, dörrar och takkupor samlas under
 * sektionen de sitter på, även fönstret i en kupa. Roten visas inte.
 */
export function groupPanelEntries(placed: readonly PlacedInstance[]): PanelEntry[] {
  const children = placed.filter((entry) => entry.parentId !== undefined);
  const headed = children.filter((entry) => !isShownUnderParent(entry));
  const headedIds = new Set(headed.map((entry) => entry.instance.id));
  const byId = new Map(placed.map((entry) => [entry.instance.id, entry]));
  const headingOf = (entry: PlacedInstance): string | undefined => {
    let current: PlacedInstance | undefined = entry;
    while (current?.parentId !== undefined && !headedIds.has(current.parentId)) current = byId.get(current.parentId);
    return current?.parentId;
  };
  const nested = children.filter((entry) => isShownUnderParent(entry) && entry.parentId !== undefined && headingOf(entry) !== undefined);
  return headed.map((entry) => ({ entry, nested: nested.filter((child) => headingOf(child) === entry.instance.id) }));
}

/**
 * Objektet som en öppen sak ligger i direkt under sektionens rubrik, t.ex.
 * kupan när fönstret i den är öppet. Det avgör vad som fälls ut i sektionen.
 */
export function findOutermostNested(placed: readonly PlacedInstance[], entry: PlacedInstance): PlacedInstance {
  let current = entry;
  for (;;) {
    const parent = placed.find((candidate) => candidate.instance.id === current.parentId);
    if (!parent || !isShownUnderParent(parent)) return current;
    current = parent;
  }
}

/** Den öppna saken och de objekt den ligger i, som också ska vara utfällda, t.ex. kupan runt sitt fönster. */
export function listOpenChain(placed: readonly PlacedInstance[], openId: string | undefined): Set<string> {
  const chain = new Set<string>();
  let current = placed.find((entry) => entry.instance.id === openId);
  while (current && isShownUnderParent(current)) {
    chain.add(current.instance.id);
    const parentId: string | undefined = current.parentId;
    current = placed.find((entry) => entry.instance.id === parentId);
  }
  if (openId) chain.add(openId);
  return chain;
}
