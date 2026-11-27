import type { Design } from '../../core/model/design';
import type { Domain } from '../../core/model/domain';
import type { Socket } from '../../core/model/objectType';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import { placeInstances } from '../../core/pipeline/placeInstances';
import { proposeChild } from '../../core/rules/placement';

/** Vilka knappar för att bygga till en vägg som går, räknade för en viss design. */
export interface WallProposalRequest {
  id: number;
  design: Design;
  parentId: string;
  /** Väggens första kopplingspunkt; förslaget väljer den punkt på väggen där objektet ryms. */
  socketId: string;
}

/** Om objekttypen går att lägga till på väggen, och annars varför inte. */
export interface WallProposalState {
  objectTypeId: string;
  canAdd: boolean;
  /** Regelns text när en regel stoppar, t.ex. en dörr per vägg. */
  blockingMessage?: string;
}

export interface WallProposalResult {
  requestId: number;
  /** Väggen som `${parentId}|${socketId}`, som `wallKey`. */
  wallKey: string;
  states: WallProposalState[];
}

export function wallKey(parentId: string, socketId: string): string {
  return `${parentId}|${socketId}`;
}

/** Objekttyperna som kan fästa på väggen, i någon av dess kopplingspunkter. */
export function listWallObjectTypes(domain: Domain, entry: PlacedInstance, wall: Socket) {
  const onWall = entry.sockets.filter((socket) => socket.id === wall.id || (wall.ownerPartId !== undefined && socket.ownerPartId === wall.ownerPartId));
  return domain.objectTypes.filter((objectType) => onWall.some((socket) => objectType.attachesTo.includes(socket.kind)));
}

/**
 * Förslaget för varje objekttyp som kan fästa på väggen. Förslagen prövar många
 * storlekar, höjder och lägen, så de räknas vid sidan av och inte när panelen ritas.
 */
export function computeWallProposals(request: WallProposalRequest, domain: Domain, resolveLabel: (key: string) => string): WallProposalResult {
  const entry = placeInstances(request.design, domain).find((placed) => placed.instance.id === request.parentId);
  const wall = entry?.sockets.find((socket) => socket.id === request.socketId);
  const states =
    entry && wall
      ? listWallObjectTypes(domain, entry, wall).map((objectType) => {
          const proposal = proposeChild(request.design, domain, { parentId: request.parentId, socketId: request.socketId, objectTypeId: objectType.id }, resolveLabel);
          return { objectTypeId: objectType.id, canAdd: proposal.violations.length === 0, blockingMessage: proposal.blockingMessage };
        })
      : [];
  return { requestId: request.id, wallKey: wallKey(request.parentId, request.socketId), states };
}
