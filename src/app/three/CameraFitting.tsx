import { useThree } from '@react-three/fiber';
import { useBounds } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Vector3 } from 'three';
import type { Part } from '../../core/model/part';
import type { CameraView } from '../state/cameraView';
import { useCameraView } from '../state/cameraView';
import type { ViewRequest } from '../state/designStore';

export type FitView = () => void;

interface CameraFittingProps {
  parts: Part[];
  fitRef: RefObject<FitView | null>;
  viewRequest: ViewRequest;
}

interface OrbitControlsLike {
  target: Vector3;
  update: () => void;
}

/**
 * Ställer kameran så att hela huset syns när det visas första gången och när
 * man trycker på knappen för att centrera. När ett annat hus öppnas visas det
 * med vinkeln som sparades med det, annars ställs kameran in på det. Annars
 * behåller kameran sitt läge när måtten ändras, så att vyn inte hoppar; ägaren
 * vill zooma själv. PDF:ens översiktsbild har en egen kamera.
 */
export function CameraFitting({ parts, fitRef, viewRequest }: CameraFittingProps) {
  const bounds = useBounds();
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as OrbitControlsLike | null;
  const invalidate = useThree((state) => state.invalidate);
  const setViewReader = useCameraView((state) => state.setViewReader);
  // Ett hus som öppnades innan vyn fanns, t.ex. från en länk, visas med sin vinkel första gången.
  const shownCountRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    fitRef.current = () => bounds.refresh().clip().fit();
    return () => {
      fitRef.current = null;
    };
  }, [bounds, fitRef]);

  useEffect(() => {
    if (!controls) return;
    setViewReader(() => ({ position: camera.position.toArray(), target: controls.target.toArray() }));
    return () => setViewReader(undefined);
  }, [camera, controls, setViewReader]);

  useEffect(() => {
    if (viewRequest.count === shownCountRef.current || parts.length === 0) return;
    // Den sparade vinkeln behöver kontrollerna, som kommer en bild efter kameran.
    if (viewRequest.view && !controls) return;
    shownCountRef.current = viewRequest.count;
    if (viewRequest.view && controls) {
      showView(viewRequest.view, camera.position, controls);
      invalidate();
    } else {
      bounds.refresh().clip().fit();
    }
  }, [bounds, parts, viewRequest, camera, controls, invalidate]);
  return null;
}

function showView(view: CameraView, position: Vector3, controls: OrbitControlsLike): void {
  position.set(...view.position);
  controls.target.set(...view.target);
  controls.update();
}
