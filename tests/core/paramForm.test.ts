import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { describeParams } from '../../src/core/model/paramForm';

describe('formulär från parameterschema', () => {
  it('läser gränser, standardvärden och texter', () => {
    const schema = z.object({
      width: z.number().min(60).max(400).default(140).meta({ labelKey: 'width', unit: 'mm', step: 5 }),
      hasChimney: z.boolean().default(false).meta({ labelKey: 'chimney' }),
      roof: z.enum(['gable', 'flat']).default('flat').meta({ labelKey: 'roof' }),
    });
    expect(describeParams(schema)).toEqual([
      { kind: 'number', key: 'width', meta: { labelKey: 'width', unit: 'mm', step: 5 }, min: 60, max: 400, defaultValue: 140 },
      { kind: 'boolean', key: 'hasChimney', meta: { labelKey: 'chimney' }, defaultValue: false },
      { kind: 'choice', key: 'roof', meta: { labelKey: 'roof' }, options: ['gable', 'flat'], defaultValue: 'flat' },
    ]);
  });

  it('kräver en text för varje fält', () => {
    expect(() => describeParams(z.object({ width: z.number() }))).toThrow(/labelKey/);
  });
});
