/** Lampans läge räknat från betraktaren: lite till höger, framför huset och snett ovanför, i mm. */
export const LIGHT_OFFSET_FROM_VIEWER_MM = { right: 260, towardViewer: 300, up: 500 } as const;

interface Point3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Lampan står still i förhållande till den som tittar, som en lampa i rummet
 * medan man vrider fatet. Bara vridningen runt huset (inte höjden) räknas, så
 * att ljuset kommer ovanifrån även när man tittar rakt ner.
 */
export function lightPositionForView(camera: Point3, target: Point3): Point3 {
  const azimuth = Math.atan2(camera.x - target.x, camera.z - target.z);
  const right = { x: Math.cos(azimuth), z: -Math.sin(azimuth) };
  const towardViewer = { x: Math.sin(azimuth), z: Math.cos(azimuth) };
  const offset = LIGHT_OFFSET_FROM_VIEWER_MM;
  return {
    x: target.x + right.x * offset.right + towardViewer.x * offset.towardViewer,
    y: target.y + offset.up,
    z: target.z + right.z * offset.right + towardViewer.z * offset.towardViewer,
  };
}
