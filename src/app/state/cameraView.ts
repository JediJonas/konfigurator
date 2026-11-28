import { create } from 'zustand';

/** Kamerans läge och punkten den tittar mot, i millimeter i 3D-vyns koordinater. */
export interface CameraView {
  position: [number, number, number];
  target: [number, number, number];
}

/** Ett tal i taget i listan `[x, y, z, mål x, mål y, mål z]`, avrundat till hela millimeter så att länken blir kort. */
export function packCameraView(view: CameraView): number[] {
  return [...view.position, ...view.target].map((value) => Math.round(value) || 0);
}

/** Läser en vinkel ur en sparad lista eller ett sparat objekt. Ger inget om den inte går att läsa. */
export function readCameraView(stored: unknown): CameraView | undefined {
  const values = Array.isArray(stored) ? stored : isViewObject(stored) ? [...stored.position, ...stored.target] : undefined;
  if (!values || values.length !== 6 || !values.every((value) => typeof value === 'number' && Number.isFinite(value))) return undefined;
  const [x, y, z, targetX, targetY, targetZ] = values as number[];
  return { position: [x ?? 0, y ?? 0, z ?? 0], target: [targetX ?? 0, targetY ?? 0, targetZ ?? 0] };
}

function isViewObject(value: unknown): value is CameraView {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<CameraView>;
  return Array.isArray(candidate.position) && Array.isArray(candidate.target);
}

interface CameraViewState {
  /** Läser 3D-vyns kamera just nu; sätts av 3D-vyn när den visas. */
  readCurrentView?: () => CameraView;
  setViewReader: (readCurrentView: (() => CameraView) | undefined) => void;
}

/** Kopplingen mellan 3D-vyns kamera och panelen, som sparar vinkeln med huset. */
export const useCameraView = create<CameraViewState>((set) => ({
  setViewReader: (readCurrentView) => set({ readCurrentView }),
}));

/** Kamerans vinkel just nu, avrundad till hela millimeter, eller inget om 3D-vyn inte visas. */
export function captureCameraView(): CameraView | undefined {
  const view = useCameraView.getState().readCurrentView?.();
  return view ? readCameraView(packCameraView(view)) : undefined;
}
