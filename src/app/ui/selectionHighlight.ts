import type { Part } from '../../core/model/part';
import { isPieceOf } from '../../core/model/part';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import type { FocusedInstance, SocketRef } from '../state/designStore';
import { findChosenGroupSocket, listGroupSockets } from './panelWalls';
import { isShownUnderParent } from './socketSelection';

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
  /** Falskt efter ett tryck utanför huset. */
  isOpenInstanceHighlighted?: boolean;
  /** Takfallet som knapparna under Tak lägger till på. */
  selectedGroupSocket?: SocketRef;
}

/**
 * Vad som är valt: fönstret eller dörren som är öppen i panelen, annars väggen
 * som är vald, eller takfallet som knapparna under Tak lägger till på så
 * länge sektionen är öppen i panelen. Ett tak utan takfall, t.ex. ett platt
 * tak, markeras helt.
 */
export function describeHighlight(placed: readonly PlacedInstance[], parts: readonly Part[], selection: SelectionState): SelectionHighlight {
  const { selectedSocket, focusedInstance, openInstanceId, isOpenInstanceHighlighted = true, selectedGroupSocket } = selection;
  // Fönstret, dörren eller kupan som är öppen går före väggen den sitter på, som står kvar vald.
  const open = placed.find((entry) => entry.instance.id === openInstanceId);
  if (open && isShownUnderParent(open) && isOpenInstanceHighlighted) {
    return { partIds: idsOf(parts.filter((part) => part.sourceInstanceId === open.instance.id)), pickInstanceId: open.instance.id };
  }
  if (selectedSocket) {
    const ownerPartId = placed
      .find((entry) => entry.instance.id === selectedSocket.instanceId)
      ?.sockets.find((socket) => socket.id === selectedSocket.socketId)?.ownerPartId;
    return { partIds: idsOf(parts.filter((part) => ownerPartId !== undefined && isPieceOf(part, ownerPartId))) };
  }
  const groupKey = focusedInstance?.groupKey;
  if (groupKey && focusedInstance.instanceId === openInstanceId) {
    const section = placed.find((entry) => entry.instance.id === openInstanceId);
    const groupSockets = section ? listGroupSockets(section, [], groupKey).sockets : [];
    const ownerPartId = findChosenGroupSocket(groupSockets, openInstanceId, selectedGroupSocket)?.ownerPartId;
    const inGroup = parts.filter((part) => part.sourceInstanceId === openInstanceId && part.paramGroupKey === groupKey);
    return { partIds: idsOf(ownerPartId ? inGroup.filter((part) => isPieceOf(part, ownerPartId)) : inGroup) };
  }
  return { partIds: new Set() };
}

function idsOf(parts: readonly Part[]): Set<string> {
  return new Set(parts.map((part) => part.id));
}
