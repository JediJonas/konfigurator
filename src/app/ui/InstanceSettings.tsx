import { useId, useMemo } from 'react';
import type { Instance } from '../../core/model/design';
import type { ParamField } from '../../core/model/paramForm';
import { describeParams } from '../../core/model/paramForm';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import type { RuleViolation } from '../../core/rules/rule';
import type { OffsetRange } from '../../core/rules/placement';
import { measureOffsetReach, SNAP_STEP_MM } from '../../core/rules/placement';
import { fromShownOffset, toShownOffset, toShownOffsetRange } from './shownOffset';
import { activeDomain, translate } from '../activeDomain';
import { OFFSET_KEY } from '../rules/ruleRanges';
import type { KnownRanges } from '../rules/useRuleRanges';
import { useRuleRanges } from '../rules/useRuleRanges';
import { useDesignStore } from '../state/designStore';
import { AddToWall } from './AddToWall';
import { ConfirmAction } from './ConfirmAction';
import { NumberInput } from './NumberInput';
import { ParamForm } from './ParamForm';
import { uiStrings } from './strings.sv';

interface InstanceSettingsProps {
  entry: PlacedInstance;
  /** Felen för objektet och för det som sitter på det, t.ex. fönstret i en takkupa. */
  violations: RuleViolation[];
  /** Öppen visar läge och parametrar; stängd bara rubriken och det reglerna säger. */
  isOpen: boolean;
  onToggle: () => void;
  /** 3 under en vägg eller taket, 4 för t.ex. ett fönster i en takkupa. */
  headingLevel?: 3 | 4;
  /** Det som sitter på objektet, t.ex. fönstret i en takkupa, med om det är utfällt. */
  nested?: PlacedInstance[];
  isNestedOpen?: (instanceId: string) => boolean;
  onToggleNested?: (instanceId: string) => void;
}

/**
 * Inställningarna för ett objekt som sitter på en vägg eller på taket, t.ex.
 * ett fönster eller en takkupa: läge, parametrar, det som sitter på objektet
 * med knappar för att lägga till mer, och det reglerna säger om det.
 */
export function InstanceSettings(props: InstanceSettingsProps) {
  const { entry, violations, isOpen, onToggle, headingLevel = 3, nested = [] } = props;
  const { setParam } = useDesignStore();
  const bodyId = useId();
  const knownRanges = useRuleRanges(entry, isOpen, true);
  const paramFields = useParamFieldsWithinRules(entry, knownRanges);
  const { instance } = entry;
  const violationsOf = (instanceId: string) => violations.filter((violation) => violation.instanceId === instanceId);
  return (
    <section className="panel-section" data-instance-id={instance.id}>
      <InstanceHeading entry={entry} headingLevel={headingLevel} isOpen={isOpen} onToggle={onToggle} bodyId={bodyId} />
      {isOpen ? (
        <div id={bodyId} className="instance-body">
          <OffsetInput entry={entry} knownRanges={knownRanges} />
          <ParamForm fields={paramFields} values={instance.params} onChange={(key, value) => setParam(instance.id, key, value)} />
          {nested.length > 0 ? (
            <div className="nested-instances">
              {nested.map((child) => (
                <InstanceSettings
                  key={child.instance.id}
                  entry={child}
                  headingLevel={4}
                  isOpen={props.isNestedOpen?.(child.instance.id) ?? false}
                  onToggle={() => props.onToggleNested?.(child.instance.id)}
                  violations={violationsOf(child.instance.id)}
                />
              ))}
            </div>
          ) : null}
          {entry.sockets.map((socket) => (
            <AddToWall key={socket.id} entry={entry} wall={socket} />
          ))}
          <RemoveButton instance={instance} />
        </div>
      ) : null}
      {/* Felen syns även när objektet är stängt, så att inget som stoppar ritningen göms. */}
      <ViolationList violations={isOpen ? violationsOf(instance.id) : violations} />
    </section>
  );
}

interface InstanceHeadingProps {
  entry: PlacedInstance;
  /** 2 för sektioner, 3 för objekt som är samlade under en sektion och 4 för det som sitter på dem. */
  headingLevel: 2 | 3 | 4;
  isOpen: boolean;
  onToggle: () => void;
  bodyId: string;
}

