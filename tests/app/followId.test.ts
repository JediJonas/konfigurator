import { describe, expect, it } from 'vitest';
import { followId } from '../../src/app/ui/useOpenInstance';

describe('öppet objekt när id:n byts', () => {
  const change = { renames: new Map([['S3', 'S2'], ['S4', 'S3']]), removedIds: ['S2', 'F2'] };

  it('följer objektet till sitt nya id', () => expect(followId('S4', change)).toBe('S3'));
  it('släpper ett borttaget objekt i stället för att öppna det som fick dess nummer', () => expect(followId('S2', change)).toBeUndefined());
  it('lämnar andra id:n', () => expect(followId('S1', change)).toBe('S1'));
});
