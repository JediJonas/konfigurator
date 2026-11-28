import { activeDomain } from '../activeDomain';
import { useDesignStore } from '../state/designStore';
import { useHouseNotice } from '../state/houseNotice';
import { createAutosave, loadSavedDesign } from './autosave';
import { HOUSE_LINK_KEY, readHouseLink } from './houseLink';
import { createLocalProjectStore } from './localProjectStore';
import type { ProjectStore } from './projectStore';

/**
 * Öppnar det senast sparade huset och sparar sedan varje ändring av sig
 * själv, så att huset finns kvar när sidan laddas om, t.ex. när Safari laddar
 * om en flik som legat i bakgrunden. Utan lagring börjar appen med mallen.
 * Har adressen ett hus från en länk öppnas det ovanpå, så att Ångra tar tillbaka det förra.
 */
export async function openSavedProject(): Promise<void> {
  const store = findBrowserProjectStore();
  const saved = store ? await loadSavedDesign(store, activeDomain) : undefined;
  if (saved) useDesignStore.getState().replaceDesign(saved.design, saved.name);
  const isOpenedFromLink = await openHouseFromAddress();
  if (!store) return;
  const autosave = createAutosave(store);
  useDesignStore.subscribe((state, previous) => {
    if (state.design !== previous.design || state.houseName !== previous.houseName) autosave.schedule({ design: state.design, name: state.houseName ?? '' });
  });
  // Ett hus från en länk sparas direkt, som om man hade ändrat det.
  if (isOpenedFromLink) autosave.schedule({ design: useDesignStore.getState().design, name: useDesignStore.getState().houseName ?? '' });
  // Sidan kan stängas innan väntetiden har gått.
  window.addEventListener('pagehide', autosave.flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') autosave.flush();
  });
}

/** Byter till huset i adressens `#hus=` och tar bort det ur adressen, så att det inte öppnas igen när sidan laddas om. */
async function openHouseFromAddress(): Promise<boolean> {
  if (!new URLSearchParams(window.location.hash.replace(/^#/, '')).has(HOUSE_LINK_KEY)) return false;
  let isOpened = false;
  try {
    const linked = await readHouseLink(window.location.hash, activeDomain);
    if (linked) {
      useDesignStore.getState().openDesign(linked.design, linked.name, linked.view);
      useHouseNotice.getState().showNotice('linkOpened');
      isOpened = true;
    }
  } catch {
    useHouseNotice.getState().showNotice('linkFailed');
  }
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return isOpened;
}

/** Webbläsarens lagring av hus, om den går att använda; i privat läge kan den saknas. */
export function findBrowserProjectStore(): ProjectStore | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : createLocalProjectStore(localStorage);
  } catch {
    return undefined;
  }
}
