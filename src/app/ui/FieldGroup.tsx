import type { ReactNode } from 'react';
import { useId, useState } from 'react';

interface FieldGroupProps {
  label: string;
  /** Rubriknivå: 2 för en egen sektion i panelen, 3 för en grupp inuti ett objekt. */
  headingLevel?: 2 | 3;
  children: ReactNode;
  /** Nyckeln som panelen hittar gruppen med, t.ex. för att rulla fram till taket. */
  groupKey?: string;
  /** Styr panelen vad som är utfällt (en sak i taget) anges läget här; annars fäller gruppen ut sig själv. */
  isOpen?: boolean;
  onToggle?: () => void;
}

/**
 * Fält under en rubrik som går att fälla ut. Hopfälld från början (ägarens
 * val), så att panelen visar det man oftast ändrar.
 */
export function FieldGroup({ label, headingLevel = 3, children, groupKey, isOpen: controlledIsOpen, onToggle }: FieldGroupProps) {
  const [ownIsOpen, setOwnIsOpen] = useState(false);
  const isOpen = controlledIsOpen ?? ownIsOpen;
  const bodyId = useId();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const iconSize = headingLevel === 2 ? 20 : 18;
  return (
    <div className="field-group" data-group-key={groupKey}>
      <Heading>
        <button type="button" className="disclosure" aria-expanded={isOpen} aria-controls={bodyId} onClick={() => (onToggle ? onToggle() : setOwnIsOpen(!isOpen))}>
          <svg className="disclosure-icon" aria-hidden="true" viewBox="0 0 24 24" width={iconSize} height={iconSize}>
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {label}
        </button>
      </Heading>
      {isOpen ? (
        <div id={bodyId} className="param-form">
          {children}
        </div>
      ) : null}
    </div>
  );
}
