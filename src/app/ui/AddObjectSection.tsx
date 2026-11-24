import { useId, useMemo } from 'react';
import type { Socket } from '../../core/model/objectType';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import { proposeChild } from '../../core/rules/placement';
import { activeDomain, translate } from '../activeDomain';
import type { SocketRef } from '../state/designStore';
import { useDesignStore } from '../state/designStore';
import { uiStrings } from './strings.sv';

interface AddObjectSectionProps {
  placed: PlacedInstance[];
}

interface SocketChoice extends SocketRef {
  label: string;
  socket: Socket;
}

/**
 * Val av kopplingspunkt och de objekttyper som kan fästa där. Samma val görs
 * genom att trycka på en vägg i 3D-vyn; här går det också med tangentbord.
 */
export function AddObjectSection({ placed }: AddObjectSectionProps) {
  const { design, selectedSocket, selectSocket, addChild } = useDesignStore();
  const selectId = useId();
  const choices = useMemo(() => listSocketChoices(placed), [placed]);
  const selected = choices.find((choice) => choice.instanceId === selectedSocket?.instanceId && choice.socketId === selectedSocket.socketId) ?? choices[0];
  const attachable = activeDomain.objectTypes.filter((objectType) => selected && objectType.attachesTo.includes(selected.socket.kind));
  const proposals = useMemo(
    () =>
      selected
        ? attachable.map((objectType) => ({
            objectType,
            proposal: proposeChild(design, activeDomain, { parentId: selected.instanceId, socketId: selected.socketId, objectTypeId: objectType.id }, translate),
          }))
        : [],
    [attachable, design, selected],
  );
  if (!selected) return null;

  return (
    <section className="panel-section">
      <h2>{uiStrings.addTitle}</h2>
      <div className="field">
        <label htmlFor={selectId}>{uiStrings.wall}</label>
        <select
          id={selectId}
          value={`${selected.instanceId}/${selected.socketId}`}
          onChange={(event) => selectSocket(choices.find((choice) => `${choice.instanceId}/${choice.socketId}` === event.target.value))}
        >
          {choices.map((choice) => (
            <option key={`${choice.instanceId}/${choice.socketId}`} value={`${choice.instanceId}/${choice.socketId}`}>
              {choice.label}
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
              onClick={() => addChild({ parentId: selected.instanceId, socketId: selected.socketId, objectTypeId: objectType.id })}
            >
              {addLabel(objectType.id, objectType.labelKey)}
            </button>
            {canAdd ? null : (
              <p className="field-hint" id={reasonId}>
                {uiStrings.cannotAdd} {proposal.violations.map((violation) => violation.message).join(' ')}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}

/** Kopplingspunkter som minst en objekttyp kan fästa i. Roten har marken, som huset redan står på. */
function listSocketChoices(placed: PlacedInstance[]): SocketChoice[] {
  const attachableKinds = new Set(activeDomain.objectTypes.flatMap((objectType) => objectType.attachesTo));
  return placed
    .filter((entry) => entry.parentId !== undefined)
    .flatMap((entry) =>
      entry.sockets
        .filter((socket) => attachableKinds.has(socket.kind))
        .map((socket) => ({
          instanceId: entry.instance.id,
          socketId: socket.id,
          socket,
          label: uiStrings.socketName(entry.instance.id, translate(socket.labelKey)),
        })),
    );
}

/** Domänen kan ge en egen text, t.ex. "Lägg till tillbyggnad" för en sektion på en vägg. */
function addLabel(objectTypeId: string, labelKey: string): string {
  const domainLabel = activeDomain.strings[`add.${objectTypeId}`];
  return domainLabel ?? uiStrings.addObject(translate(labelKey));
}
