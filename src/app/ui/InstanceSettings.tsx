import { useId } from 'react';
import { describeParams } from '../../core/model/paramForm';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import type { RuleViolation } from '../../core/rules/rule';
import { translate } from '../activeDomain';
import { useDesignStore } from '../state/designStore';
import { NumberInput, ParamForm } from './ParamForm';
import { uiStrings } from './strings.sv';

interface InstanceSettingsProps {
  entry: PlacedInstance;
  violations: RuleViolation[];
  /** Objekt som sitter på ett annat objekt (inte direkt på roten) kan tas bort och flyttas längs väggen. */
  isRemovable: boolean;
}

/** Ett objekts inställningar: läge i kopplingspunkten, parametrar och det reglerna säger om det. */
export function InstanceSettings({ entry, violations, isRemovable }: InstanceSettingsProps) {
  const { setParam, removeChild, moveAlongSocket } = useDesignStore();
  const offsetId = useId();
  const { instance, objectType, socket, parentId } = entry;
  return (
    <section className="panel-section">
      <div className="instance-heading">
        <h2>
          {translate(objectType.labelKey)} <span className="instance-id">{instance.id}</span>
        </h2>
        {isRemovable ? (
          <button type="button" className="secondary-button" aria-label={uiStrings.remove(instance.id)} onClick={() => removeChild(instance.id)}>
            {uiStrings.removeLabel}
          </button>
        ) : null}
      </div>
      {isRemovable && socket && parentId ? (
        <>
          <p className="instance-place">{uiStrings.attachedTo(uiStrings.socketName(parentId, translate(socket.labelKey)))}</p>
          <NumberInput
            id={offsetId}
            label={uiStrings.offsetAlongSocket}
            field={offsetField(socket.bounds)}
            value={instance.attachment?.u ?? 0}
            onChange={(u) => moveAlongSocket(instance.id, u)}
          />
        </>
      ) : null}
      <ParamForm fields={describeParams(objectType.params)} values={instance.params} onChange={(key, value) => setParam(instance.id, key, value)} />
      <ViolationList violations={violations} />
    </section>
  );
}

function offsetField(bounds: { x: number }[]) {
  const xs = bounds.map((point) => point.x);
  return { kind: 'number', key: 'u', meta: { labelKey: 'u', unit: 'mm', step: 5 }, min: Math.floor(Math.min(...xs)), max: Math.ceil(Math.max(...xs)), defaultValue: 0 } as const;
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
