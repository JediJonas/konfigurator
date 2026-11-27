import type { ReactNode } from 'react';
import { useId, useState } from 'react';

interface FieldGroupProps {
  label: string;
  /** Rubriknivå: 2 för en egen sektion i panelen, 3 för en grupp inuti ett objekt. */
  headingLevel?: 2 | 3;
  children: ReactNode;
  /** Ändras nyckeln fälls gruppen ut, t.ex. när man trycker på taket i 3D-vyn. */
  revealKey?: string;
  groupKey?: string;
}

/**
 * Fält som sällan ändras under en rubrik som går att fälla ut. Hopfälld från
 * början (ägarens val), så att panelen visar det man oftast ändrar.
 */
export function FieldGroup({ label, headingLevel = 3, children, revealKey, groupKey }: FieldGroupProps) {
  const [isOpen, setIsOpen] = useState(revealKey !== undefined);
  const [knownRevealKey, setKnownRevealKey] = useState(revealKey);
  // Justeras direkt under ritningen, så att gruppen är utfälld när panelen rullar fram till den.
  if (revealKey !== knownRevealKey) {
    setKnownRevealKey(revealKey);
    if (revealKey !== undefined) setIsOpen(true);
  }
  const bodyId = useId();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const iconSize = headingLevel === 2 ? 20 : 18;
  return (
    <div className="field-group" data-group-key={groupKey}>
      <Heading>
        <button type="button" className="disclosure" aria-expanded={isOpen} aria-controls={bodyId} onClick={() => setIsOpen(!isOpen)}>
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
