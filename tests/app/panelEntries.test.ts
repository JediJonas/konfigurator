import { describe, expect, it } from 'vitest';
import { placeInstances } from '../../src/core/pipeline/placeInstances';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { groupPanelEntries } from '../../src/app/ui/panelEntries';
import { findAddedId } from '../../src/app/ui/useOpenInstance';
import { designWithExtensions, extension } from '../domains/extensionFixtures';
import { windowOn } from '../domains/openingFixtures';

describe('objekten i panelen', () => {
  it('samlar fönstren under sektionen de sitter på, även när en tillbyggnad skapades emellan', () => {
    const design = designWithExtensions(windowOn('side-left', {}, 0, 'F1'), extension('side-right'), windowOn('gable-front', {}, 0, 'F2'));
    const groups = groupPanelEntries(placeInstances(design, gingerbreadDomain));
    expect(groups.map(({ entry, nested }) => [entry.instance.id, nested.map((child) => child.instance.id)])).toEqual([
      ['S1', ['F1', 'F2']],
      ['S2', []],
    ]);
  });

  it('öppnar objektet som lades till, var det än hamnar i listan', () => {
    expect(findAddedId(['S1', 'F1', 'S2'], ['S1', 'F1', 'F2', 'S2'])).toBe('F2');
    expect(findAddedId(['S1', 'F1'], ['S1'])).toBeUndefined();
  });
});
