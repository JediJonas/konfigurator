import { transformPoint } from '../../src/core/geometry/matrix';
import type { Vec3 } from '../../src/core/geometry/vector';
import { vec3 } from '../../src/core/geometry/vector';
import type { Design } from '../../src/core/model/design';
import type { Part } from '../../src/core/model/part';
import { simpleHousePreset } from '../../src/domains/gingerbread/presets/simpleHouse';

export const THICKNESS = 4;

/** Enkla huset med egna parametrar på sektionen. */
export function houseWith(params: Record<string, unknown>): Design {
  const design = simpleHousePreset.create();
  const section = design.root.children[0];
  if (!section) throw new Error('Mallen saknar sektion');
  section.params = params;
  design.material.thickness = THICKNESS;
  return design;
}

export function partById(parts: readonly Part[], id: string): Part {
  const part = parts.find((candidate) => candidate.id === id);
  if (!part) throw new Error(`Saknar ${id}`);
  return part;
}

/** Hörnen på delens ena sida (z = 0, takets undersida) eller andra, i världen. */
export function worldCorners(part: Part, onFarSide = false): Vec3[] {
  const z = onFarSide ? part.thickness : 0;
  return part.outline.map((point) => transformPoint(part.transform, vec3(point.x, point.y, z)));
}

export function allCorners(part: Part): Vec3[] {
  return [...worldCorners(part), ...worldCorners(part, true)];
}

export function isRoofPart(part: Part): boolean {
  const own = part.id.slice(part.id.indexOf('/') + 1);
  return own.startsWith('roof') || own.startsWith('spire');
}

/** Kanter som två takytor delar, t.ex. nock och valmar, med längden sedd från båda. */
export function countSharedEdges(parts: readonly Part[], toleranceMm = 0.5): number {
  const edges = parts.map((part) => {
    const corners = worldCorners(part);
    return corners.map((start, index) => [start, corners[(index + 1) % corners.length] ?? start] as const);
  });
  const close = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < toleranceMm;
  let shared = 0;
  edges.forEach((own, index) =>
    edges.slice(index + 1).forEach((other) =>
      own.forEach(([a, b]) => {
        if (other.some(([c, d]) => (close(a, c) && close(b, d)) || (close(a, d) && close(b, c)))) shared += 1;
      }),
    ),
  );
  return shared;
}
