import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import type { ParamField } from '../../core/model/paramForm';
import { isFieldVisible } from '../../core/model/paramForm';
import { translate } from '../activeDomain';
import { uiStrings } from './strings.sv';

interface ParamFormProps {
  fields: ParamField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

/**
 * Formulär som byggs från objekttypens parameterschema, så att nya objekttyper
 * inte kräver ny UI-kod. Fält med samma grupp visas under en egen rubrik som
 * är hopfälld från början, eftersom de sällan ändras (ägarens val). Fält som
 * bara gäller vissa val, t.ex. kantens höjd på ett platt tak, visas bara då.
 */
export function ParamForm({ fields, values, onChange }: ParamFormProps) {
  const visible = fields.filter((field) => isFieldVisible(field, values, fields));
  return (
    <div className="param-form">
      {groupFields(visible).map((group) =>
        group.groupKey ? (
          <FieldGroup key={group.groupKey} labelKey={group.groupKey}>
            {group.fields.map((field) => renderInput(field, values, onChange))}
          </FieldGroup>
        ) : (
          group.fields.map((field) => renderInput(field, values, onChange))
        ),
      )}
    </div>
  );
}

function renderInput(field: ParamField, values: Record<string, unknown>, onChange: (key: string, value: unknown) => void) {
  return <ParamInput key={field.key} field={field} value={values[field.key] ?? field.defaultValue} onChange={(value) => onChange(field.key, value)} />;
}

interface FieldGroupEntry {
  groupKey?: string;
  fields: ParamField[];
}

/** Fälten i schemats ordning, där fält med samma grupp hamnar tillsammans där gruppens första fält står. */
function groupFields(fields: ParamField[]): FieldGroupEntry[] {
  const groups: FieldGroupEntry[] = [];
  for (const field of fields) {
    const groupKey = field.meta.groupKey;
    const existing = groupKey ? groups.find((group) => group.groupKey === groupKey) : undefined;
    if (existing) existing.fields.push(field);
    else groups.push({ groupKey, fields: [field] });
  }
  return groups;
}

function FieldGroup({ labelKey, children }: { labelKey: string; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const bodyId = useId();
  return (
    <div className="field-group">
      <h3>
        <button type="button" className="disclosure" aria-expanded={isOpen} aria-controls={bodyId} onClick={() => setIsOpen(!isOpen)}>
          <svg className="disclosure-icon" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {translate(labelKey)}
        </button>
      </h3>
      {isOpen ? (
        <div id={bodyId} className="param-form">
          {children}
        </div>
      ) : null}
    </div>
  );
}

interface ParamInputProps {
  field: ParamField;
  value: unknown;
  onChange: (value: unknown) => void;
}

function ParamInput({ field, value, onChange }: ParamInputProps) {
  const id = useId();
  const label = translate(field.meta.labelKey);
  if (field.kind === 'boolean') {
    return (
      <label className="field field-checkbox" htmlFor={id}>
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span>{label}</span>
      </label>
    );
  }
  if (field.kind === 'choice') {
    return (
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <select id={id} value={String(value)} onChange={(event) => onChange(event.target.value)}>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {translate(field.meta.optionLabelKeys?.[option] ?? option)}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return <NumberInput id={id} label={label} field={field} value={Number(value)} onChange={onChange} />;
}

interface NumberInputProps {
  id: string;
  label: string;
  field: Extract<ParamField, { kind: 'number' }>;
  value: number;
  onChange: (value: number) => void;
}

/**
 * Behåller det man skriver lokalt och skickar bara giltiga värden vidare, så
 * att man kan sudda och skriva om ett tal utan att huset hoppar under tiden.
 */
export function NumberInput({ id, label, field, value, onChange }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const errorId = `${id}-error`;
  const text = draft ?? String(value);
  const parsed = Number(text.replace(',', '.'));
  const isValid = text.trim() !== '' && Number.isFinite(parsed) && isInRange(parsed, field);

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {field.meta.unit ? <span className="unit"> ({field.meta.unit})</span> : null}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={field.min}
        max={field.max}
        step={field.meta.step ?? 1}
        value={text}
        aria-invalid={!isValid}
        aria-describedby={isValid ? undefined : errorId}
        onChange={(event) => {
          setDraft(event.target.value);
          const next = Number(event.target.value.replace(',', '.'));
          if (event.target.value.trim() !== '' && Number.isFinite(next) && isInRange(next, field)) onChange(next);
        }}
        onBlur={() => setDraft(null)}
      />
      {isValid ? null : (
        <p className="field-error" id={errorId}>
          {uiStrings.outOfRange(field.min, field.max)}
        </p>
      )}
    </div>
  );
}

function isInRange(value: number, field: { min?: number; max?: number }): boolean {
  return (field.min === undefined || value >= field.min) && (field.max === undefined || value <= field.max);
}
