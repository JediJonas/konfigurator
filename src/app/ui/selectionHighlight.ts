import type { Part } from '../../core/model/part';
import { isPieceOf } from '../../core/model/part';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import type { FocusedInstance, SocketRef } from '../state/designStore';
import { isLeafInstance } from './socketSelection';

/** Det som visas markerat i 3D-vyn. */
export interface SelectionHighlight {
  partIds: ReadonlySet<string>;
  /** Objektet vars tryckytor, t.ex. fönsterhålen, visas markerade. */
  pickInstanceId?: string;
}

interface SelectionState {
  selectedSocket?: SocketRef;
  focusedInstance?: FocusedInstance;
  openInstanceId?: string;
}

/**
 * Vad som är valt: väggen man tryckte på, taket man tryckte på så länge dess
 * sektion är öppen i panelen, eller fönstret eller dörren som är öppen i panelen.
 */
export function describeHighlight(placed: readonly PlacedInstance[], parts: readonly Part[], selection: SelectionState): SelectionHighlight {
  const { selectedSocket, focusedInstance, openInstanceId } = selection;
  if (selectedSocket) {
    const ownerPartId = placed
      .find((entry) => entry.instance.id === selectedSocket.instanceId)
      ?.sockets.find((socket) => socket.id === selectedSocket.socketId)?.ownerPartId;
    return { partIds: idsOf(parts.filter((part) => ownerPartId !== undefined && isPieceOf(part, ownerPartId))) };
  }
  const groupKey = focusedInstance?.groupKey;
  if (groupKey && focusedInstance.instanceId === openInstanceId) {
    return { partIds: idsOf(parts.filter((part) => part.sourceInstanceId === openInstanceId && part.paramGroupKey === groupKey)) };
  }
  const open = placed.find((entry) => entry.instance.id === openInstanceId);
  if (open && isLeafInstance(open)) {
    return { partIds: idsOf(parts.filter((part) => part.sourceInstanceId === open.instance.id)), pickInstanceId: open.instance.id };
  }
  return { partIds: new Set() };
}

function idsOf(parts: readonly Part[]): Set<string> {
  return new Set(parts.map((part) => part.id));
}
