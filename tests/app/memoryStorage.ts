import type { KeyValueStorage } from '../../src/app/storage/localProjectStore';

/** Lagring i minnet som beter sig som webbläsarens lokala lagring. */
export function createMemoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}
