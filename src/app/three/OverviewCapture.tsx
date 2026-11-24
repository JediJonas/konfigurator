import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type { RefObject } from 'react';
import { Box3, PerspectiveCamera, Sphere } from 'three';
import type { Group, Object3D } from 'three';
import { croppedVerticalFovDegrees, overviewCameraPose } from './overviewCamera';
import { lightPositionForView } from './viewerLight';

export interface OverviewImage {
  dataUrl: string;
  aspectRatio: number;
}

export type CaptureOverview = () => OverviewImage | undefined;

/** Bildformatet på ritningens första sida. */
export const OVERVIEW_ASPECT_RATIO = 4 / 3;
export const VIEWER_LIGHT_NAME = 'viewer-light';

interface OverviewCaptureProps {
  partsRef: RefObject<Group | null>;
  captureRef: RefObject<CaptureOverview | null>;
}

/**
 * Tar översiktsbilden till PDF:en från en fast vinkel, oberoende av hur
 * användaren har vridit vyn. Ritar en bild med en egen kamera, kopierar den
 * och låter sedan vyn rita om sig som vanligt.
 */
export function OverviewCapture({ partsRef, captureRef }: OverviewCaptureProps) {
  const { gl, scene, camera, invalidate } = useThree();

  useEffect(() => {
    captureRef.current = () => {
      const parts = partsRef.current;
      if (!parts || !(camera instanceof PerspectiveCamera)) return undefined;
      const canvas = gl.domElement;
      const crop = centeredCrop(canvas.width, canvas.height);
      const sphere = new Box3().setFromObject(parts).getBoundingSphere(new Sphere());
      const overviewCamera = camera.clone();
      overviewCamera.aspect = OVERVIEW_ASPECT_RATIO;
      overviewCamera.fov = croppedVerticalFovDegrees(camera.fov, crop.height / canvas.height);
      const pose = overviewCameraPose({ center: sphere.center, radius: sphere.radius, verticalFovDegrees: overviewCamera.fov, aspectRatio: OVERVIEW_ASPECT_RATIO });
      overviewCamera.position.set(pose.position.x, pose.position.y, pose.position.z);
      overviewCamera.lookAt(sphere.center);
      // Kameran ritar hela duken men bara den beskurna mitten används.
      overviewCamera.aspect = canvas.width / canvas.height;
      overviewCamera.fov = camera.fov;
      overviewCamera.updateProjectionMatrix();
      pointLightAt(scene.getObjectByName(VIEWER_LIGHT_NAME), pose.position, sphere.center);
      gl.render(scene, overviewCamera);
      const image = copyRegion(canvas, crop);
      invalidate();
      return image;
    };
    return () => {
      captureRef.current = null;
    };
  }, [camera, captureRef, gl, invalidate, partsRef, scene]);

  return null;
}

function pointLightAt(light: Object3D | undefined, viewer: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }): void {
  if (!light) return;
  const position = lightPositionForView(viewer, target);
  light.position.set(position.x, position.y, position.z);
  light.updateMatrixWorld();
}

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

function centeredCrop(width: number, height: number): Region {
  if (width / height > OVERVIEW_ASPECT_RATIO) {
    const cropWidth = height * OVERVIEW_ASPECT_RATIO;
    return { x: (width - cropWidth) / 2, y: 0, width: cropWidth, height };
  }
  const cropHeight = width / OVERVIEW_ASPECT_RATIO;
  return { x: 0, y: (height - cropHeight) / 2, width, height: cropHeight };
}

function copyRegion(source: HTMLCanvasElement, region: Region): OverviewImage | undefined {
  const target = document.createElement('canvas');
  target.width = Math.round(region.width);
  target.height = Math.round(region.height);
  const context = target.getContext('2d');
  if (!context) return undefined;
  context.drawImage(source, region.x, region.y, region.width, region.height, 0, 0, target.width, target.height);
  return { dataUrl: target.toDataURL('image/png'), aspectRatio: OVERVIEW_ASPECT_RATIO };
}
