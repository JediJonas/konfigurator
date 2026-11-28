import type { Design } from '../../core/model/design';

/** Så många steg bakåt som sparas; äldre steg glöms. */
export const MAX_UNDO_STEPS = 100;
/**
 * Ändringar av samma sak (samma fält på samma objekt) som kommer tätare än så blir ett
 * enda steg att ångra, så att t.ex. tio snabba tryck på + eller ett tal man skriver
 * ångras med ett tryck.
 */
export const MERGE_WINDOW_MS = 1000;

/** Designerna före och efter den öppna, för Ångra och Gör om. Gäller bara medan sidan är öppen. */
export interface DesignHistory {
  /** Äldst först; den sista är den som Ångra går tillbaka till. */
  past: Design[];
  /** Närmast först; den första är den som Gör om går fram till. */
  future: Design[];
  /** Vad som ändrades senast, så att nästa ändring av samma sak kan slås ihop med den. */
  lastChangeKey?: string;
  lastChangeAt: number;
}

/** En ändring av designen. `mergeKey` anger vad som ändras, t.ex. ett fält på ett objekt; utan den blir ändringen alltid ett eget steg. */
export interface DesignChange {
  mergeKey?: string;
  at: number;
}

export const EMPTY_HISTORY: DesignHistory = { past: [], future: [], lastChangeAt: 0 };

/** Lägger designen före ändringen i historiken, eller slår ihop ändringen med den förra av samma sak. */
export function recordChange(history: DesignHistory, previous: Design, next: Design, change: DesignChange): DesignHistory {
  if (next === previous) return history;
  const isSameChange =
    change.mergeKey !== undefined &&
    change.mergeKey === history.lastChangeKey &&
    change.at - history.lastChangeAt < MERGE_WINDOW_MS &&
    history.future.length === 0 &&
    history.past.length > 0;
  if (isSameChange) return { ...history, lastChangeAt: change.at };
  return {
    past: [...history.past, previous].slice(-MAX_UNDO_STEPS),
    future: [],
    lastChangeKey: change.mergeKey,
    lastChangeAt: change.at,
  };
}

/** Går ett steg bakåt. Ger inget när det inte finns något att ångra. */
export function undoChange(history: DesignHistory, current: Design): { history: DesignHistory; design: Design } | undefined {
  const design = history.past.at(-1);
  if (!design) return undefined;
  return { design, history: { past: history.past.slice(0, -1), future: [current, ...history.future], lastChangeAt: 0 } };
}

/** Går ett steg framåt igen efter Ångra. Ger inget när det inte finns något att göra om. */
export function redoChange(history: DesignHistory, current: Design): { history: DesignHistory; design: Design } | undefined {
  const design = history.future[0];
  if (!design) return undefined;
  return { design, history: { past: [...history.past, current].slice(-MAX_UNDO_STEPS), future: history.future.slice(1), lastChangeAt: 0 } };
}
