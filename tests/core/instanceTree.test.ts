import { describe, expect, it } from 'vitest';
import type { Instance } from '../../src/core/model/design';
import { addChildInstance, findInstance, listInstances, nextInstanceId, removeInstance } from '../../src/core/model/instanceTree';

const leaf = (id: string): Instance => ({ id, type: 't', params: {}, children: [] });

describe('monteringsträdet', () => {
  const root: Instance = { ...leaf('root'), children: [{ ...leaf('S1'), children: [{ ...leaf('S2'), children: [leaf('S3')] }] }] };

  it('tar bort barnen tillsammans med objektet', () => {
    expect(listInstances(removeInstance(root, 'S2')).map((instance) => instance.id)).toEqual(['S1']);
  });

  it('lägger till ett barn på rätt förälder', () => {
    expect(findInstance(addChildInstance(root, 'S3', leaf('S4')), 'S3')?.children.map((child) => child.id)).toEqual(['S4']);
  });

  it('väljer nästa lediga id', () => {
    expect(nextInstanceId(removeInstance(root, 'S3'), 'S')).toBe('S3');
    expect(nextInstanceId(root, 'S')).toBe('S4');
  });
});
