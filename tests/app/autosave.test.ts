import { describe, expect, it, vi } from 'vitest';
import { AUTOSAVE_DELAY_MS, createAutosave, loadSavedDesign, OPEN_PROJECT_ID } from '../../src/app/storage/autosave';
import type { KeyValueStorage } from '../../src/app/storage/localProjectStore';
import { createLocalProjectStore } from '../../src/app/storage/localProjectStore';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { simpleHousePreset } from '../../src/domains/gingerbread/presets/simpleHouse';

function createMemoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function houseWithWiderSection() {
  const design = simpleHousePreset.create();
  const section = design.root.children[0];
  if (section) section.params = { width: 160 };
  return design;
}

describe('autospar', () => {
  it('sparar designen en stund efter senaste ändringen och öppnar den igen', async () => {
    vi.useFakeTimers();
    const storage = createMemoryStorage();
    const store = createLocalProjectStore(storage);
    const autosave = createAutosave(store, 'Mitt hus', () => new Date('2026-11-27T10:00:00Z'));
    autosave.schedule(simpleHousePreset.create());
    autosave.schedule(houseWithWiderSection());
    expect(await store.list()).toEqual([]);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    vi.useRealTimers();
    expect(await store.list()).toEqual([{ id: OPEN_PROJECT_ID, name: 'Mitt hus', domain: 'gingerbread', thumbnail: undefined, updatedAt: '2026-11-27T10:00:00.000Z' }]);
    expect(await loadSavedDesign(store, gingerbreadDomain)).toEqual(houseWithWiderSection());
  });

  it('sparar direkt när sidan göms', async () => {
    const store = createLocalProjectStore(createMemoryStorage());
    const autosave = createAutosave(store, 'Mitt hus');
    autosave.schedule(houseWithWiderSection());
    autosave.flush();
    expect(await loadSavedDesign(store, gingerbreadDomain)).toEqual(houseWithWiderSection());
  });

  it('börjar med mallen när det sparade inte går att öppna', async () => {
    const storage = createMemoryStorage();
    const store = createLocalProjectStore(storage);
    expect(await loadSavedDesign(store, gingerbreadDomain)).toBeUndefined();
    storage.setItem('konfigurator.project.open', '{inte json');
    expect(await loadSavedDesign(store, gingerbreadDomain)).toBeUndefined();
    const broken = houseWithWiderSection();
    if (broken.root.children[0]) broken.root.children[0].params = { width: 'bred' };
    await store.save({ id: OPEN_PROJECT_ID, name: 'Mitt hus', domain: 'gingerbread', updatedAt: '2026-11-27T10:00:00Z', design: broken });
    expect(await loadSavedDesign(store, gingerbreadDomain)).toBeUndefined();
  });
});
