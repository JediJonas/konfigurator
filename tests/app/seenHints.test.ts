import { describe, expect, it } from 'vitest';
import { hasSeenHint, rememberSeenHint } from '../../src/app/state/seenHints';
import type { HintStorage } from '../../src/app/state/seenHints';

function createMemoryStorage(): HintStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

const blockedStorage: HintStorage = {
  getItem: () => {
    throw new Error('blockerad');
  },
  setItem: () => {
    throw new Error('blockerad');
  },
};

describe('hjälptexter som döljs efter första gången', () => {
  it('visar texten tills den har använts och kommer ihåg det', () => {
    const storage = createMemoryStorage();
    expect(hasSeenHint(storage, 'view')).toBe(false);
    rememberSeenHint(storage, 'view');
    expect(hasSeenHint(storage, 'view')).toBe(true);
    expect(hasSeenHint(storage, 'addFromView')).toBe(false);
  });

  it('visar texten när lagringen saknas eller är blockerad', () => {
    expect(hasSeenHint(undefined, 'view')).toBe(false);
    expect(hasSeenHint(blockedStorage, 'view')).toBe(false);
    expect(() => rememberSeenHint(blockedStorage, 'view')).not.toThrow();
  });
});
