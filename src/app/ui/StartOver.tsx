import { useState } from 'react';
import { useDesignStore } from '../state/designStore';
import { uiStrings } from './strings.sv';

/**
 * Nollställer det sparade huset och börjar om med mallen. Man får bekräfta
 * i panelen först; efteråt går huset att få tillbaka med Ångra tills sidan laddas om.
 */
export function StartOver() {
  const resetDesign = useDesignStore((state) => state.resetDesign);
  const [isConfirming, setIsConfirming] = useState(false);
  if (!isConfirming) {
    return (
      <button type="button" className="secondary-button start-over" onClick={() => setIsConfirming(true)}>
        {uiStrings.startOver}
      </button>
    );
  }
  return (
    <div className="start-over-confirm" role="group" aria-label={uiStrings.startOver}>
      <p className="field-hint">{uiStrings.startOverQuestion}</p>
      <div className="start-over-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            resetDesign();
            setIsConfirming(false);
          }}
        >
          {uiStrings.confirmStartOver}
        </button>
        <button type="button" className="secondary-button" onClick={() => setIsConfirming(false)}>
          {uiStrings.cancel}
        </button>
      </div>
    </div>
  );
}
