import { create } from 'zustand';

/** Vad som hände när appen öppnades med ett hus i adressen. */
export type HouseNoticeKind = 'linkOpened' | 'linkFailed';

interface HouseNoticeState {
  notice?: HouseNoticeKind;
  showNotice: (notice: HouseNoticeKind) => void;
  dismissNotice: () => void;
}

/** Ett meddelande om huset från en länk, som visas överst i panelen tills man stänger det. */
export const useHouseNotice = create<HouseNoticeState>((set) => ({
  showNotice: (notice) => set({ notice }),
  dismissNotice: () => set({ notice: undefined }),
}));
