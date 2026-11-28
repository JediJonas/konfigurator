import { describe, expect, it } from 'vitest';
import { packDesign, unpackDesign } from '../../src/app/storage/compactDesign';
import { createHouseLink, readHouseLink } from '../../src/app/storage/houseLink';
import { useDesignStore } from '../../src/app/state/designStore';
import { evaluateDesign } from '../../src/core/rules/evaluateDesign';
import type { Design } from '../../src/core/model/design';
import { GINGERBREAD_DOMAIN_VERSION } from '../../src/domains/gingerbread/identity';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { simpleHousePreset } from '../../src/domains/gingerbread/presets/simpleHouse';

const PAGE_URL = 'https://example.org/konfigurator/';
/** En länk till ett hus med fönster, dörr, sektion, skorsten och takkupa ska rymmas i ett sms. */
const MAX_LINK_LENGTH = 400;

/** Mallens hus med fönster på tre väggar, en dörr, en sektion bredvid, en skorsten och en takkupa med fönster. */
function createFurnishedHouse(): Design {
  const store = useDesignStore;
  store.getState().replaceDesign(simpleHousePreset.create());
  const sockets = evaluateDesign(store.getState().design, gingerbreadDomain, (key) => key).placed.find((entry) => entry.instance.id === 'S1')?.sockets ?? [];
  const ofKind = (kind: string) => sockets.filter((socket) => socket.kind === kind).map((socket) => socket.id);
  const add = (socketId: string | undefined, objectTypeId: string) => store.getState().addChild({ parentId: 'S1', socketId: socketId ?? '', objectTypeId });
  const walls = ofKind('wall-surface');
  add(walls[0], 'gb.window');
  add(walls[1], 'gb.window');
  add(walls[1], 'gb.door');
  add(walls[2], 'gb.window');
  add(ofKind('wall-beside')[0], 'gb.section');
  add(ofKind('roof-surface')[0], 'gb.chimney');
  add(ofKind('roof-surface')[1], 'gb.dormer');
  return store.getState().design;
}

describe('länk till ett hus', () => {
  it('öppnar samma hus och namn från länken', async () => {
    const design = createFurnishedHouse();
    const link = await createHouseLink(PAGE_URL, design, gingerbreadDomain, 'Kyrkan');
    expect(link.startsWith(`${PAGE_URL}#hus=1.`)).toBe(true);
    const opened = await readHouseLink(new URL(link).hash, gingerbreadDomain);
    expect(opened?.name).toBe('Kyrkan');
    // Fält med standardvärdet står inte med i länken men ger samma delar.
    expect(evaluateDesign(opened?.design as Design, gingerbreadDomain, (key) => key).parts).toEqual(evaluateDesign(design, gingerbreadDomain, (key) => key).parts);
  });

  it('blir kort nog att skicka', async () => {
    const link = await createHouseLink(PAGE_URL, createFurnishedHouse(), gingerbreadDomain, 'Kyrkan');
    expect(link.length).toBeLessThan(MAX_LINK_LENGTH);
  });

  it('tar bort fält med standardvärdet men behåller ändrade', () => {
    const design = simpleHousePreset.create();
    const section = design.root.children[0];
    if (section) section.params = { width: 160, wallHeight: 100 };
    const unpacked = unpackDesign(JSON.parse(JSON.stringify(packDesign(design, gingerbreadDomain))), gingerbreadDomain);
    expect(unpacked.design.root.children[0]?.params).toEqual({ width: 160 });
    expect(unpacked.design.root.children[0]?.attachment).toEqual(section?.attachment);
    expect(unpacked.name).toBeUndefined();
  });

  it('öppnar en länk till ett hus från en äldre version i dagens format', async () => {
    const old = simpleHousePreset.create();
    old.domainVersion = 2;
    old.root.children[0]?.children.push({ id: 'D1', type: 'gb.door', params: { hinge: 'right' }, attachment: { socketId: 'gable-front', u: 0, v: 0, rotationDegrees: 0 }, children: [] });
    const link = await createHouseLink(PAGE_URL, old, gingerbreadDomain);
    const opened = await readHouseLink(new URL(link).hash, gingerbreadDomain);
    expect(opened?.design.domainVersion).toBe(GINGERBREAD_DOMAIN_VERSION);
    expect(opened?.design.root.children[0]?.children[0]?.params).toEqual({ kind: 'single' });
  });

  it('ger inget utan hus i adressen och kastar för en avklippt länk', async () => {
    expect(await readHouseLink('', gingerbreadDomain)).toBeUndefined();
    expect(await readHouseLink('#annat=1', gingerbreadDomain)).toBeUndefined();
    const link = await createHouseLink(PAGE_URL, simpleHousePreset.create(), gingerbreadDomain);
    await expect(readHouseLink(new URL(link).hash.slice(0, -8), gingerbreadDomain)).rejects.toThrow();
    await expect(readHouseLink('#hus=9.abc', gingerbreadDomain)).rejects.toThrow();
  });

  it('öppnar en länk med Spröjs från en äldre version som Fyra rutor', async () => {
    const old = simpleHousePreset.create();
    old.domainVersion = 3;
    old.root.children[0]?.children.push({ id: 'F1', type: 'gb.window', params: { mullions: 'cross' }, attachment: { socketId: 'side-right', u: 0, v: 0, rotationDegrees: 0 }, children: [] });
    const link = await createHouseLink(PAGE_URL, old, gingerbreadDomain);
    const opened = await readHouseLink(new URL(link).hash, gingerbreadDomain);
    expect(opened?.design.root.children[0]?.children[0]?.params).toEqual({ mullions: 'four' });
  });
});
