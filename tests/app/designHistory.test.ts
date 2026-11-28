import { describe, expect, it } from 'vitest';
import type { Design } from '../../src/core/model/design';
import { EMPTY_HISTORY, MAX_UNDO_STEPS, MERGE_WINDOW_MS, recordChange, redoChange, undoChange } from '../../src/app/state/designHistory';

/** Designerna jämförs bara som olika objekt, så innehållet spelar ingen roll. */
function createDesign(label: string): Design {
  return { label } as unknown as Design;
}

describe('designHistory', () => {
  const a = createDesign('a');
  const b = createDesign('b');
  const c = createDesign('c');

  it('ångrar och gör om en ändring', () => {
    const history = recordChange(EMPTY_HISTORY, a, b, { at: 0 });
    const undone = undoChange(history, b);
    expect(undone?.design).toBe(a);
    const redone = redoChange(undone!.history, a);
    expect(redone?.design).toBe(b);
    expect(redone?.history.future).toEqual([]);
  });

  it('ger inget att ångra eller göra om i en tom historik', () => {
    expect(undoChange(EMPTY_HISTORY, a)).toBeUndefined();
    expect(redoChange(EMPTY_HISTORY, a)).toBeUndefined();
  });

  it('räknar inte en ändring som inte ändrar designen', () => {
    expect(recordChange(EMPTY_HISTORY, a, a, { at: 0 })).toBe(EMPTY_HISTORY);
  });

  it('slår ihop täta ändringar av samma fält till ett steg', () => {
    let history = recordChange(EMPTY_HISTORY, a, b, { mergeKey: 'width', at: 0 });
    history = recordChange(history, b, c, { mergeKey: 'width', at: MERGE_WINDOW_MS - 1 });
    expect(history.past).toEqual([a]);
    expect(undoChange(history, c)?.design).toBe(a);
  });

  it('räknar fönstret från den senaste ändringen, så att ett långt stegande blir ett steg', () => {
    let history = EMPTY_HISTORY;
    let current = a;
    for (let step = 0; step < 10; step += 1) {
      const next = createDesign(`steg ${step}`);
      history = recordChange(history, current, next, { mergeKey: 'width', at: step * (MERGE_WINDOW_MS / 2) });
      current = next;
    }
    expect(history.past).toEqual([a]);
  });

  it('gör egna steg av olika fält, långsamma ändringar och ändringar utan nyckel', () => {
    let history = recordChange(EMPTY_HISTORY, a, b, { mergeKey: 'width', at: 0 });
    history = recordChange(history, b, c, { mergeKey: 'height', at: 10 });
    expect(history.past).toHaveLength(2);
    const d = createDesign('d');
    history = recordChange(history, c, d, { mergeKey: 'height', at: 10 + MERGE_WINDOW_MS });
    expect(history.past).toHaveLength(3);
    const e = createDesign('e');
    history = recordChange(history, d, e, { at: 20 + MERGE_WINDOW_MS });
    history = recordChange(history, e, a, { at: 21 + MERGE_WINDOW_MS });
    expect(history.past).toHaveLength(5);
  });

  it('slår inte ihop en ändring efter Ångra med ändringen före', () => {
    let history = recordChange(EMPTY_HISTORY, a, b, { mergeKey: 'width', at: 0 });
    history = undoChange(history, b)!.history;
    history = recordChange(history, a, c, { mergeKey: 'width', at: 1 });
    expect(history.past).toEqual([a]);
    expect(history.future).toEqual([]);
  });

  it('glömmer de äldsta stegen', () => {
    let history = EMPTY_HISTORY;
    let current = a;
    for (let step = 0; step < MAX_UNDO_STEPS + 5; step += 1) {
      const next = createDesign(`steg ${step}`);
      history = recordChange(history, current, next, { at: step });
      current = next;
    }
    expect(history.past).toHaveLength(MAX_UNDO_STEPS);
    expect(history.past[0]).not.toBe(a);
  });
});
