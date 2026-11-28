import { describe, expect, it } from 'vitest';
import { GINGERBREAD_DOMAIN_VERSION } from '../../src/domains/gingerbread/identity';
import { migrateGingerbreadParams } from '../../src/domains/gingerbread/migrateParams';
import { simpleHousePreset } from '../../src/domains/gingerbread/presets/simpleHouse';

describe('migrering av pepparkakshusets parametrar', () => {
  it('gör om dörrens gångjärn till enkeldörr och tar bort hur öppen den är', () => {
    const design = simpleHousePreset.create();
    const door = { id: 'D1', type: 'gb.door', params: { width: 35, height: 60, shape: 'rect', hinge: 'right', openAngle: 30 }, children: [] };
    const section = { ...design.root.children[0]!, children: [door] };
    const old = { ...design, domainVersion: 1, root: { ...design.root, children: [section] } };
    const migrated = migrateGingerbreadParams(old);
    expect(migrated.domainVersion).toBe(GINGERBREAD_DOMAIN_VERSION);
    expect(migrated.root.children[0]?.children[0]?.params).toEqual({ width: 35, height: 60, shape: 'rect', kind: 'single' });
  });

  it('gör om vänster- och högerhängd från version 2 till enkeldörr och behåller dubbeldörrar', () => {
    const design = simpleHousePreset.create();
    const doors = ['right', 'double'].map((kind, index) => ({ id: `D${index + 1}`, type: 'gb.door', params: { width: 35, height: 60, shape: 'rect', kind, openAngle: 45 }, children: [] }));
    const section = { ...design.root.children[0]!, children: doors };
    const migrated = migrateGingerbreadParams({ ...design, domainVersion: 2, root: { ...design.root, children: [section] } });
    expect(migrated.root.children[0]?.children.map((door) => door.params)).toEqual([
      { width: 35, height: 60, shape: 'rect', kind: 'single' },
      { width: 35, height: 60, shape: 'rect', kind: 'double' },
    ]);
  });

  it('lämnar en design i dagens version som den är', () => {
    const design = simpleHousePreset.create();
    expect(migrateGingerbreadParams(design)).toBe(design);
  });

  it('gör om Spröjs (kors) till Fyra rutor i version 4 och låter andra värden vara', () => {
    const design = simpleHousePreset.create();
    const windows = ['cross', 'none'].map((mullions, index) => ({ id: `F${index + 1}`, type: 'gb.window', params: { width: 30, mullions }, children: [] }));
    const section = { ...design.root.children[0]!, children: windows };
    const migrated = migrateGingerbreadParams({ ...design, domainVersion: 3, root: { ...design.root, children: [section] } });
    expect(migrated.root.children[0]?.children.map((window) => window.params.mullions)).toEqual(['four', 'none']);
  });
});
