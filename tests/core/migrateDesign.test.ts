import { describe, expect, it } from 'vitest';
import { DESIGN_SCHEMA_VERSION } from '../../src/core/model/design';
import { migrateDesign } from '../../src/core/model/migrateDesign';
import { simpleHousePreset } from '../../src/domains/gingerbread/presets/simpleHouse';

describe('migrering av sparade designer', () => {
  it('öppnar en design i dagens format som den är', () => {
    const design = simpleHousePreset.create();
    expect(migrateDesign(JSON.parse(JSON.stringify(design)))).toEqual(design);
  });

  it('vägrar designer från en nyare version och sådant som inte är designer', () => {
    expect(() => migrateDesign({ ...simpleHousePreset.create(), version: DESIGN_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => migrateDesign({ hello: 'world' })).toThrow();
    expect(() => migrateDesign(null)).toThrow();
  });
});
