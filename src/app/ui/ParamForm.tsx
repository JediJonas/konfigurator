import { useId } from 'react';
import type { ParamField } from '../../core/model/paramForm';
import { isFieldVisible } from '../../core/model/paramForm';
import { translate } from '../activeDomain';
import { FieldGroup } from './FieldGroup';
import { NumberInput } from './NumberInput';

interface ParamFormProps {
  fields: ParamField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  /** Gruppen som är utfälld när panelen styr det, t.ex. taket man tryckte på i 3D-vyn. */
  openGroupKey?: string;
  /** Anges den styr panelen vilken grupp som är utfälld; annars fäller varje grupp ut sig själv. */
  onToggleGroup?: (groupKey: string) => void;
}

/**
 * Formulär som byggs från objekttypens parameterschema, så att nya objekttyper
 * inte kräver ny UI-kod. Fält med samma grupp visas under en egen rubrik som
 * är hopfälld från början, eftersom de sällan ändras (ägarens val). Fält som
 * bara gäller vissa val, t.ex. kantens höjd på ett platt tak, visas bara då.
 */
export function ParamForm({ fields, values, onChange, openGroupKey, onToggleGroup }: ParamFormProps) {
  const visible = fields.filter((field) => isFieldVisible(field, values, fields));
  return (
    <div className="param-form">
      {groupFields(visible).map((group) =>
        group.groupKey ? (
          <FieldGroup
            key={group.groupKey}
            label={translate(group.groupKey)}
            groupKey={group.groupKey}
            isOpen={onToggleGroup ? openGroupKey === group.groupKey : undefined}
            onToggle={onToggleGroup ? () => onToggleGroup(group.groupKey ?? '') : undefined}
          >
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
