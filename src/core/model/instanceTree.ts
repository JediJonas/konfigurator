import type { Instance } from './design';

/** Byter ut ett objekt i monteringsträdet utan att ändra resten, så att React ser vad som ändrats. */
export function updateInstance(root: Instance, instanceId: string, update: (instance: Instance) => Instance): Instance {
  if (root.id === instanceId) return update(root);
  return { ...root, children: root.children.map((child) => updateInstance(child, instanceId, update)) };
}

/** Tar bort ett objekt. Barnen sitter på det och följer med. */
export function removeInstance(root: Instance, instanceId: string): Instance {
  return { ...root, children: root.children.filter((child) => child.id !== instanceId).map((child) => removeInstance(child, instanceId)) };
}

export function addChildInstance(root: Instance, parentId: string, child: Instance): Instance {
  return updateInstance(root, parentId, (parent) => ({ ...parent, children: [...parent.children, child] }));
}

/** Alla objekt utom roten, i trädordning. */
export function listInstances(root: Instance): Instance[] {
  return root.children.flatMap((child) => [child, ...listInstances(child)]);
}

export function findInstance(root: Instance, instanceId: string): Instance | undefined {
  if (root.id === instanceId) return root;
  for (const child of root.children) {
    const found = findInstance(child, instanceId);
    if (found) return found;
  }
  return undefined;
}

/** Nästa lediga id med prefixet, t.ex. S3 när S1 och S2 finns. */
export function nextInstanceId(root: Instance, prefix: string): string {
  const ids = new Set([root, ...listInstances(root)].map((instance) => instance.id));
  let number = 1;
  while (ids.has(`${prefix}${number}`)) number += 1;
  return `${prefix}${number}`;
}
