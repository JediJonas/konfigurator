import { useId, useMemo } from 'react';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import { proposeChild } from '../../core/rules/placement';
import { activeDomain, translate } from '../activeDomain';
import type { SocketRef } from '../state/designStore';
import { useDesignStore } from '../state/designStore';
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
        <p className="field-hint">{uiStrings.addHint}</p>
      </div>
      {proposals.map(({ objectType, proposal }) => {
        const reasonId = `${selectId}-${objectType.id}`;
        const canAdd = proposal.violations.length === 0;
        return (
          <div key={objectType.id} className="add-object">
            <button
              type="button"
              className="secondary-button"
              disabled={!canAdd}
              aria-describedby={canAdd ? undefined : reasonId}
              onClick={() => addChild({ parentId: instanceId, socketId: selected.id, objectTypeId: objectType.id })}
            >
              {addLabel(objectType.id, objectType.labelKey)}
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

/** Objektets väggar, den valda väggen och förslaget för varje objekttyp som kan fästa där. */
function listAddOptions(design: Design, entry: PlacedInstance, selectedSocket: SocketRef | undefined) {
  const instanceId = entry.instance.id;
  const attachableKinds = new Set(activeDomain.objectTypes.flatMap((objectType) => objectType.attachesTo));
  const sockets = entry.sockets.filter((socket) => attachableKinds.has(socket.kind));
  const selected = sockets.find((socket) => selectedSocket?.instanceId === instanceId && socket.id === selectedSocket.socketId) ?? sockets[0];
  const proposals = selected
    ? activeDomain.objectTypes
        .filter((objectType) => objectType.attachesTo.includes(selected.kind))
        .map((objectType) => ({ objectType, proposal: proposeChild(design, activeDomain, { parentId: instanceId, socketId: selected.id, objectTypeId: objectType.id }) }))
    : [];
  return { sockets, selected, proposals };
}

/** Domänen kan ge en egen text, t.ex. "Lägg till tillbyggnad" för en sektion på en vägg. */
function addLabel(objectTypeId: string, labelKey: string): string {
  const domainLabel = activeDomain.strings[`add.${objectTypeId}`];
  return domainLabel ?? uiStrings.addObject(translate(labelKey));
}
