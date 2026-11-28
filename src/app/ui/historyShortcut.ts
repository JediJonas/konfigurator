/** Det lilla av en tangenttryckning som behövs för att känna igen kortkommandona. */
export interface ShortcutKey {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Kortkommandot för Ångra eller Gör om: Ctrl+Z (Cmd+Z på Mac) ångrar,
 * Shift+Ctrl+Z (Shift+Cmd+Z) och Ctrl+Y gör om.
 */
export function readHistoryShortcut(event: ShortcutKey): 'undo' | 'redo' | undefined {
  const hasCommandKey = event.ctrlKey || event.metaKey;
  if (!hasCommandKey || event.altKey) return undefined;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && event.ctrlKey && !event.shiftKey) return 'redo';
  return undefined;
}

/** Sant i ett textfält, där webbläsaren själv ångrar det man skriver. */
export function isTextEntry(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}
