import type { Design } from '../model/design';
import type { Domain } from '../model/domain';
import { findInstance, updateInstance } from '../model/instanceTree';
import type { ObjectType, Socket } from '../model/objectType';
import { placeInstances } from '../pipeline/placeInstances';
import { listViolations } from './evaluateDesign';

const ignoreLabel = (key: string) => key;

/**
 * Kopplingspunkterna på samma del som `socket`, i förälderns ordning, som
 * objekttypen kan fästa i. En vägg kan t.ex. ha en punkt för en tillbyggnad
 * och en för en sektion som står bredvid. Punkter utan del har inga alternativ.
 */
export function listAlternativeSockets(parentSockets: readonly Socket[], socket: Socket, objectType: ObjectType<unknown>): Socket[] {
  if (!socket.ownerPartId) return [socket];
  return parentSockets.filter((candidate) => candidate.ownerPartId === socket.ownerPartId && objectType.attachesTo.includes(candidate.kind));
}

/**
 * Sätter objekten i den första av de alternativa kopplingspunkterna där de
 * klarar reglerna, med samma läge. Så byter t.ex. en sektion av sig själv
 * mellan tillbyggnad och sektion bredvid när måtten ändras. Klarar ett objekt
 * ingen av dem sitter det kvar där det satt, så att panelen kan visa felet.
 */
export function attachInFittingSockets(design: Design, domain: Domain, instanceIds: readonly string[]): Design {
  return instanceIds.reduce((current, instanceId) => attachInFittingSocket(current, domain, instanceId), design);
}

function attachInFittingSocket(design: Design, domain: Domain, instanceId: string): Design {
  const instance = findInstance(design.root, instanceId);
  const attachment = instance?.attachment;
  if (!instance || !attachment) return design;
  const placed = tryPlace(design, domain);
  const entry = placed?.find((candidate) => candidate.instance.id === instanceId);
  const parent = placed?.find((candidate) => candidate.instance.id === entry?.parentId);
  if (!entry?.socket || !parent) return design;
  const current = parent.sockets.find((socket) => socket.id === attachment.socketId);
  if (!current) return design;
  const alternatives = listAlternativeSockets(parent.sockets, current, entry.objectType);
  if (alternatives.length < 2) return design;
  for (const socket of alternatives) {
    const candidate = socket.id === attachment.socketId ? design : withSocket(design, instanceId, socket.id);
    if (!hasErrorsFor(candidate, domain, instanceId)) return candidate;
  }
  return design;
}

function withSocket(design: Design, instanceId: string, socketId: string): Design {
  return {
    ...design,
    root: updateInstance(design.root, instanceId, (instance) => (instance.attachment ? { ...instance, attachment: { ...instance.attachment, socketId } } : instance)),
  };
}

function tryPlace(design: Design, domain: Domain) {
  try {
    return placeInstances(design, domain);
  } catch {
    return undefined;
  }
}

function hasErrorsFor(design: Design, domain: Domain, instanceId: string): boolean {
  try {
    return listViolations(design, domain, ignoreLabel).some((violation) => violation.instanceId === instanceId && violation.level === 'error');
  } catch {
    return true;
  }
}

/** Objektet och barnen som sitter direkt på det, vars kopplingspunkt kan behöva bytas när objektets mått ändras. */
export function listAffectedInstanceIds(design: Design, instanceId: string): string[] {
  const instance = findInstance(design.root, instanceId);
  return instance ? [instanceId, ...instance.children.map((child) => child.id)] : [];
}
