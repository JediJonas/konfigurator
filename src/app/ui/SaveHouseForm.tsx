import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useDesignStore } from '../state/designStore';
import type { ProjectMeta, ProjectStore } from '../storage/projectStore';
import { findHouseNamed, saveHouse } from '../storage/savedHouses';
import { uiStrings } from './strings.sv';

interface SaveHouseFormProps {
  store: ProjectStore;
  houses: readonly ProjectMeta[];
  onSaved: () => void;
}

/**
 * Sparar det öppna huset under ett namn. Namnet det senast sparades eller
 * öppnades under står kvar, så att Spara sparar över det efter en bekräftelse.
 */
export function SaveHouseForm({ store, houses, onSaved }: SaveHouseFormProps) {
  const design = useDesignStore((state) => state.design);
  const houseName = useDesignStore((state) => state.houseName);
  const setHouseName = useDesignStore((state) => state.setHouseName);
  const [replacing, setReplacing] = useState<string>();
  const [status, setStatus] = useState<string>();
  const nameId = useId();
  const name = houseName ?? '';
  const trimmed = name.trim();

  async function save() {
    setReplacing(undefined);
    try {
      const saved = await saveHouse(store, trimmed, design);
      setHouseName(saved.name);
      setStatus(uiStrings.houseSaved(saved.name));
      onSaved();
    } catch {
      setStatus(uiStrings.saveFailed);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) return;
    const existing = findHouseNamed(houses, trimmed);
    if (existing) setReplacing(existing.name);
    else void save();
  }

  return (
    <form className="save-house" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor={nameId}>{uiStrings.houseName}</label>
        <div className="save-house-row">
          <input
            id={nameId}
            type="text"
            value={name}
            placeholder={uiStrings.projectName}
            autoComplete="off"
            enterKeyHint="done"
            onChange={(event) => {
              setHouseName(event.target.value);
              setReplacing(undefined);
              setStatus(undefined);
            }}
          />
          <button type="submit" className="secondary-button" disabled={!trimmed}>
            {uiStrings.saveHouse}
          </button>
        </div>
      </div>
      {replacing ? (
        <div className="confirm-action" role="group" aria-label={uiStrings.saveHouse}>
          <p className="field-hint">{uiStrings.replaceHouseQuestion(replacing)}</p>
          <div className="confirm-action-buttons">
            <button type="button" className="secondary-button" onClick={() => void save()}>
              {uiStrings.confirmReplaceHouse(replacing)}
            </button>
            <button type="button" className="secondary-button" onClick={() => setReplacing(undefined)}>
              {uiStrings.cancel}
            </button>
          </div>
        </div>
      ) : null}
      <p className="field-hint" role="status">
        {status}
      </p>
    </form>
  );
}
