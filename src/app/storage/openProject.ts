import { activeDomain } from '../activeDomain';
import { useDesignStore } from '../state/designStore';
import { uiStrings } from '../ui/strings.sv';
import { createAutosave, loadSavedDesign } from './autosave';
import { createLocalProjectStore } from './localProjectStore';
import type { ProjectStore } from './projectStore';

/**
 * Öppnar det senast sparade huset och sparar sedan varje ändring av sig
 * själv, så att huset finns kvar när sidan laddas om, t.ex. när Safari laddar
 * om en flik som legat i bakgrunden. Utan lagring börjar appen med mallen.
 */
export async function openSavedProject(): Promise<void> {
  const store = findBrowserProjectStore();
  if (!store) return;
  const saved = await loadSavedDesign(store, activeDomain);
  if (saved) useDesignStore.getState().replaceDesign(saved);
  const autosave = createAutosave(store, uiStrings.projectName);
  useDesignStore.subscribe((state, previous) => {
    if (state.design !== previous.design) autosave.schedule(state.design);
  });
  // Sidan kan stängas innan väntetiden har gått.
  window.addEventListener('pagehide', autosave.flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') autosave.flush();
  });
}

function findBrowserProjectStore(): ProjectStore | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : createLocalProjectStore(localStorage);
  } catch {
    return undefined;
  }
}
