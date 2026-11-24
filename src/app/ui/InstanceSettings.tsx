import { useId, useMemo } from 'react';
import { describeParams } from '../../core/model/paramForm';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import type { RuleViolation } from '../../core/rules/rule';
import type { OffsetRange } from '../../core/rules/placement';
import { findAllowedOffsetRange, SNAP_STEP_MM } from '../../core/rules/placement';
import { activeDomain, translate } from '../activeDomain';
import { useDesignStore } from '../state/designStore';
import { AddToInstance } from './AddToInstance';
import { NumberInput, ParamForm } from './ParamForm';
import { uiStrings } from './strings.sv';

interface InstanceSettingsProps {
  entry: PlacedInstance;
  violations: RuleViolation[];
  /** Objekt som sitter på ett annat objekt (inte direkt på roten) kan tas bort och flyttas längs väggen. */
  isRemovable: boolean;
  /** Öppen visar läge och parametrar; stängd bara rubriken och det reglerna säger. */
  isOpen: boolean;
  onToggle: () => void;
}

/** Ett objekts inställningar: läge i kopplingspunkten, parametrar och det reglerna säger om det. */
export function InstanceSettings({ entry, violations, isRemovable, isOpen, onToggle }: InstanceSettingsProps) {
  const { setParam, removeChild, moveAlongSocket } = useDesignStore();
  const offsetId = useId();
  const bodyId = useId();
  const offsetRange = useOffsetRange(entry, isRemovable && isOpen);
  const { instance, objectType, socket, parentId } = entry;
  return (
    <section className="panel-section">
      <div className="instance-heading">
        <h2>
          <button type="button" className="disclosure" aria-expanded={isOpen} aria-controls={bodyId} onClick={onToggle}>
            <svg className="disclosure-icon" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
              <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {translate(objectType.labelKey)} <span className="instance-id">{instance.id}</span>
          </button>
        </h2>
        {isRemovable ? (
          <button type="button" className="secondary-button" aria-label={uiStrings.remove(instance.id)} onClick={() => removeChild(instance.id)}>
            {uiStrings.removeLabel}
          </button>
        ) : null}
      </div>
      {isOpen ? (
        <div id={bodyId}>
          {isRemovable && socket && parentId ? (
            <>
              <p className="instance-place">{uiStrings.attachedTo(uiStrings.socketName(parentId, translate(socket.labelKey)))}</p>
              <NumberInput
                id={offsetId}
                label={uiStrings.offsetAlongSocket}
                field={offsetField(offsetRange)}
                value={instance.attachment?.u ?? 0}
                onChange={(u) => moveAlongSocket(instance.id, u)}
              />
              {/* Fältets min och max visar hur långt den kan flyttas; texten behövs bara när det inte går alls. */}
              {offsetRange.min === offsetRange.max ? <p className="field-hint">{uiStrings.noRoomToMove}</p> : null}
            </>
          ) : null}
          <ParamForm fields={describeParams(objectType.params)} values={instance.params} onChange={(key, value) => setParam(instance.id, key, value)} />
          <AddToInstance entry={entry} />
        </div>
      ) : null}
      {/* Felen syns även när sektionen är stängd, så att inget som stoppar ritningen göms. */}
      <ViolationList violations={violations} />
    </section>
  );
}

function offsetField(range: OffsetRange) {
  return { kind: 'number', key: 'u', meta: { labelKey: 'u', unit: 'mm', step: SNAP_STEP_MM }, min: range.min, max: range.max, defaultValue: 0 } as const;
}

/** Bara objekt som sitter på ett annat objekt flyttas längs väggen; de andra behöver inget intervall. */
function useOffsetRange(entry: PlacedInstance, isMovable: boolean): OffsetRange {
  const design = useDesignStore((state) => state.design);
  const u = entry.instance.attachment?.u ?? 0;
  return useMemo(() => {
    if (!isMovable || !entry.socket) return { min: u, max: u };
    const reach = Math.max(...entry.socket.bounds.map((point) => Math.abs(point.x)));
    return findAllowedOffsetRange(design, activeDomain, { instanceId: entry.instance.id, currentU: u, maxReachMm: reach });
  }, [design, entry.instance.id, entry.socket, isMovable, u]);
}

export function ViolationList({ violations }: { violations: RuleViolation[] }) {
  if (violations.length === 0) return null;
  return (
    <ul className="violations" role="alert">
      {violations.map((violation) => (
        <li key={violation.message} className={`violation violation-${violation.level}`}>
          <strong>{violation.level === 'error' ? uiStrings.cannotBuild : uiStrings.warning}</strong> {violation.message}
        </li>
      ))}
    </ul>
  );
}
