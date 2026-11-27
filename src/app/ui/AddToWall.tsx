import { useId } from 'react';
import type { Socket } from '../../core/model/objectType';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import { activeDomain, translate } from '../activeDomain';
import { useWallProposals } from '../rules/useWallProposals';
import { listWallObjectTypes } from '../rules/wallProposals';
import { useDesignStore } from '../state/designStore';
import { uiStrings } from './strings.sv';

interface AddToWallProps {
  entry: PlacedInstance;
  /** Väggens första kopplingspunkt; förslaget väljer den punkt på väggen där objektet ryms. */
  wall: Socket;
}

/** Knapparna för att bygga till en vägg, en per objekttyp som kan fästa där, t.ex. + Sektion, + Fönster och + Dörr. Utan rubrik (ägarens val). */
export function AddToWall({ entry, wall }: AddToWallProps) {
  const { addChild } = useDesignStore();
  const idPrefix = useId();
  const instanceId = entry.instance.id;
  // Förslagen prövar många storlekar och lägen, så de räknas vid sidan av; tills de är kända går alla knappar att trycka på.
  const states = useWallProposals(entry, wall);
  const proposals = listWallObjectTypes(activeDomain, entry, wall).map((objectType) => {
    const state = states?.find((candidate) => candidate.objectTypeId === objectType.id);
    return { objectType, canAdd: state?.canAdd ?? true, blockingMessage: state?.blockingMessage };
  });
  if (proposals.length === 0) return null;
  const blocked = proposals.filter(({ canAdd }) => !canAdd);
  return (
    <div className="add-to-wall">
      <div className="add-buttons">
        {proposals.map(({ objectType, canAdd }) => {
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
      {blocked.map(({ objectType, blockingMessage }) => (
        <p key={objectType.id} className="field-hint" id={`${idPrefix}-${objectType.id}`}>
          {translate(objectType.labelKey)}: {blockingMessage ?? uiStrings.cannotAdd}
        </p>
      ))}
    </div>
  );
}

/** Domänen kan ge en egen text, t.ex. "Lägg till sektion". */
function addLabel(objectTypeId: string, labelKey: string): string {
  const domainLabel = activeDomain.strings[`add.${objectTypeId}`];
  return domainLabel ?? uiStrings.addObject(translate(labelKey));
}
