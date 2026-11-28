import type { Part } from '../../core/model/part';
import { isPieceOf } from '../../core/model/part';
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
 * Kopplingspunkten i en fältgrupp som hör till delen man tryckte på, t.ex.
 * takfallet, även när delen har delats i bitar av en vinkelränna.
 */
export function findGroupSocketOwning(placed: readonly PlacedInstance[], part: Part): SocketRef | undefined {
  const entry = placed.find((candidate) => candidate.instance.id === part.sourceInstanceId);
  const socket = entry?.sockets.find((candidate) => candidate.paramGroupKey !== undefined && candidate.paramGroupKey === part.paramGroupKey && candidate.ownerPartId !== undefined && isPieceOf(part, candidate.ownerPartId));
  return entry && socket ? { instanceId: entry.instance.id, socketId: socket.id } : undefined;
}

/**
 * Objektet som ska öppnas när man trycker på en del som hör till ett objekt
 * som visas under ett annat i panelen, t.ex. en fönsterlucka, ett dörrblad
 * eller en vägg på en takkupa.
 */
export function findLeafInstanceOf(placed: readonly PlacedInstance[], parts: readonly Part[], partId: string): string | undefined {
  const sourceId = parts.find((part) => part.id === partId)?.sourceInstanceId;
  const entry = placed.find((candidate) => candidate.instance.id === sourceId);
  return entry && isShownUnderParent(entry) ? entry.instance.id : undefined;
}

/** Ett objekt som sitter på ett annat och inte bär något själv, t.ex. ett fönster. */
export function isLeafInstance(entry: PlacedInstance): boolean {
  return entry.parentId !== undefined && entry.sockets.length === 0;
}

/**
 * Ett objekt som visas under objektet det sitter på i panelen och inte med
 * egen rubrik: det bär inget själv, t.ex. ett fönster, eller sitter i en
 * fältgrupp, t.ex. en takkupa under Tak, även om den har ett fönster.
 */
export function isShownUnderParent(entry: PlacedInstance): boolean {
  return isLeafInstance(entry) || (entry.parentId !== undefined && entry.socket?.paramGroupKey !== undefined);
}
