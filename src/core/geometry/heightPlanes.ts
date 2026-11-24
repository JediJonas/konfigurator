import type { HalfPlane } from './halfPlane';
import { clipByHalfPlanes } from './halfPlane';
import type { Polygon } from './polygon';
import type { Mm, Vec2, Vec3 } from './vector';
import { vec2, vec3 } from './vector';

/**
 * Ett plan som höjd över ett plant golv: y = slopeX · x + slopeZ · z + height.
 * Används för ytor som lutar, t.ex. ett tak, där den lägsta av flera ytor gäller.
 */
export interface HeightPlane {
  slopeX: number;
  slopeZ: number;
  height: Mm;
}

/** Två planpunkter räknas som samma brytpunkt när de ligger närmare än så. */
const BREAK_TOLERANCE_MM = 1e-6;

export function heightAt(plane: HeightPlane, x: Mm, z: Mm): Mm {
  return plane.slopeX * x + plane.slopeZ * z + plane.height;
}

/** Den lägsta höjden av flera plan i en punkt sett uppifrån, där punktens y är z. */
export function lowestHeightAt(planes: readonly HeightPlane[], point: Vec2): Mm {
  return Math.min(...planes.map((plane) => heightAt(plane, point.x, point.y)));
}

/** Planet genom tre punkter. Punkterna får inte ligga i ett lodrätt plan. */
export function heightPlaneThrough(a: Vec3, b: Vec3, c: Vec3): HeightPlane {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  const normal = { x: uy * vz - uz * vy, y: uz * vx - ux * vz, z: ux * vy - uy * vx };
  const slopeX = -normal.x / normal.y;
  const slopeZ = -normal.z / normal.y;
  return { slopeX, slopeZ, height: a.y - slopeX * a.x - slopeZ * a.z };
}

/**
 * Var ett plan är lägst av alla, sett uppifrån och inom `plan` (en konvex
 * polygon där y är z). Ett tak som vilar på väggarna består av sådana ytor.
 * Polygonen lyfts upp i planet och kan vara tom om planet aldrig är lägst.
 */
export function lowestPlaneRegion(planes: readonly HeightPlane[], index: number, plan: Polygon): Vec3[] {
  const own = planes[index];
  if (!own) return [];
  const halfPlanes: HalfPlane[] = planes
    .filter((_, other) => other !== index)
    // own ≤ other  ⇔  (own.slopeX − other.slopeX) x + (own.slopeZ − other.slopeZ) z ≤ other.height − own.height
    .map((other) => ({ normal: vec2(own.slopeX - other.slopeX, own.slopeZ - other.slopeZ), offset: other.height - own.height }))
    .filter((halfPlane) => halfPlane.normal.x !== 0 || halfPlane.normal.y !== 0 || halfPlane.offset < 0);
  return clipByHalfPlanes(plan, halfPlanes).map((point) => vec3(point.x, heightAt(own, point.x, point.y), point.y));
}

/**
 * Den lägsta höjden längs en rak linje från `start` till `end` sett uppifrån,
 * som brytpunkter (avstånd från `start`, höjd). Mellan brytpunkterna är den rak.
 */
export function lowestProfileAlong(planes: readonly HeightPlane[], start: Vec2, end: Vec2): Vec2[] {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const at = (t: number) => vec2(start.x + t * (end.x - start.x), start.y + t * (end.y - start.y));
  const crossings: number[] = [0, 1];
  planes.forEach((a, i) =>
    planes.slice(i + 1).forEach((b) => {
      // Där två plan är lika höga längs linjen.
      const rise = heightAt(a, end.x, end.y) - heightAt(a, start.x, start.y) - (heightAt(b, end.x, end.y) - heightAt(b, start.x, start.y));
      if (Math.abs(rise) < BREAK_TOLERANCE_MM) return;
      const t = (heightAt(b, start.x, start.y) - heightAt(a, start.x, start.y)) / rise;
      if (t > 0 && t < 1) crossings.push(t);
    }),
  );
  const points = [...new Set(crossings)].sort((a, b) => a - b).map((t) => vec2(t * length, lowestHeightAt(planes, at(t))));
  return removeStraightPoints(points);
}

/** Tar bort punkter som ligger på linjen mellan sina grannar. */
function removeStraightPoints(points: Vec2[]): Vec2[] {
  return points.filter((point, index) => {
    const before = points[index - 1];
    const after = points[index + 1];
    if (!before || !after) return true;
    const expected = before.y + ((point.x - before.x) / (after.x - before.x)) * (after.y - before.y);
    return Math.abs(expected - point.y) > BREAK_TOLERANCE_MM && point.x - before.x > BREAK_TOLERANCE_MM;
  });
}
