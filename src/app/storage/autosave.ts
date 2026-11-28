import type { Design } from '../../core/model/design';
import type { Domain } from '../../core/model/domain';
import type { ProjectStore } from './projectStore';
import { readStoredDesign } from './storedDesign';

/** Det öppna huset sparas av sig självt under det här id:t, skilt från husen man sparar under ett namn. */
export const OPEN_PROJECT_ID = 'open';
/** Så länge efter senaste ändringen som projektet sparas, så att varje steg i ett fält inte sparas för sig. */
export const AUTOSAVE_DELAY_MS = 400;

/** Det öppna huset och namnet det senast sparades eller öppnades under. */
export interface OpenHouse {
  design: Design;
  name: string;
}

/**
 * Det öppna huset från förra gången, om det går att öppna. En design som
 * inte går att migrera eller räkna, t.ex. efter en ändring i appen, hoppas över
 * så att appen startar med mallen i stället för att fastna.
 */
export async function loadSavedDesign(store: ProjectStore, domain: Domain): Promise<OpenHouse | undefined> {
  try {
    const project = await store.load(OPEN_PROJECT_ID);
    if (project.domain !== domain.id) return undefined;
    return { design: readStoredDesign(project.design, domain), name: project.name };
  } catch {
    return undefined;
  }
}

export interface Autosave {
  /** Sparar huset när det inte har ändrats på `AUTOSAVE_DELAY_MS`. */
  schedule(house: OpenHouse): void;
  /** Sparar det som väntar direkt, t.ex. när sidan göms. */
  flush(): void;
}

export function createAutosave(store: ProjectStore, now: () => Date = () => new Date()): Autosave {
  let pending: OpenHouse | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const house = pending;
    pending = undefined;
    // Går det inte att spara, t.ex. i privat läge, fortsätter appen utan.
    if (house) void store.save({ id: OPEN_PROJECT_ID, name: house.name, domain: house.design.domain, updatedAt: now().toISOString(), design: house.design }).catch(() => undefined);
  };
  return {
    schedule: (house) => {
      pending = house;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, AUTOSAVE_DELAY_MS);
    },
    flush,
  };
}
