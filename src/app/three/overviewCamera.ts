/** Vinkeln för översiktsbilden i PDF:en: snett framifrån och från sidan, lite ovanifrån. */
export const OVERVIEW_AZIMUTH_DEGREES = 37;
export const OVERVIEW_ELEVATION_DEGREES = 24;
/**
 * Avstånd i förhållande till att sfären runt huset precis ryms. Sfären är
 * mycket större än huset sett snett från sidan, så huset ryms med marginal även under 1.
 */
const OVERVIEW_DISTANCE_FACTOR = 0.98;

interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraPose {
  position: Point3;
  target: Point3;
}

export interface OverviewFrame {
  /** Mitt och radie för en sfär som omsluter huset, i mm. */
  center: Point3;
  radius: number;
  verticalFovDegrees: number;
  aspectRatio: number;
}

/** Kamerans läge så att hela huset ryms i bilden, sett från den fasta vinkeln. */
export function overviewCameraPose(frame: OverviewFrame): CameraPose {
  const verticalHalf = toRadians(frame.verticalFovDegrees) / 2;
  const horizontalHalf = Math.atan(Math.tan(verticalHalf) * frame.aspectRatio);
  const distance = (frame.radius / Math.sin(Math.min(verticalHalf, horizontalHalf))) * OVERVIEW_DISTANCE_FACTOR;
  const azimuth = toRadians(OVERVIEW_AZIMUTH_DEGREES);
  const elevation = toRadians(OVERVIEW_ELEVATION_DEGREES);
  return {
    target: frame.center,
    position: {
      x: frame.center.x + distance * Math.cos(elevation) * Math.sin(azimuth),
      y: frame.center.y + distance * Math.sin(elevation),
      z: frame.center.z + distance * Math.cos(elevation) * Math.cos(azimuth),
    },
  };
}

/** Synfältet för en beskuren del av bilden, när bara en del av höjden används. */
export function croppedVerticalFovDegrees(verticalFovDegrees: number, croppedHeightShare: number): number {
  return 2 * toDegrees(Math.atan(Math.tan(toRadians(verticalFovDegrees) / 2) * croppedHeightShare));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
