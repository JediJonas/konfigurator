import { describe, expect, it } from 'vitest';
import { createAutosave } from '../../src/app/storage/autosave';
import { createLocalProjectStore } from '../../src/app/storage/localProjectStore';
import { findHouseNamed, listSavedHouses, openHouse, renameHouse, saveHouse } from '../../src/app/storage/savedHouses';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { simpleHousePreset } from '../../src/domains/gingerbread/presets/simpleHouse';
import { createMemoryStorage } from './memoryStorage';

function houseWithWidth(width: number) {
  const design = simpleHousePreset.create();
  const section = design.root.children[0];
  if (section) section.params = { width };
  return design;
}

describe('sparade hus', () => {
  it('sparar flera hus under namn, senast ändrat först, utan det öppna huset', async () => {
    const store = createLocalProjectStore(createMemoryStorage());
    const autosave = createAutosave(store);
    autosave.schedule({ design: houseWithWidth(150), name: '' });
    autosave.flush();
    await saveHouse(store, 'Kyrkan', houseWithWidth(160), new Date('2026-11-28T10:00:00Z'));
    await saveHouse(store, ' Borgen ', houseWithWidth(170), new Date('2026-11-28T11:00:00Z'));
    const houses = await listSavedHouses(store, gingerbreadDomain.id);
    expect(houses.map((house) => house.name)).toEqual(['Borgen', 'Kyrkan']);
    expect(await openHouse(store, houses[1]?.id ?? '', gingerbreadDomain)).toEqual({ design: houseWithWidth(160), name: 'Kyrkan' });
  });

  it('ersätter huset med samma namn, oavsett stora och små bokstäver', async () => {
    const store = createLocalProjectStore(createMemoryStorage());
    const first = await saveHouse(store, 'Kyrkan', houseWithWidth(160), new Date('2026-11-28T10:00:00Z'));
    const second = await saveHouse(store, 'kyrkan', houseWithWidth(180), new Date('2026-11-28T11:00:00Z'));
    expect(second.id).toBe(first.id);
    const houses = await listSavedHouses(store, gingerbreadDomain.id);
    expect(houses).toHaveLength(1);
    expect(findHouseNamed(houses, ' KYRKAN ')?.id).toBe(first.id);
    expect((await openHouse(store, first.id, gingerbreadDomain)).design).toEqual(houseWithWidth(180));
  });

  it('byter namn utan att ändra tiden', async () => {
    const store = createLocalProjectStore(createMemoryStorage());
    const saved = await saveHouse(store, 'Kyrkan', houseWithWidth(160), new Date('2026-11-28T10:00:00Z'));
    await renameHouse(store, saved.id, 'Kapellet ');
    expect(await listSavedHouses(store, gingerbreadDomain.id)).toEqual([{ ...saved, name: 'Kapellet', thumbnail: undefined }]);
  });

  it('öppnar ett hus från en äldre version i dagens format', async () => {
    const store = createLocalProjectStore(createMemoryStorage());
    const old = simpleHousePreset.create();
    old.domainVersion = 2;
    old.root.children[0]?.children.push({ id: 'D1', type: 'gb.door', params: { hinge: 'left', openAngle: 30 }, attachment: { socketId: 'gable-front', u: 0, v: 0, rotationDegrees: 0 }, children: [] });
    const saved = await saveHouse(store, 'Gamla huset', old);
    const opened = await openHouse(store, saved.id, gingerbreadDomain);
    expect(opened.design.root.children[0]?.children[0]?.params).toEqual({ kind: 'single' });
  });

  it('kastar för ett hus som inte går att öppna', async () => {
    const store = createLocalProjectStore(createMemoryStorage());
    const broken = houseWithWidth(160);
    broken.version = 99;
    const saved = await saveHouse(store, 'Framtiden', broken);
    await expect(openHouse(store, saved.id, gingerbreadDomain)).rejects.toThrow();
  });
});
