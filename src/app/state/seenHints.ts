import { create } from 'zustand';

/** Hjälptexter som döljs när man har gjort det de beskriver en gång. */
export type HintId = 'view' | 'addFromView';

const HINT_STORAGE_PREFIX = 'konfigurator.hintSeen.';

/** Det lilla av webbläsarens lagring som behövs, så att det går att testa utan webbläsare. */
export type HintStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Läser om hjälptexten redan är använd. Går lagringen inte att läsa (t.ex. privat läge) visas texten. */
export function hasSeenHint(storage: HintStorage | undefined, hint: HintId): boolean {
  try {
    return storage?.getItem(HINT_STORAGE_PREFIX + hint) === '1';
  } catch {
    return false;
  }
}

/** Sparar att hjälptexten är använd. Misslyckas det döljs den ändå tills sidan laddas om. */
export function rememberSeenHint(storage: HintStorage | undefined, hint: HintId): void {
  try {
    storage?.setItem(HINT_STORAGE_PREFIX + hint, '1');
  } catch {
    // Lagringen kan vara avstängd eller full; då gäller det bara det här besöket.
  }
}

function findBrowserStorage(): HintStorage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

interface SeenHintsState {
  seen: Record<HintId, boolean>;
  markHintSeen: (hint: HintId) => void;
}

export const useSeenHints = create<SeenHintsState>((set, get) => {
  const storage = findBrowserStorage();
  return {
    seen: { view: hasSeenHint(storage, 'view'), addFromView: hasSeenHint(storage, 'addFromView') },
    markHintSeen: (hint) => {
      if (get().seen[hint]) return;
      rememberSeenHint(storage, hint);
      set((state) => ({ seen: { ...state.seen, [hint]: true } }));
    },
  };
});
