import type { Socket } from '../../core/model/objectType';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';

/** En del med egen rubrik under objektet i panelen, t.ex. en vägg, med det som sitter på den. */
export interface PanelWall {
  /** Delens första kopplingspunkt; förslagen väljer själva den punkt på delen där objektet ryms. */
  socket: Socket;
  ownerPartId: string;
  /** Objekten utan egna kopplingspunkter som sitter på delen, t.ex. fönster och dörrar. */
  nested: PlacedInstance[];
}

/**
 * Objektets delar som man kan fästa något i, t.ex. sektionens väggar, en gång
 * per del även när delen har flera kopplingspunkter (tillbyggnad och sektion
 * bredvid). De ordnas efter namn, så att Vägg 1 kommer först.
 */
export function listPanelWalls(entry: PlacedInstance, nested: readonly PlacedInstance[]): PanelWall[] {
  const walls: PanelWall[] = [];
  for (const socket of entry.sockets) {
    const ownerPartId = socket.ownerPartId;
    if (!ownerPartId || walls.some((wall) => wall.ownerPartId === ownerPartId)) continue;
    walls.push({ socket, ownerPartId, nested: nested.filter((child) => child.socket?.ownerPartId === ownerPartId) });
  }
  return walls.sort((a, b) => a.socket.labelKey.localeCompare(b.socket.labelKey, undefined, { numeric: true }));
}

/** Delen som en kopplingspunkt på objektet hör till, t.ex. väggen man tryckte på i 3D-vyn. */
export function findOwnerPartId(entry: PlacedInstance | undefined, socketId: string): string | undefined {
  return entry?.sockets.find((socket) => socket.id === socketId)?.ownerPartId;
}