/** Objektets rubrik, t.ex. "Fönster F1", som fäller ut och fäller ihop det. */
export function InstanceHeading({ entry, headingLevel, isOpen, onToggle, bodyId }: InstanceHeadingProps) {
  const Heading = (['h2', 'h3', 'h4'] as const)[headingLevel - 2] ?? 'h3';
  const iconSize = headingLevel === 2 ? 20 : 18;
  return (
    <Heading>
      <button type="button" className="disclosure" aria-expanded={isOpen} aria-controls={bodyId} onClick={onToggle}>
        <svg className="disclosure-icon" aria-hidden="true" viewBox="0 0 24 24" width={iconSize} height={iconSize}>
          <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {translate(entry.objectType.labelKey)} <span className="instance-id">{entry.instance.id}</span>
      </button>
    </Heading>
  );
}

/** Läge längs väggen för ett objekt som sitter på en vägg, med gränser så långt det kan flyttas. */
export function OffsetInput({ entry, knownRanges }: { entry: PlacedInstance; knownRanges: KnownRanges }) {
  const { moveAlongSocket } = useDesignStore();
  const offsetId = useId();
  const offsetRange = describeOffsetRange(entry, true, knownRanges[OFFSET_KEY]);
  const { instance, socket, parentId } = entry;
  if (!socket || !parentId) return null;
  return (
    <>
      <p className="instance-place">{uiStrings.attachedTo(uiStrings.socketName(parentId, translate(socket.labelKey)))}</p>
      <NumberInput id={offsetId} label={activeDomain.strings[`offset.${socket.kind}`] ?? uiStrings.offsetAlongSocket} field={offsetField(toShownOffsetRange(offsetRange))} value={toShownOffset(instance.attachment?.u ?? 0)} onChange={(shown) => moveAlongSocket(instance.id, fromShownOffset(shown))} />
      {/* Fältets min och max visar hur långt det kan flyttas; texten behövs bara när det inte går alls. */}
      {knownRanges[OFFSET_KEY] && offsetRange.min === offsetRange.max ? <p className="field-hint">{uiStrings.noRoomToMove}</p> : null}
    </>
  );
}

/**
 * "Ta bort F1" sist i det utfällda objektet, så att listan inte har en knapp på varje rad (ägarens val).
 * Man bekräftar först, som för "Börja om" (ägarens val).
 */
export function RemoveButton({ instance }: { instance: Instance }) {
  const { removeChild } = useDesignStore();
  return (
    <ConfirmAction
      label={uiStrings.remove(instance.id)}
      question={uiStrings.removeQuestion(instance.id, instance.children.length > 0)}
      confirmLabel={uiStrings.confirmRemove(instance.id)}
      onConfirm={() => removeChild(instance.id)}
      className="remove-button"
    />
  );
}

function offsetField(range: OffsetRange) {
  return { kind: 'number', key: 'u', meta: { labelKey: 'u', unit: 'mm', step: SNAP_STEP_MM }, min: range.min, max: range.max, gaps: range.gaps, defaultValue: 0 } as const;
}

/**
 * Hur långt objektet kan flyttas längs väggen. Tills gränserna är räknade
 * gäller hela kopplingspunkten; läget snäpper ändå till där objektet ryms.
 */
function describeOffsetRange(entry: PlacedInstance, isMovable: boolean, known: OffsetRange | undefined): OffsetRange {
  const u = entry.instance.attachment?.u ?? 0;
  if (!isMovable || !entry.socket) return { min: u, max: u, gaps: [] };
  if (known) return known;
  const reach = measureOffsetReach(entry);
  return { min: -reach, max: reach, gaps: [] };
}

export function ViolationList({ violations }: { violations: RuleViolation[] }) {
  if (violations.length === 0) return null;
  return (
    <ul className="violations" role="alert">
      {violations.map((violation) => (
        <li key={`${violation.instanceId}/${violation.message}`} className={`violation violation-${violation.level}`}>
          <strong>{violation.level === 'error' ? uiStrings.cannotBuild : uiStrings.warning}</strong> {violation.message}
        </li>
      ))}
    </ul>
  );
}

/**
 * Formulärets fält med min och max för talen satta så långt de går utan att
 * något i huset bryter mot reglerna, t.ex. att väggen inte blir kortare än
 * tillbyggnaden på den. Pilarna i fältet stannar då vid gränsen och hoppar
 * över glapp där inget går att bygga. Gränserna
 * räknas vid sidan av (`useRuleRanges`); tills de finns gäller schemats.
 */
export function useParamFieldsWithinRules(entry: PlacedInstance, knownRanges: KnownRanges): ParamField[] {
  const { objectType } = entry;
  const fields = useMemo(() => describeParams(objectType.params), [objectType.params]);
  return useMemo(
    () => fields.map((field) => (field.kind === 'number' && knownRanges[field.key] ? { ...field, ...knownRanges[field.key] } : field)),
    [fields, knownRanges],
  );
}
