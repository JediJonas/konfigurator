import type { Part } from '../../core/model/part';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import type { SocketRef } from '../state/designStore';

/** Kopplingspunkten som hör till en del, t.ex. väggytan när man trycker på en vägg i 3D-vyn. */
export function findSocketOwnedBy(placed: readonly PlacedInstance[], partId: string | undefined): SocketRef | undefined {
  if (!partId) return undefined;
  for (const entry of placed) {
    // Takfallen hör till takets fältgrupp, som öppnas i stället för en vägg.
    const socket = entry.sockets.find((candidate) => candidate.ownerPartId === partId && !candidate.paramGroupKey);
    if (socket) return { instanceId: entry.instance.id, socketId: socket.id };
  }
  return undefined;
}

/**
 * Objektet som ska öppnas när man trycker på en del som hör till ett objekt utan
 * egna kopplingspunkter, t.ex. en fönsterlucka eller ett dörrblad.
 */
export function findLeafInstanceOf(placed: readonly PlacedInstance[], parts: readonly Part[], partId: string): string | undefined {
  const sourceId = parts.find((part) => part.id === partId)?.sourceInstanceId;
  const entry = placed.find((candidate) => candidate.instance.id === sourceId);
  return entry && isLeafInstance(entry) ? entry.instance.id : undefined;
}

/** Ett objekt som sitter på ett annat och inte bär något själv, t.ex. ett fönster. */
export function isLeafInstance(entry: PlacedInstance): boolean {
  return entry.parentId !== undefined && entry.sockets.length === 0;
}
