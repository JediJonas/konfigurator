import { useState } from 'react';
import { activeDomain } from '../activeDomain';
import { useDesignStore } from '../state/designStore';
import { findHouseNamed, openHouse, renameHouse } from '../storage/savedHouses';
import type { ProjectMeta } from '../storage/projectStore';
import { FieldGroup } from './FieldGroup';
import { SavedHouseItem } from './SavedHouseItem';
import { SaveHouseForm } from './SaveHouseForm';
import { ShareHouseLink } from './ShareHouseLink';
import { uiStrings } from './strings.sv';
import { useSavedHouses } from './useSavedHouses';

/**
 * Mina hus: spara det öppna huset under ett namn, öppna, byt namn på och ta
 * bort sparade hus, och dela huset med en länk. Husen sparas i webbläsaren.
 */
export function SavedHouses({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const { store, houses, reload } = useSavedHouses();
  const openDesign = useDesignStore((state) => state.openDesign);
  const [status, setStatus] = useState<string>();

  async function handleOpen(house: ProjectMeta) {
    if (!store) return;
    try {
      const opened = await openHouse(store, house.id, activeDomain);
      openDesign(opened.design, opened.name);
      setStatus(uiStrings.houseOpened(opened.name));
    } catch {
      setStatus(uiStrings.openFailed(house.name));
    }
  }

  async function handleRename(house: ProjectMeta, name: string): Promise<string | undefined> {
    if (!store) return uiStrings.saveFailed;
    const taken = findHouseNamed(houses, name);
    if (taken && taken.id !== house.id) return uiStrings.nameTaken(taken.name);
    try {
      await renameHouse(store, house.id, name);
    } catch {
      return uiStrings.saveFailed;
    }
    // Är det huset som är öppet byts namnet även där, så att Spara sparar under det nya namnet.
    const { houseName, setHouseName } = useDesignStore.getState();
    if (houseName !== undefined && findHouseNamed([house], houseName)) setHouseName(name.trim());
    await reload();
    return undefined;
  }

  async function handleRemove(house: ProjectMeta) {
    await store?.remove(house.id).catch(() => undefined);
    setStatus(undefined);
    await reload();
  }

  return (
    <section className="panel-section">
      <FieldGroup label={uiStrings.savedHouses} headingLevel={2} isOpen={isOpen} onToggle={onToggle}>
        {store ? (
          <>
            <SaveHouseForm store={store} houses={houses} onSaved={() => void reload()} />
            {houses.length > 0 ? (
              <ul className="saved-houses" aria-label={uiStrings.savedHouseList}>
                {houses.map((house) => (
                  <SavedHouseItem key={house.id} house={house} onOpen={() => void handleOpen(house)} onRename={(name) => handleRename(house, name)} onRemove={() => void handleRemove(house)} />
                ))}
              </ul>
            ) : (
              <p className="field-hint">{uiStrings.noSavedHouses}</p>
            )}
            <p className="field-hint" role="status">
              {status}
            </p>
          </>
        ) : (
          <p className="field-hint">{uiStrings.saveFailed}</p>
        )}
        <ShareHouseLink />
      </FieldGroup>
    </section>
  );
}
