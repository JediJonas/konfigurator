import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import type { SocketRef } from '../state/designStore';

/** Kopplingspunkten som hör till en del, t.ex. väggytan när man trycker på en vägg i 3D-vyn. */
export function findSocketOwnedBy(placed: readonly PlacedInstance[], partId: string | undefined): SocketRef | undefined {
  if (!partId) return undefined;
  for (const entry of placed) {
    const socket = entry.sockets.find((candidate) => candidate.ownerPartId === partId);
    if (socket) return { instanceId: entry.instance.id, socketId: socket.id };
  }
  return undefined;
}
