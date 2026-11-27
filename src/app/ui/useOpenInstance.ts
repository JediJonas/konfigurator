import { useState } from 'react';

/**
 * Vilket objekt som är öppet i panelen. Ett i taget, så att listan inte blir
 * lång när man bygger till: ett nytt objekt öppnas direkt, ett objekt vars
 * vägg man trycker på i 3D-vyn öppnas, och trycker man på ett annat objekts
 * rubrik byter man till det.
 */
export function useOpenInstance(instanceIds: string[], focus: PanelFocus | undefined) {
  const focusedId = focus?.instanceId;
  const focusKey = focus?.key;
  const idsKey = instanceIds.join(' ');
  const [openId, setOpenId] = useState<string | undefined>(instanceIds.at(-1));
  const [known, setKnown] = useState({ instanceIds, idsKey, focusKey });
  // Justeras direkt under ritningen i stället för i en effekt, så att panelen inte blinkar.
  if (idsKey !== known.idsKey || focusKey !== known.focusKey) {
    setKnown({ instanceIds, idsKey, focusKey });
    setOpenId(findAddedId(known.instanceIds, instanceIds) ?? (focusKey !== known.focusKey ? focusedId : undefined) ?? openId);
  }
  return {
    isOpen: (instanceId: string) => openId === instanceId,
    toggle: (instanceId: string) => setOpenId((current) => (current === instanceId ? undefined : instanceId)),
  };
}

/** Objektet som ska öppnas efter ett tryck i 3D-vyn. Varje nytt tryck har en ny nyckel. */
export interface PanelFocus {
  instanceId: string;
  key: string;
}

/** Objektet som har lagts till sedan förra gången, var det än hamnar i listan. */
export function findAddedId(before: readonly string[], after: readonly string[]): string | undefined {
  const known = new Set(before);
  return after.find((id) => !known.has(id));
}
