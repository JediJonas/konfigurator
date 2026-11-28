import { describe, expect, it, vi } from 'vitest';
import { AUTOSAVE_DELAY_MS, createAutosave, loadSavedDesign, OPEN_PROJECT_ID } from '../../src/app/storage/autosave';
import { createLocalProjectStore } from '../../src/app/storage/localProjectStore';
import { createMemoryStorage } from './memoryStorage';
import { saveHouse } from '../../src/app/storage/savedHouses';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { simpleHousePreset } from '../../src/domains/gingerbread/presets/simpleHouse';

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
    const autosave = createAutosave(store, () => new Date('2026-11-27T10:00:00Z'));
    autosave.schedule({ design: simpleHousePreset.create(), name: '' });
    autosave.schedule({ design: houseWithWiderSection(), name: 'Mitt hus' });
    expect(await store.list()).toEqual([]);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    vi.useRealTimers();
    expect(await store.list()).toEqual([{ id: OPEN_PROJECT_ID, name: 'Mitt hus', domain: 'gingerbread', thumbnail: undefined, updatedAt: '2026-11-27T10:00:00.000Z' }]);
    expect(await loadSavedDesign(store, gingerbreadDomain)).toEqual({ design: houseWithWiderSection(), name: 'Mitt hus' });
  });

  it('sparar direkt när sidan göms', async () => {
    const store = createLocalProjectStore(createMemoryStorage());
    const autosave = createAutosave(store);
    autosave.schedule({ design: houseWithWiderSection(), name: 'Mitt hus' });
    autosave.flush();
    expect(await loadSavedDesign(store, gingerbreadDomain)).toEqual({ design: houseWithWiderSection(), name: 'Mitt hus' });
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

  it('öppnar det öppna huset, inte det senast sparade under ett namn', async () => {
    const store = createLocalProjectStore(createMemoryStorage());
    const autosave = createAutosave(store, () => new Date('2026-11-27T10:00:00Z'));
    autosave.schedule({ design: houseWithWiderSection(), name: '' });
    autosave.flush();
    await saveHouse(store, 'Kyrkan', simpleHousePreset.create(), new Date('2026-11-28T10:00:00Z'));
    expect(await loadSavedDesign(store, gingerbreadDomain)).toEqual({ design: houseWithWiderSection(), name: '' });
  });
});
