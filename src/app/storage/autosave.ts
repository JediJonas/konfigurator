import type { Design } from '../../core/model/design';
import type { Domain } from '../../core/model/domain';
import { migrateDesign } from '../../core/model/migrateDesign';
import { evaluateDesign } from '../../core/rules/evaluateDesign';
import type { ProjectStore } from './projectStore';

/** Det öppna projektet sparas under det här id:t tills man kan ha flera projekt. */
export const OPEN_PROJECT_ID = 'open';
/** Så länge efter senaste ändringen som projektet sparas, så att varje steg i ett fält inte sparas för sig. */
export const AUTOSAVE_DELAY_MS = 400;

/**
 * Senast sparade designen för domänen, om den går att öppna. En design som
 * inte går att migrera eller räkna, t.ex. efter en ändring i appen, hoppas över
 * så att appen startar med mallen i stället för att fastna.
 */
export async function loadSavedDesign(store: ProjectStore, domain: Domain): Promise<Design | undefined> {
  try {
    const latest = (await store.list()).find((meta) => meta.domain === domain.id);
    if (!latest) return undefined;
    const design = migrateDesign((await store.load(latest.id)).design);
    evaluateDesign(design, domain, (key) => key);
    return design;
  } catch {
    return undefined;
  }
}

export interface Autosave {
  /** Sparar designen när den inte har ändrats på `AUTOSAVE_DELAY_MS`. */
  schedule(design: Design): void;
  /** Sparar det som väntar direkt, t.ex. när sidan göms. */
  flush(): void;
}

export function createAutosave(store: ProjectStore, name: string, now: () => Date = () => new Date()): Autosave {
  let pending: Design | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const design = pending;
    pending = undefined;
    // Går det inte att spara, t.ex. i privat läge, fortsätter appen utan.
    if (design) void store.save({ id: OPEN_PROJECT_ID, name, domain: design.domain, updatedAt: now().toISOString(), design }).catch(() => undefined);
  };
  return {
    schedule: (design) => {
      pending = design;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, AUTOSAVE_DELAY_MS);
    },
    flush,
  };
}
