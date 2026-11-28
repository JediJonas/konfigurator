import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import type { ProjectMeta } from '../storage/projectStore';
import { ConfirmAction } from './ConfirmAction';
import { uiStrings } from './strings.sv';

interface SavedHouseItemProps {
  house: ProjectMeta;
  /** Ger ett felmeddelande om namnet inte går att använda, annars byts namnet. */
  onRename: (name: string) => Promise<string | undefined>;
  onOpen: () => void;
  onRemove: () => void;
}

const CHANGED_AT_FORMAT = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Ett sparat hus i listan, med Öppna, Byt namn och Ta bort. */
export function SavedHouseItem({ house, onRename, onOpen, onRemove }: SavedHouseItemProps) {
  const [draftName, setDraftName] = useState<string>();
  const [renameError, setRenameError] = useState<string>();
  const nameId = useId();

  async function handleRename(event: FormEvent) {
    event.preventDefault();
    if (!draftName?.trim()) return;
    const error = await onRename(draftName);
    setRenameError(error);
    if (!error) setDraftName(undefined);
  }

  return (
    <li className="saved-house">
      <div className="saved-house-heading">
        <span className="saved-house-name">{house.name}</span>
        <span className="field-hint">{uiStrings.changedAt(CHANGED_AT_FORMAT.format(new Date(house.updatedAt)))}</span>
      </div>
      {draftName === undefined ? (
        <div className="saved-house-actions">
          <button type="button" className="secondary-button" aria-label={uiStrings.openHouseLabel(house.name)} onClick={onOpen}>
            {uiStrings.openHouse}
          </button>
          <button type="button" className="secondary-button" aria-label={uiStrings.renameHouseLabel(house.name)} onClick={() => setDraftName(house.name)}>
            {uiStrings.renameHouse}
          </button>
          <ConfirmAction label={uiStrings.removeHouse(house.name)} question={uiStrings.removeHouseQuestion(house.name)} confirmLabel={uiStrings.confirmRemoveHouse(house.name)} onConfirm={onRemove} />
        </div>
      ) : (
        <form className="field" onSubmit={(event) => void handleRename(event)}>
          <label htmlFor={nameId}>{uiStrings.newName}</label>
          <div className="save-house-row">
            <input
              id={nameId}
              type="text"
              value={draftName}
              autoComplete="off"
              enterKeyHint="done"
              autoFocus
              aria-invalid={renameError ? true : undefined}
              onChange={(event) => {
                setDraftName(event.target.value);
                setRenameError(undefined);
              }}
            />
            <button type="submit" className="secondary-button" disabled={!draftName.trim()}>
              {uiStrings.saveHouse}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setDraftName(undefined);
                setRenameError(undefined);
              }}
            >
              {uiStrings.cancel}
            </button>
          </div>
          {renameError ? (
            <p className="field-error" role="alert">
              {renameError}
            </p>
          ) : null}
        </form>
      )}
    </li>
  );
}
