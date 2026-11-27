import { useId, useMemo } from 'react';
import type { Design } from '../../core/model/design';
import type { Socket } from '../../core/model/objectType';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import { proposeChild } from '../../core/rules/placement';
import { activeDomain, translate } from '../activeDomain';
import { useDesignStore } from '../state/designStore';
import { uiStrings } from './strings.sv';

interface AddToWallProps {
  entry: PlacedInstance;
  /** Väggens första kopplingspunkt; förslaget väljer den punkt på väggen där objektet ryms. */
  wall: Socket;
}

/** "Bygg till" på en vägg: en knapp per objekttyp som kan fästa där, t.ex. sektion, fönster och dörr. */
export function AddToWall({ entry, wall }: AddToWallProps) {
  const { design, addChild } = useDesignStore();
  const idPrefix = useId();
  const instanceId = entry.instance.id;
  // Förslagen prövar många storlekar och lägen, så de räknas bara om när designen eller väggen ändras.
  const proposals = useMemo(() => listWallProposals(design, entry, wall), [design, entry, wall]);
  if (proposals.length === 0) return null;
  const blocked = proposals.filter(({ proposal }) => proposal.violations.length > 0);
  return (
    <div className="add-to-wall">
      <h4>{uiStrings.addTitle}</h4>
      <div className="add-buttons">
        {proposals.map(({ objectType, proposal }) => {
          const canAdd = proposal.violations.length === 0;
          return (
            <button
              key={objectType.id}
              type="button"
              className="secondary-button add-button"
              disabled={!canAdd}
              aria-label={addLabel(objectType.id, objectType.labelKey)}
              aria-describedby={canAdd ? undefined : `${idPrefix}-${objectType.id}`}
              onClick={() => addChild({ parentId: instanceId, socketId: wall.id, objectTypeId: objectType.id })}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
                <path d="M5 12h14M12 5v14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              {translate(objectType.labelKey)}
            </button>
          );
        })}
      </div>
      {blocked.map(({ objectType, proposal }) => (
        <p key={objectType.id} className="field-hint" id={`${idPrefix}-${objectType.id}`}>
          {translate(objectType.labelKey)}: {proposal.blockingMessage ?? uiStrings.cannotAdd}
        </p>
      ))}
    </div>
  );
}

/**
 * Förslaget för varje objekttyp som kan fästa på väggen. En vägg kan ha flera
 * kopplingspunkter, t.ex. för en tillbyggnad och för en sektion bredvid; förslaget
 * väljer den punkt där objektet ryms.
 */
function listWallProposals(design: Design, entry: PlacedInstance, wall: Socket) {
  const onWall = entry.sockets.filter((socket) => socket.id === wall.id || (wall.ownerPartId !== undefined && socket.ownerPartId === wall.ownerPartId));
  return activeDomain.objectTypes
    .filter((objectType) => onWall.some((socket) => objectType.attachesTo.includes(socket.kind)))
    .map((objectType) => ({
      objectType,
      proposal: proposeChild(design, activeDomain, { parentId: entry.instance.id, socketId: wall.id, objectTypeId: objectType.id }, translate),
    }));
}

/** Domänen kan ge en egen text, t.ex. "Lägg till sektion". */
function addLabel(objectTypeId: string, labelKey: string): string {
  const domainLabel = activeDomain.strings[`add.${objectTypeId}`];
  return domainLabel ?? uiStrings.addObject(translate(labelKey));
}
