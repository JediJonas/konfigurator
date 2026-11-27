import { useState } from 'react';
import type { ParamField } from '../../core/model/paramForm';
import { canStep, findGap, stepNumber } from './stepNumber';
import type { StepDirection } from './stepNumber';
import { uiStrings } from './strings.sv';

interface NumberInputProps {
  id: string;
  label: string;
  field: Extract<ParamField, { kind: 'number' }>;
  value: number;
  onChange: (value: number) => void;
}

/**
 * Ett måttfält med − och + på var sida om värdet, likadant på dator och i
 * mobilen (ägarens val), eftersom webbläsarens egna pilar är små och saknas
 * på pekskärm. Det man skriver behålls lokalt och bara giltiga värden skickas
 * vidare, så att man kan sudda och skriva om ett tal utan att huset hoppar.
 * Ett värde i ett glapp där inget går att bygga räknas inte som giltigt.
 */
export function NumberInput({ id, label, field, value, onChange }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const errorId = `${id}-error`;
  const labelId = `${id}-label`;
  const text = draft ?? String(value);
  const typed = parseTypedNumber(text);
  const gap = typed === null ? undefined : findGap(typed, field.gaps);
  const isValid = typed !== null && isInRange(typed, field) && !gap;
  const limits = { min: field.min, max: field.max, step: field.meta.step, gaps: field.gaps };
  const current = isValid ? typed : value;

  function step(direction: StepDirection) {
    setDraft(null);
    onChange(stepNumber(current, direction, limits));
  }

  return (
    <div className="field">
      <label id={labelId} htmlFor={id}>
        {label}
        {field.meta.unit ? <span className="unit"> ({field.meta.unit})</span> : null}
      </label>
      <div className="stepper">
        <StepButton direction={-1} isEnabled={canStep(current, -1, limits)} labelId={labelId} onStep={step} />
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
            const next = parseTypedNumber(event.target.value);
            if (next !== null && isInRange(next, field) && !findGap(next, field.gaps)) onChange(next);
          }}
          onBlur={() => setDraft(null)}
        />
        <StepButton direction={1} isEnabled={canStep(current, 1, limits)} labelId={labelId} onStep={step} />
      </div>
      {isValid ? null : (
        <p className="field-error" id={errorId}>
          {gap ? uiStrings.inGap(gap.after, gap.before) : uiStrings.outOfRange(field.min, field.max)}
        </p>
      )}
    </div>
  );
}

interface StepButtonProps {
  direction: StepDirection;
  isEnabled: boolean;
  labelId: string;
  onStep: (direction: StepDirection) => void;
}

/**
 * Knappen heter bara "Minska" eller "Öka" och får fältets namn som
 * beskrivning, så att fältets etikett pekar ut ett enda element. Den ligger
 * utanför tabbordningen eftersom piltangenterna i fältet gör samma sak.
 */
function StepButton({ direction, isEnabled, labelId, onStep }: StepButtonProps) {
  const isIncrease = direction > 0;
  return (
    <button
      type="button"
      className="step-button"
      tabIndex={-1}
      aria-label={isIncrease ? uiStrings.increase : uiStrings.decrease}
      aria-describedby={labelId}
      disabled={!isEnabled}
      onClick={() => onStep(direction)}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
        <path d={isIncrease ? 'M5 12h14M12 5v14' : 'M5 12h14'} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** Talet i fältet, med komma eller punkt, eller null när det inte är ett tal. */
function parseTypedNumber(text: string): number | null {
  if (text.trim() === '') return null;
  const parsed = Number(text.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function isInRange(value: number, field: { min?: number; max?: number }): boolean {
  return (field.min === undefined || value >= field.min) && (field.max === undefined || value <= field.max);
}
