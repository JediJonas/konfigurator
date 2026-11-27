import { describe, expect, it } from 'vitest';
import { placeInstances } from '../../src/core/pipeline/placeInstances';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { groupPanelEntries } from '../../src/app/ui/panelEntries';
import { groupKeyOfPlace, listGroupSockets, listPanelWalls } from '../../src/app/ui/panelWalls';
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

  it('väljer ingen vägg när man trycker på taket, så att takets grupp öppnas', () => {
    expect(findSocketOwnedBy(placed, 'S1/roof-left')).toBeUndefined();
    expect(findSocketOwnedBy(placed, 'S1/side-right')).toEqual({ instanceId: 'S1', socketId: 'side-right' });
  });
});
