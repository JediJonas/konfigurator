import { describe, expect, it } from 'vitest';
import { placeInstances } from '../../src/core/pipeline/placeInstances';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { findOutermostNested, groupPanelEntries, listOpenChain } from '../../src/app/ui/panelEntries';
import { findChosenGroupSocket, groupKeyOfPlace, listGroupSockets, listPanelWalls } from '../../src/app/ui/panelWalls';
import { findSocketOwnedBy } from '../../src/app/ui/socketSelection';
import { designWithExtensions } from '../domains/extensionFixtures';
import { dormerOn } from '../domains/dormerFixtures';
import { windowOn } from '../domains/openingFixtures';

describe('takkupor under Tak i panelen', () => {
  const design = designWithExtensions(windowOn('side-right'), dormerOn('roof-left'));
  const placed = placeInstances(design, gingerbreadDomain);
  const [house] = groupPanelEntries(placed);

  it('samlar kupan under sektionen, inte som en egen sektion', () => {
    expect(groupPanelEntries(placed).map((entry) => entry.entry.instance.id)).toEqual(['S1']);
    expect(house?.nested.map((child) => child.instance.id)).toEqual(['F1', 'K1']);
  });

  it('visar takfallen under takets grupp och inte som väggar', () => {
    if (!house) throw new Error('S1 saknas');
    expect(listPanelWalls(house.entry, house.nested).map((wall) => wall.socket.labelKey)).toEqual(['socket.wall1', 'socket.wall2', 'socket.wall3', 'socket.wall4']);
    const group = listGroupSockets(house.entry, house.nested, 'group.roof');
    expect(group.sockets.map((socket) => socket.labelKey)).toEqual(['socket.roofToward2', 'socket.roofToward4']);
    expect(group.nested.map((child) => child.instance.id)).toEqual(['K1']);
  });

  it('fäller ut taket runt en öppen kupa och väggen runt ett öppet fönster', () => {
    const byId = (id: string) => placed.find((entry) => entry.instance.id === id);
    expect(groupKeyOfPlace(byId('K1') ?? placed[0]!)).toBe('group.roof');
    expect(groupKeyOfPlace(byId('F1') ?? placed[0]!)).toBeUndefined();
  });

  it('lägger till på det valda takfallet, och annars på det första', () => {
    if (!house) throw new Error('S1 saknas');
    const { sockets } = listGroupSockets(house.entry, house.nested, 'group.roof');
    expect(findChosenGroupSocket(sockets, 'S1', undefined)?.labelKey).toBe('socket.roofToward2');
    expect(findChosenGroupSocket(sockets, 'S1', { instanceId: 'S1', socketId: 'roof-left' })?.id).toBe('roof-left');
    // Ett takfall som hör till en annan sektion eller inte längre finns gäller inte.
    expect(findChosenGroupSocket(sockets, 'S1', { instanceId: 'S2', socketId: 'roof-left' })?.labelKey).toBe('socket.roofToward2');
    expect(findChosenGroupSocket(sockets, 'S1', { instanceId: 'S1', socketId: 'roof-lower-left' })?.labelKey).toBe('socket.roofToward2');
    expect(findChosenGroupSocket([], 'S1', undefined)).toBeUndefined();
  });

  it('väljer ingen vägg när man trycker på taket, så att takets grupp öppnas', () => {
    expect(findSocketOwnedBy(placed, 'S1/roof-left')).toBeUndefined();
    expect(findSocketOwnedBy(placed, 'S1/side-right')).toEqual({ instanceId: 'S1', socketId: 'side-right' });
  });
});

describe('fönster i en takkupa i panelen', () => {
  const dormerWindow = { ...windowOn('gable-front'), id: 'F2', params: { width: 15, height: 15, sillHeight: 5 } };
  const design = designWithExtensions({ ...dormerOn('roof-left'), children: [dormerWindow] });
  const placed = placeInstances(design, gingerbreadDomain);
  const byId = (id: string) => placed.find((entry) => entry.instance.id === id) ?? placed[0]!;

  it('samlar kupan och fönstret i den under sektionen', () => {
    const entries = groupPanelEntries(placed);
    expect(entries.map((entry) => entry.entry.instance.id)).toEqual(['S1']);
    expect(entries[0]?.nested.map((child) => child.instance.id)).toEqual(['K1', 'F2']);
  });

  it('fäller ut taket och kupan runt ett öppet fönster i kupan', () => {
    expect(findOutermostNested(placed, byId('F2')).instance.id).toBe('K1');
    expect([...listOpenChain(placed, 'F2')].sort()).toEqual(['F2', 'K1']);
    expect([...listOpenChain(placed, 'S1')]).toEqual(['S1']);
  });
});
