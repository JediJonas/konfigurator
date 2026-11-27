import { useId, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ParamField } from '../../core/model/paramForm';
import { describeParams } from '../../core/model/paramForm';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import type { RuleViolation } from '../../core/rules/rule';
import type { OffsetRange } from '../../core/rules/placement';
import { measureOffsetReach, SNAP_STEP_MM } from '../../core/rules/placement';
import { translate } from '../activeDomain';
import { OFFSET_KEY } from '../rules/ruleRanges';
import type { KnownRanges } from '../rules/useRuleRanges';
import { useRuleRanges } from '../rules/useRuleRanges';
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
  /** Rubriknivå: 2 för sektioner, 3 för objekt som är samlade under en sektion. */
  headingLevel?: 2 | 3;
  /** Objekten som är samlade under det här, t.ex. sektionens fönster. */
  children?: ReactNode;
}

/** Ett objekts inställningar: läge i kopplingspunkten, parametrar och det reglerna säger om det. */
export function InstanceSettings({ entry, violations, isRemovable, isOpen, onToggle, headingLevel = 2, children }: InstanceSettingsProps) {
  const { setParam, removeChild, moveAlongSocket } = useDesignStore();
  const offsetId = useId();
  const bodyId = useId();
  const knownRanges = useRuleRanges(entry, isOpen, isRemovable);
  const offsetRange = describeOffsetRange(entry, isRemovable, knownRanges[OFFSET_KEY]);
  const paramFields = useParamFieldsWithinRules(entry, knownRanges);
  const { instance, objectType, socket, parentId } = entry;
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section className="panel-section" data-instance-id={instance.id}>
      <div className="instance-heading">
        <Heading>
          <button type="button" className="disclosure" aria-expanded={isOpen} aria-controls={bodyId} onClick={onToggle}>
            <svg className="disclosure-icon" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
              <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {translate(objectType.labelKey)} <span className="instance-id">{instance.id}</span>
          </button>
        </Heading>
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
              {knownRanges[OFFSET_KEY] && offsetRange.min === offsetRange.max ? <p className="field-hint">{uiStrings.noRoomToMove}</p> : null}
            </>
          ) : null}
          <ParamForm fields={paramFields} values={instance.params} onChange={(key, value) => setParam(instance.id, key, value)} />
          <AddToInstance entry={entry} />
        </div>
      ) : null}
      {/* Felen syns även när sektionen är stängd, så att inget som stoppar ritningen göms. */}
      <ViolationList violations={violations} />
      {children}
    </section>
  );
}

function offsetField(range: OffsetRange) {
  return { kind: 'number', key: 'u', meta: { labelKey: 'u', unit: 'mm', step: SNAP_STEP_MM }, min: range.min, max: range.max, defaultValue: 0 } as const;
}

/**
 * Hur långt objektet kan flyttas längs väggen. Tills gränserna är räknade
 * gäller hela kopplingspunkten; läget snäpper ändå till där objektet ryms.
 */
function describeOffsetRange(entry: PlacedInstance, isMovable: boolean, known: OffsetRange | undefined): OffsetRange {
  const u = entry.instance.attachment?.u ?? 0;
  if (!isMovable || !entry.socket) return { min: u, max: u };
  if (known) return known;
  const reach = measureOffsetReach(entry);
  return { min: -reach, max: reach };
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

/**
 * Formulärets fält med min och max för talen satta så långt de går utan att
 * något i huset bryter mot reglerna, t.ex. att väggen inte blir kortare än
 * tillbyggnaden på den. Pilarna i fältet stannar då vid gränsen. Gränserna
 * räknas vid sidan av (`useRuleRanges`); tills de finns gäller schemats.
 */
function useParamFieldsWithinRules(entry: PlacedInstance, knownRanges: KnownRanges): ParamField[] {
  const { objectType } = entry;
  const fields = useMemo(() => describeParams(objectType.params), [objectType.params]);
  return useMemo(
    () => fields.map((field) => (field.kind === 'number' && knownRanges[field.key] ? { ...field, ...knownRanges[field.key] } : field)),
    [fields, knownRanges],
  );
}
