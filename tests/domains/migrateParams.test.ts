import { describe, expect, it } from 'vitest';
import { GINGERBREAD_DOMAIN_VERSION } from '../../src/domains/gingerbread/identity';
import { migrateGingerbreadParams } from '../../src/domains/gingerbread/migrateParams';
import { simpleHousePreset } from '../../src/domains/gingerbread/presets/simpleHouse';

describe('migrering av pepparkakshusets parametrar', () => {
  it('gör om dörrens gångjärn till dess typ i version 2', () => {
    const design = simpleHousePreset.create();
    const door = { id: 'D1', type: 'gb.door', params: { width: 35, height: 60, shape: 'rect', hinge: 'right', openAngle: 30 }, children: [] };
    const section = { ...design.root.children[0]!, children: [door] };
    const old = { ...design, domainVersion: 1, root: { ...design.root, children: [section] } };
    const migrated = migrateGingerbreadParams(old);
    expect(migrated.domainVersion).toBe(GINGERBREAD_DOMAIN_VERSION);
    expect(migrated.root.children[0]?.children[0]?.params).toEqual({ width: 35, height: 60, shape: 'rect', kind: 'right', openAngle: 30 });
  });

  it('lämnar en design i dagens version som den är', () => {
    const design = simpleHousePreset.create();
    expect(migrateGingerbreadParams(design)).toBe(design);
  });
});
