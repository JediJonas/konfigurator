import { create } from 'zustand';

/** Det lilla av webbläsarens lagring som behövs, så att det går att testa utan webbläsare. */
export type ViewSettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

const EDGE_BEAD_STORAGE_KEY = 'konfigurator.showEdgeBead';

/** Läser om randen längs ytterkanterna ska visas. På från början (ägarens önskan) och när lagringen inte går att läsa; ett val som sparats gäller. */
export function readShowEdgeBead(storage: ViewSettingsStorage | undefined): boolean {
  try {
    return storage?.getItem(EDGE_BEAD_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

/** Sparar valet. Misslyckas det gäller det bara tills sidan laddas om. */
export function rememberShowEdgeBead(storage: ViewSettingsStorage | undefined, isShown: boolean): void {
  try {
    storage?.setItem(EDGE_BEAD_STORAGE_KEY, isShown ? '1' : '0');
  } catch {
    // Lagringen kan vara avstängd eller full.
  }
}

function findBrowserStorage(): ViewSettingsStorage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

interface ViewSettingsState {
  /** Visa randen längs ytterkanterna i 3D-vyn, t.ex. kristyr. Gäller vyn, inte huset, så den sparas i webbläsaren och inte med huset. */
  isEdgeBeadShown: boolean;
  setEdgeBeadShown: (isShown: boolean) => void;
}

export const useViewSettings = create<ViewSettingsState>((set) => {
  const storage = findBrowserStorage();
  return {
    isEdgeBeadShown: readShowEdgeBead(storage),
    setEdgeBeadShown: (isShown) => {
      rememberShowEdgeBead(storage, isShown);
      set({ isEdgeBeadShown: isShown });
    },
  };
});
