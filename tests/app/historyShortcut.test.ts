import { describe, expect, it } from 'vitest';
import { readHistoryShortcut } from '../../src/app/ui/historyShortcut';
import type { ShortcutKey } from '../../src/app/ui/historyShortcut';

function press(key: string, modifiers: Partial<ShortcutKey> = {}): ShortcutKey {
  return { key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...modifiers };
}

describe('readHistoryShortcut', () => {
  it('ångrar med Ctrl+Z och Cmd+Z', () => {
    expect(readHistoryShortcut(press('z', { ctrlKey: true }))).toBe('undo');
    expect(readHistoryShortcut(press('z', { metaKey: true }))).toBe('undo');
  });

  it('gör om med Skift+Ctrl+Z, Skift+Cmd+Z och Ctrl+Y', () => {
    expect(readHistoryShortcut(press('Z', { ctrlKey: true, shiftKey: true }))).toBe('redo');
    expect(readHistoryShortcut(press('Z', { metaKey: true, shiftKey: true }))).toBe('redo');
    expect(readHistoryShortcut(press('y', { ctrlKey: true }))).toBe('redo');
  });

  it('bryr sig inte om andra tangenter', () => {
    expect(readHistoryShortcut(press('z'))).toBeUndefined();
    expect(readHistoryShortcut(press('z', { ctrlKey: true, altKey: true }))).toBeUndefined();
    expect(readHistoryShortcut(press('x', { ctrlKey: true }))).toBeUndefined();
  });
});
