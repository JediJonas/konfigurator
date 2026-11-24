import { useState } from 'react';
import type { SocketRef } from '../state/designStore';

/**
 * Vilket objekt som är öppet i panelen. Ett i taget, så att listan inte blir
 * lång när man bygger till: ett nytt objekt öppnas direkt, ett objekt vars
 * vägg man trycker på i 3D-vyn öppnas, och trycker man på ett annat objekts
 * rubrik byter man till det.
 */
export function useOpenInstance(instanceIds: string[], focusedSocket: SocketRef | undefined) {
  const focusedId = focusedSocket?.instanceId;
  // Varje nytt val av vägg räknas, även på samma objekt, så att objektet öppnas igen om man har stängt det.
  const focusKey = focusedSocket ? `${focusedSocket.instanceId}/${focusedSocket.socketId}` : undefined;
  const newestId = instanceIds.at(-1);
  const [openId, setOpenId] = useState<string | undefined>(newestId);
  const [known, setKnown] = useState({ newestId, focusKey });
  // Justeras direkt under ritningen i stället för i en effekt, så att panelen inte blinkar.
  if (newestId !== known.newestId || focusKey !== known.focusKey) {
    setKnown({ newestId, focusKey });
    setOpenId(newestId !== known.newestId ? newestId : (focusedId ?? openId));
  }
  return {
    isOpen: (instanceId: string) => openId === instanceId,
    toggle: (instanceId: string) => setOpenId((current) => (current === instanceId ? undefined : instanceId)),
  };
}
