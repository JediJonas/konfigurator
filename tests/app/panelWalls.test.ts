import { describe, expect, it } from 'vitest';
import { describeParams } from '../../src/core/model/paramForm';
import { placeInstances } from '../../src/core/pipeline/placeInstances';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { sectionType } from '../../src/domains/gingerbread/objects/section';
import { groupPanelEntries } from '../../src/app/ui/panelEntries';
import { findOwnerPartId, listPanelWalls, listPartFields } from '../../src/app/ui/panelWalls';
import { designWithExtensions, extension } from '../domains/extensionFixtures';
import { doorOn, windowOn } from '../domains/openingFixtures';

describe('väggarna som rubriker i panelen', () => {
  const design = designWithExtensions(windowOn('side-left', {}, 0, 'F1'), extension('side-right'), doorOn('gable-front'), windowOn('side-left', {}, 40, 'F2'));
  const placed = placeInstances(design, gingerbreadDomain);
  const [house, added] = groupPanelEntries(placed);

  it('visar varje vägg en gång, numrerad runt huset från framgaveln', () => {
    if (!house) throw new Error('S1 saknas');
    const walls = listPanelWalls(house.entry, house.nested);
    expect(walls.map((wall) => [wall.socket.labelKey, wall.ownerPartId])).toEqual([
      ['socket.wall1', 'S1/gable-front'],
      ['socket.wall2', 'S1/side-right'],
      ['socket.wall3', 'S1/gable-back'],
      ['socket.wall4', 'S1/side-left'],
    ]);
  });

  it('samlar fönster och dörrar under väggen de sitter på', () => {
    if (!house) throw new Error('S1 saknas');
    const nestedIds = Object.fromEntries(listPanelWalls(house.entry, house.nested).map((wall) => [wall.ownerPartId, wall.nested.map((child) => child.instance.id)]));
    expect(nestedIds).toEqual({ 'S1/gable-front': ['D1'], 'S1/side-right': [], 'S1/gable-back': [], 'S1/side-left': ['F1', 'F2'] });
  });

  it('numrerar en tillbyggnads tre väggar utan glapp', () => {
    if (!added) throw new Error('S2 saknas');
    expect(listPanelWalls(added.entry, added.nested).map((wall) => wall.socket.labelKey)).toEqual(['socket.wall1', 'socket.wall2', 'socket.wall3']);
  });

  it('ger varje vägg Längd: långväggen sektionens längd och gaveln bredden, men inte höjden', () => {
    if (!house || !added) throw new Error('S1 eller S2 saknas');
    const fields = describeParams(sectionType.params);
    const walls = [...listPanelWalls(house.entry, house.nested), ...listPanelWalls(added.entry, added.nested)];
    const shown = Object.fromEntries(walls.map((wall) => [wall.ownerPartId, listPartFields(fields, wall.socket).map((field) => [field.key, field.meta.labelKey])]));
    const sideFields = [['depth', 'wall.length']];
    const gableFields = [['width', 'wall.length']];
    expect(shown).toEqual({
      'S1/gable-front': gableFields,
      'S1/side-right': sideFields,
      'S1/gable-back': gableFields,
      'S1/side-left': sideFields,
      'S2/gable-front': gableFields,
      'S2/side-right': sideFields,
      'S2/side-left': sideFields,
    });
  });

  it('visar väggens fält utan sektionens grupp', () => {
    if (!house) throw new Error('S1 saknas');
    const [wall] = listPanelWalls(house.entry, house.nested);
    if (!wall) throw new Error('Vägg 1 saknas');
    const fields = describeParams(sectionType.params).map((field) => ({ ...field, meta: { ...field.meta, groupKey: 'group.any' } }));
    expect(listPartFields(fields, wall.socket).map((field) => field.meta.groupKey)).toEqual([undefined]);
  });

  it('hittar väggen för både tillbyggnadens och grannens kopplingspunkt', () => {
    expect(findOwnerPartId(house?.entry, 'side-right')).toBe('S1/side-right');
    expect(findOwnerPartId(house?.entry, 'beside-side-right')).toBe('S1/side-right');
  });
});
