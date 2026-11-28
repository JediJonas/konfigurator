import { useEffect, useRef, useState } from 'react';
import { revealInPanel } from './scrollToHeading';
import { uiStrings } from './strings.sv';

interface ConfirmActionProps {
  /** Knappens text, t.ex. "Ta bort S2". */
  label: string;
  /** Vad som händer, visas ovanför knapparna. */
  question: string;
  /** Texten på knappen som gör det, t.ex. "Ja, ta bort S2". */
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
}

/**
 * En knapp som man får bekräfta i panelen innan något tas bort eller ersätts.
 * Knapparna rullas fram så att de syns, även längst ner i arket i mobilen.
 */
export function ConfirmAction({ label, question, confirmLabel, onConfirm, className = '' }: ConfirmActionProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isConfirming || !groupRef.current) return;
    // Fokus på Avbryt, så att knappen som försvann inte tar med sig fokus och Enter inte tar bort något.
    cancelRef.current?.focus({ preventScroll: true });
    revealInPanel(groupRef.current);
  }, [isConfirming]);
  if (!isConfirming) {
    return (
      <button type="button" className={`secondary-button ${className}`} onClick={() => setIsConfirming(true)}>
        {label}
      </button>
    );
  }
  return (
    <div ref={groupRef} className="confirm-action" role="group" aria-label={label}>
      <p className="field-hint">{question}</p>
      <div className="confirm-action-buttons">
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setIsConfirming(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
        <button ref={cancelRef} type="button" className="secondary-button" onClick={() => setIsConfirming(false)}>
          {uiStrings.cancel}
        </button>
      </div>
    </div>
  );
}
