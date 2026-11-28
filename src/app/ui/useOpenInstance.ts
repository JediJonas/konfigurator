import { useState } from 'react';

/** Id:n som byttes när objektlistan ändrades, t.ex. S3 → S2 när S2 togs bort. */
export interface OpenInstanceIdChange {
  renames: ReadonlyMap<string, string>;
  removedIds: readonly string[];
  /** Objektet som kom tillbaka, t.ex. när en borttagning ångras. */
  addedId?: string;
}

/**
 * Vilket objekt som är öppet i panelen. Ett i taget, så att listan inte blir
 * lång när man bygger till: ett nytt objekt öppnas direkt, ett objekt vars
 * vägg man trycker på i 3D-vyn öppnas, och trycker man på ett annat objekts
 * rubrik byter man till det. Byter objekten id, t.ex. när numren flyttas ner
 * efter en borttagning, står samma objekt öppet (`idChange`).
 */
export function useOpenInstance(instanceIds: string[], focus: PanelFocus | undefined, idChange?: OpenInstanceIdChange) {
  const focusedId = focus?.instanceId;
  const focusKey = focus?.key;
  const idsKey = instanceIds.join(' ');
  const [openId, setOpenId] = useState<string | undefined>(instanceIds.at(-1));
  const [known, setKnown] = useState({ instanceIds, idsKey, focusKey });
  // Ett nytt objekt varje gång, så att ett id som tas bort och läggs till igen också räknas.
  const [added, setAdded] = useState<{ instanceId: string }>();
  // Justeras direkt under ritningen i stället för i en effekt, så att panelen inte blinkar.
  if (idsKey !== known.idsKey || focusKey !== known.focusKey) {
    setKnown({ instanceIds, idsKey, focusKey });
    const newId = idChange ? idChange.addedId : findAddedId(known.instanceIds, instanceIds);
    if (newId) setAdded({ instanceId: newId });
    setOpenId(newId ?? (focusKey !== known.focusKey ? focusedId : undefined) ?? followId(openId, idChange));
  }
  return {
    openId,
    /** Det senast tillagda objektet, så att panelen kan rulla fram till det. */
    added,
    isOpen: (instanceId: string) => openId === instanceId,
    /** Öppnar objektet, eller inget när id saknas. */
    open: (instanceId: string | undefined) => setOpenId(instanceId),
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

/** Samma objekts id efter att id:n har bytts, eller inget när det har tagits bort. */
export function followId(instanceId: string | undefined, idChange: OpenInstanceIdChange | undefined): string | undefined {
  if (instanceId === undefined || !idChange) return instanceId;
  if (idChange.removedIds.includes(instanceId)) return undefined;
  return idChange.renames.get(instanceId) ?? instanceId;
}
