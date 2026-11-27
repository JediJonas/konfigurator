import { useId, useMemo } from 'react';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import { proposeChild } from '../../core/rules/placement';
import { activeDomain, translate } from '../activeDomain';
import type { SocketRef } from '../state/designStore';
import { useDesignStore } from '../state/designStore';
import { useSeenHints } from '../state/seenHints';
import type { Design } from '../../core/model/design';
import { uiStrings } from './strings.sv';

interface AddToInstanceProps {
  entry: PlacedInstance;
}

/**
 * Val av vägg på just det här objektet och de objekttyper som kan fästa där.
 * Samma val görs genom att trycka på en vägg i 3D-vyn; här går det också med tangentbord.
 */
export function AddToInstance({ entry }: AddToInstanceProps) {
  const { design, selectedSocket, selectSocket, addChild } = useDesignStore();
  const selectId = useId();
  const hasTappedWall = useSeenHints((state) => state.seen.addFromView);
  const instanceId = entry.instance.id;
  // Förslagen prövar många storlekar och lägen, så de räknas bara om när designen eller valet ändras.
  const { sockets, selected, proposals } = useMemo(() => listAddOptions(design, entry, selectedSocket), [design, entry, selectedSocket]);
  if (!selected) return null;

  return (
    <div className="add-to-instance">
      <h3>{uiStrings.addTitle}</h3>
      <div className="field">
        <label htmlFor={selectId}>{uiStrings.wall}</label>
        <select id={selectId} value={selected.id} onChange={(event) => selectSocket({ instanceId, socketId: event.target.value })}>
          {sockets.map((socket) => (
            <option key={socket.id} value={socket.id}>
              {translate(socket.labelKey)}
            </option>
          ))}
        </select>
        {hasTappedWall ? null : <p className="field-hint">{uiStrings.addHint}</p>}
      </div>
      {proposals.map(({ objectType, socket, proposal }) => {
        const reasonId = `${selectId}-${objectType.id}-${socket.kind}`;
        const canAdd = proposal.violations.length === 0;
        return (
          <div key={`${objectType.id}-${socket.id}`} className="add-object">
            <button
              type="button"
              className="secondary-button"
              disabled={!canAdd}
              aria-describedby={canAdd ? undefined : reasonId}
              onClick={() => addChild({ parentId: instanceId, socketId: socket.id, objectTypeId: objectType.id })}
            >
              {addLabel(objectType.id, objectType.labelKey, socket.kind)}
            </button>
            {canAdd ? null : (
              <p className="field-hint" id={reasonId}>
                {uiStrings.cannotAdd}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Objektets väggar, den valda väggen och förslaget för varje objekttyp som kan
 * fästa där. En vägg kan ha flera kopplingspunkter, t.ex. för en tillbyggnad
 * och för en sektion bredvid; väggen visas en gång och varje punkt får en knapp.
 */
function listAddOptions(design: Design, entry: PlacedInstance, selectedSocket: SocketRef | undefined) {
  const instanceId = entry.instance.id;
  const attachableKinds = new Set(activeDomain.objectTypes.flatMap((objectType) => objectType.attachesTo));
  const attachable = entry.sockets.filter((socket) => attachableKinds.has(socket.kind));
  const sockets = attachable.filter((socket, index) => !socket.ownerPartId || attachable.findIndex((other) => other.ownerPartId === socket.ownerPartId) === index);
  const chosen = attachable.find((socket) => selectedSocket?.instanceId === instanceId && socket.id === selectedSocket.socketId);
  const selected = sockets.find((socket) => chosen && (socket.id === chosen.id || (socket.ownerPartId !== undefined && socket.ownerPartId === chosen.ownerPartId))) ?? sockets[0];
  const onSelectedWall = selected ? attachable.filter((socket) => socket.id === selected.id || (selected.ownerPartId !== undefined && socket.ownerPartId === selected.ownerPartId)) : [];
  const proposals = onSelectedWall.flatMap((socket) =>
    activeDomain.objectTypes
      .filter((objectType) => objectType.attachesTo.includes(socket.kind))
      .map((objectType) => ({ objectType, socket, proposal: proposeChild(design, activeDomain, { parentId: instanceId, socketId: socket.id, objectTypeId: objectType.id }) })),
  );
  return { sockets, selected, proposals };
}

/**
 * Domänen kan ge en egen text, t.ex. "Lägg till tillbyggnad" för en sektion
 * på en vägg, och en för en viss sorts kopplingspunkt, t.ex. "Lägg till sektion bredvid".
 */
function addLabel(objectTypeId: string, labelKey: string, socketKind: string): string {
  const domainLabel = activeDomain.strings[`add.${objectTypeId}.${socketKind}`] ?? activeDomain.strings[`add.${objectTypeId}`];
  return domainLabel ?? uiStrings.addObject(translate(labelKey));
}
