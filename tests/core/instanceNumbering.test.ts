import { describe, expect, it } from 'vitest';
import type { Instance } from '../../src/core/model/design';
import { listInstances } from '../../src/core/model/instanceTree';
import { findRemoval, removeAndRenumber, renumberInstances } from '../../src/core/model/instanceNumbering';

const node = (id: string, type: string, children: Instance[] = []): Instance => ({ id, type, params: { name: id }, children });
const PREFIXES: Record<string, string> = { section: 'S', window: 'F', chimney: 'SK' };
const prefixOf = (typeId: string) => PREFIXES[typeId];
const idsOf = (root: Instance) => listInstances(root).map((instance) => instance.id);

/** S1 med S2 och S3 på sig, S4 på S3; fönster F1 på S1, F2 och F3 på S2; skorsten SK1 på S1. */
const root: Instance = node('plate', 'plate', [
  node('S1', 'section', [
    node('F1', 'window'),
    node('S2', 'section', [node('F2', 'window'), node('F3', 'window')]),
    node('S3', 'section', [node('S4', 'section')]),
    node('SK1', 'chimney'),
  ]),
]);

describe('numrering efter borttagning', () => {
  it('flyttar ner numren efter den borttagna sektionen, S3 blir S2 och S4 blir S3', () => {
    const removal = removeAndRenumber(root, 'S2', prefixOf);
    expect(idsOf(removal.root)).toEqual(['S1', 'F1', 'S2', 'S3', 'SK1']);
    expect(removal.renames).toEqual(new Map([['S3', 'S2'], ['S4', 'S3']]));
    expect(removal.removedIds).toEqual(['S2', 'F2', 'F3']);
  });

  it('behåller samma objekt under nya id:n', () => {
    const removal = removeAndRenumber(root, 'S2', prefixOf);
    const formerS3 = removal.root.children[0]!.children[1]!;
    expect(formerS3.params.name).toBe('S3');
    expect(formerS3.children[0]!.id).toBe('S3');
    expect(formerS3.children[0]!.params.name).toBe('S4');
  });

  it('numrerar inte om skorstenar när en sektion tas bort, fast prefixen börjar lika', () => {
    expect(idsOf(removeAndRenumber(root, 'S3', prefixOf).root)).toContain('SK1');
  });

  it('numrerar om fönstren när ett fönster tas bort', () => {
    const removal = removeAndRenumber(root, 'F1', prefixOf);
    expect(idsOf(removal.root)).toEqual(['S1', 'S2', 'F1', 'F2', 'S3', 'S4', 'SK1']);
  });

  it('ändrar inget när det sista numret tas bort', () => {
    const removal = removeAndRenumber(root, 'S4', prefixOf);
    expect(removal.renames.size).toBe(0);
  });

  it('lämnar id:n med andra mönster', () => {
    const odd: Instance = node('plate', 'plate', [node('S2', 'section'), node('Sx', 'section'), node('S05', 'section')]);
    expect(idsOf(renumberInstances(odd, ['S']).root)).toEqual(['S1', 'Sx', 'S05']);
  });

  it('hittar borttagningen mellan två designer, så att den kan ångras', () => {
    const after = removeAndRenumber(root, 'S2', prefixOf).root;
    expect(findRemoval(root, after, prefixOf)?.removedId).toBe('S2');
    expect(findRemoval(after, root, prefixOf)).toBeUndefined();
  });
});
