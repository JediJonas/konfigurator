import { useState } from 'react';

/** Toppnoderna i panelen som inte är sektioner. */
export type PanelGroupKey = 'savedHouses' | 'settings';

/**
 * Vilken av toppnoderna Mina hus och Inställningar som är utfälld. Bara en
 * toppnod är utfälld åt gången (ägarens val): fälls en av dem ut stängs den
 * öppna sektionen, och öppnas en sektion, även med ett tryck i 3D-vyn, fälls
 * de ihop. Byts huset, t.ex. när ett sparat hus öppnas eller man ångrar,
 * står gruppen kvar öppen och ingen sektion öppnas.
 */
export function usePanelGroup(openInstanceId: string | undefined, closeInstance: () => void) {
  const [openGroup, setOpenGroup] = useState<PanelGroupKey>();
  // Justeras direkt under ritningen i stället för i en effekt, så att panelen inte blinkar.
  if (openGroup !== undefined && openInstanceId !== undefined) closeInstance();
  return {
    openGroup,
    isOpen: (key: PanelGroupKey) => openGroup === key,
    /** Fäller ut gruppen och stänger allt annat, eller fäller ihop den. */
    toggle: (key: PanelGroupKey) => {
      if (openGroup === key) return setOpenGroup(undefined);
      closeInstance();
      setOpenGroup(key);
    },
    /** Fäller ihop gruppen, t.ex. när en sektion öppnas. */
    close: () => setOpenGroup(undefined),
  };
}
