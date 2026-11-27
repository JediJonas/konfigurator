import type { Socket } from '../../core/model/objectType';
import type { ParamField } from '../../core/model/paramForm';
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
    // Punkter som hör till en fältgrupp, t.ex. takfallen, visas under gruppen (`listGroupSockets`).
    if (!ownerPartId || socket.paramGroupKey || walls.some((wall) => wall.ownerPartId === ownerPartId)) continue;
    walls.push({ socket, ownerPartId, nested: nested.filter((child) => child.socket?.ownerPartId === ownerPartId) });
  }
  return walls.sort((a, b) => a.socket.labelKey.localeCompare(b.socket.labelKey, undefined, { numeric: true }));
}

/** Kopplingspunkterna i en fältgrupp och objekten som sitter i dem, t.ex. takfallen och takkuporna under Tak. */
export interface PanelGroupSockets {
  sockets: Socket[];
  nested: PlacedInstance[];
}

/** Objektets kopplingspunkter som hör till fältgruppen, i samma ordning som väggarna, och det som sitter i dem. */
export function listGroupSockets(entry: PlacedInstance, nested: readonly PlacedInstance[], groupKey: string): PanelGroupSockets {
  const sockets = entry.sockets.filter((socket) => socket.paramGroupKey === groupKey);
  const ids = new Set(sockets.map((socket) => socket.id));
  return {
    sockets: [...sockets].sort((a, b) => a.labelKey.localeCompare(b.labelKey, undefined, { numeric: true })),
    nested: nested.filter((child) => child.socket?.paramGroupKey === groupKey && ids.has(child.socket.id)),
  };
}

/** Fältgruppen som objektet sitter under i panelen, t.ex. Tak för en takkupa. Saknas för det som sitter på en vägg. */
export function groupKeyOfPlace(entry: PlacedInstance): string | undefined {
  return entry.socket?.paramGroupKey;
}

/** Delen som en kopplingspunkt på objektet hör till, t.ex. väggen man tryckte på i 3D-vyn. */
export function findOwnerPartId(entry: PlacedInstance | undefined, socketId: string): string | undefined {
  return entry?.sockets.find((socket) => socket.id === socketId)?.ownerPartId;
}

/**
 * Delens fält, t.ex. väggens Längd och Höjd, med namnet de har vid delen och
 * utan grupp, eftersom delens rubrik redan samlar dem. Gränserna följer med.
 */
export function listPartFields(fields: readonly ParamField[], socket: Socket): ParamField[] {
  return (socket.partParams ?? []).flatMap(({ key, labelKey }) => {
    const field = fields.find((candidate) => candidate.key === key);
    return field ? [{ ...field, meta: { ...field.meta, labelKey, groupKey: undefined } }] : [];
  });
}
