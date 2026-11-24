import { isPointInPolygon } from '../../core/geometry/hull';
import { invertRigidMatrix, transformPoint } from '../../core/geometry/matrix';
import type { Matrix4 } from '../../core/geometry/matrix';
import type { Polygon } from '../../core/geometry/polygon';
import { subtract3 } from '../../core/geometry/vector';
import type { Mm, Vec3 } from '../../core/geometry/vector';
import type { Part } from '../../core/model/part';

/** Så nära en vägg eller ett tak kameran får komma när man zoomar, i mm. */
export const CAMERA_CLEARANCE_MM = 15;
/** Strålar som går nästan parallellt med en skiva räknas inte mot dess stora sidor. */
const PARALLEL_EPSILON = 1e-9;
/** Träffar så här nära en dels kant räknas, så att kameran inte slinker genom fogen mellan två delar, t.ex. i nocken. */
const SEAM_TOLERANCE_MM = 1;

/** En del med den inverterade placeringen uträknad i förväg, så att varje zoomsteg går snabbt. */
export interface ClearancePart {
  toLocal: Matrix4;
  outline: Polygon;
  holes: Polygon[];
  thickness: Mm;
}

export function prepareClearanceParts(parts: Part[]): ClearancePart[] {
  return parts.map((part) => ({ toLocal: invertRigidMatrix(part.transform), outline: part.outline, holes: part.holes, thickness: part.thickness }));
}

/**
 * Hur långt från vyns mittpunkt kameran minst måste stå längs riktningen mot
 * kameran för att vara utanför huset. Det är den yttersta träffen på en del
 * längs strålen plus en liten marginal, så att zoomen stannar precis utanför
 * väggen eller taket. Utan träff finns ingen gräns (0).
 */
export function minimumCameraDistance(parts: ClearancePart[], target: Vec3, towardCamera: Vec3): Mm {
  const farthestHit = Math.max(0, ...parts.map((part) => farthestHitOnPart(part, target, towardCamera)));
  return farthestHit > 0 ? farthestHit + CAMERA_CLEARANCE_MM : 0;
}

/**
 * Var kameran ska stå: där den är om den redan är utanför huset, annars
 * flyttad bakåt längs samma siktlinje tills den är utanför. Riktningen ändras inte.
 */
export function cameraPositionOutsideParts(parts: ClearancePart[], target: Vec3, camera: Vec3): Vec3 {
  const offset = subtract3(camera, target);
  const distance = Math.hypot(offset.x, offset.y, offset.z);
  if (distance === 0) return camera;
  const towardCamera = { x: offset.x / distance, y: offset.y / distance, z: offset.z / distance };
  const minimum = minimumCameraDistance(parts, target, towardCamera);
  if (distance >= minimum) return camera;
  return {
    x: target.x + towardCamera.x * minimum,
    y: target.y + towardCamera.y * minimum,
    z: target.z + towardCamera.z * minimum,
  };
}

/** Längsta avståndet där strålen går genom delens fram- eller baksida, 0 utan träff. */
function farthestHitOnPart(part: ClearancePart, origin: Vec3, direction: Vec3): Mm {
  const localOrigin = transformPoint(part.toLocal, origin);
  const localDirection = subtract3(transformPoint(part.toLocal, { x: origin.x + direction.x, y: origin.y + direction.y, z: origin.z + direction.z }), localOrigin);
  if (Math.abs(localDirection.z) < PARALLEL_EPSILON) return 0;
  let farthest = 0;
  for (const faceZ of [0, part.thickness]) {
    const distance = (faceZ - localOrigin.z) / localDirection.z;
    if (distance <= farthest) continue;
    const point = { x: localOrigin.x + localDirection.x * distance, y: localOrigin.y + localDirection.y * distance };
    const isOnPart = isPointInPolygon(point, part.outline, SEAM_TOLERANCE_MM) && !part.holes.some((hole) => isPointInPolygon(point, hole, 0));
    if (isOnPart) farthest = distance;
  }
  return farthest;
}
