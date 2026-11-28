import type { Instance } from './design';
import { findInstance, listInstances, removeInstance } from './instanceTree';

/** Början på id:t för objekt av en typ, t.ex. "S" för sektioner. Ingen för typer utan numrering. */
export type InstanceIdPrefixOf = (typeId: string) => string | undefined;

/**
 * Ett objekt som togs bort och numren som flyttades ner efteråt, t.ex. S3 → S2.
 * `renames` gäller id:n i designen före borttagningen.
 */
export interface InstanceRemoval {
  root: Instance;
  removedId: string;
  /** Objektet och allt som satt på det. */
  removedIds: string[];
  renames: Map<string, string>;
}

/**
 * Numrerar om objekten med prefixen så att numren går 1, 2, 3 … utan glapp,
 * i samma ordning som förut. Id:n med andra mönster, t.ex. "plate" eller "SK1"
 * när prefixet är "S", lämnas.
 */
export function renumberInstances(root: Instance, prefixes: Iterable<string>): { root: Instance; renames: Map<string, string> } {
  const renames = new Map<string, string>();
  const instances = listInstances(root);
  for (const prefix of new Set(prefixes)) {
    const numbered = instances
      .map((instance) => ({ id: instance.id, number: readNumber(instance.id, prefix) }))
      .filter((entry): entry is { id: string; number: number } => entry.number !== undefined)
      .sort((a, b) => a.number - b.number);
    numbered.forEach((entry, index) => {
      const id = `${prefix}${index + 1}`;
      if (id !== entry.id) renames.set(entry.id, id);
    });
  }
  return { root: renames.size === 0 ? root : renameInstances(root, renames), renames };
}

/** Tar bort ett objekt och numrerar om de som har samma prefix som det eller något som satt på det (ägarens val). */
export function removeAndRenumber(root: Instance, instanceId: string, prefixOf: InstanceIdPrefixOf): InstanceRemoval {
  const removed = findInstance(root, instanceId);
  const removedInstances = removed ? [removed, ...listInstances(removed)] : [];
  const prefixes = removedInstances.map((instance) => prefixOf(instance.type)).filter((prefix): prefix is string => prefix !== undefined);
  const renumbered = renumberInstances(removeInstance(root, instanceId), prefixes);
  return { root: renumbered.root, removedId: instanceId, removedIds: removedInstances.map((instance) => instance.id), renames: renumbered.renames };
}

/**
 * Borttagningen som gör `before` till `after`, om det är en, t.ex. för att veta
 * vilket objekt som kommer tillbaka och vilka nummer som flyttas när man ångrar.
 */
export function findRemoval(before: Instance, after: Instance, prefixOf: InstanceIdPrefixOf): InstanceRemoval | undefined {
  const target = JSON.stringify(after);
  for (const instance of listInstances(before)) {
    const removal = removeAndRenumber(before, instance.id, prefixOf);
    if (JSON.stringify(removal.root) === target) return removal;
  }
  return undefined;
}

function readNumber(id: string, prefix: string): number | undefined {
  if (!id.startsWith(prefix)) return undefined;
  const digits = id.slice(prefix.length);
  return /^[1-9]\d*$/.test(digits) ? Number(digits) : undefined;
}

function renameInstances(instance: Instance, renames: ReadonlyMap<string, string>): Instance {
  return { ...instance, id: renames.get(instance.id) ?? instance.id, children: instance.children.map((child) => renameInstances(child, renames)) };
}
