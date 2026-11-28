import { useEffect } from 'react';
import { useDesignStore } from '../state/designStore';
import { isTextEntry, readHistoryShortcut } from './historyShortcut';
import { uiStrings } from './strings.sv';

/** Ångra och Gör om i 3D-vyns hörn bredvid Centrera, och samma sak med kortkommandon på dator. */
export function HistoryButtons() {
  const canUndo = useDesignStore((state) => state.history.past.length > 0);
  const canRedo = useDesignStore((state) => state.history.future.length > 0);
  const undo = useDesignStore((state) => state.undo);
  const redo = useDesignStore((state) => state.redo);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = readHistoryShortcut(event);
      // I ett fält ångrar webbläsaren det man skriver; huset ångras när fältet inte har fokus.
      if (!action || isTextEntry(event.target)) return;
      event.preventDefault();
      if (action === 'undo') undo();
      else redo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  return (
    <>
      <button type="button" className="view-button" onClick={undo} disabled={!canUndo} aria-label={uiStrings.undo} title={uiStrings.undoHint}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
          <path d="M9 14 4 9l5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <button type="button" className="view-button" onClick={redo} disabled={!canRedo} aria-label={uiStrings.redo} title={uiStrings.redoHint}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
          <path d="m15 14 5-5-5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </>
  );
}
