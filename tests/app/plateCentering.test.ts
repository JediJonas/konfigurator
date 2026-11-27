import { describe, expect, it } from 'vitest';
import { measurePlateCenteringOffset, shiftParts, shiftPickAreas } from '../../src/app/three/plateCentering';
import { measurePartsExtent } from '../../src/app/three/viewerFloor';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { transformPoint } from '../../src/core/geometry/matrix';
import { vec3 } from '../../src/core/geometry/vector';
import type { Part } from '../../src/core/model/part';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { designWithExtensions, extension } from '../domains/extensionFixtures';

function footprintBounds(parts: Part[]) {
  const points = parts.flatMap((part) =>
    part.outline.flatMap((point) => [0, part.thickness].map((depth) => transformPoint(part.transform, vec3(point.x, point.y, depth)))),
  );
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

describe('huset står mitt på fatet', () => {
  it('centrerar huset med en tillbyggnad, sett uppifrån', () => {
    const parts = buildParts(designWithExtensions(extension('side-right')), gingerbreadDomain);
    const before = footprintBounds(parts);
    expect(Math.abs(before.minX + before.maxX) + Math.abs(before.minZ + before.maxZ)).toBeGreaterThan(1);
    const centered = shiftParts(parts, measurePlateCenteringOffset(parts));
    const after = footprintBounds(centered);
    expect(after.minX + after.maxX).toBeCloseTo(0, 6);
    expect(after.minZ + after.maxZ).toBeCloseTo(0, 6);
    expect(after.maxX - after.minX).toBeCloseTo(before.maxX - before.minX, 6);
  });

  it('flyttar inte huset i höjdled och fatet blir inte större än det behöver', () => {
    const parts = buildParts(designWithExtensions(extension('side-right')), gingerbreadDomain);
    const centered = shiftParts(parts, measurePlateCenteringOffset(parts));
    expect(measurePartsExtent(centered).heightMm).toBeCloseTo(measurePartsExtent(parts).heightMm, 6);
    expect(measurePartsExtent(centered).reachMm).toBeLessThan(measurePartsExtent(parts).reachMm);
  });

  it('flyttar tryckytorna lika mycket som delarna', () => {
    const areas = [{ instanceId: 'W1', region: [vec3(1, 2, 3), vec3(4, 5, 6), vec3(7, 8, 9)] }];
    expect(shiftPickAreas(areas, { x: -10, z: 20 })[0]?.region[0]).toEqual(vec3(-9, 2, 23));
  });

  it('lämnar ett tomt fat orört', () => {
    expect(measurePlateCenteringOffset([])).toEqual({ x: 0, z: 0 });
  });
});
