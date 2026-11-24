import { describe, expect, it } from 'vitest';
import { cameraPositionOutsideParts, CAMERA_CLEARANCE_MM, minimumCameraDistance, prepareClearanceParts } from '../../src/app/three/cameraClearance';
import { basisMatrix } from '../../src/core/geometry/matrix';
import { vec2, vec3 } from '../../src/core/geometry/vector';
import type { Part } from '../../src/core/model/part';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { allCorners, houseWith } from '../domains/roofFixtures';

/** En stående vägg 200 × 100 mm, 4 mm tjock, med insidan vid x = 50 och utsidan vid x = 54. */
const WALL: Part = {
  id: 'test/wall',
  sourceInstanceId: 'test',
  labelKey: 'wall',
  outline: [vec2(-100, 0), vec2(100, 0), vec2(100, 100), vec2(-100, 100)],
  holes: [[vec2(-20, 0), vec2(20, 0), vec2(20, 60), vec2(-20, 60)]],
  thickness: 4,
  transform: basisMatrix(vec3(0, 0, -1), vec3(0, 1, 0), vec3(1, 0, 0), vec3(50, 0, 0)),
  buildStep: 1,
};
const wall = prepareClearanceParts([WALL]);
const target = vec3(0, 70, 0);
const towardWall = vec3(1, 0, 0);

describe('kameran stannar utanför huset', () => {
  it('stannar precis utanför väggens utsida', () => {
    expect(minimumCameraDistance(wall, target, towardWall)).toBeCloseTo(54 + CAMERA_CLEARANCE_MM);
  });

  it('flyttar en kamera inne i huset bakåt längs samma siktlinje', () => {
    const position = cameraPositionOutsideParts(wall, target, vec3(30, 70, 0));
    expect(position).toEqual({ x: 54 + CAMERA_CLEARANCE_MM, y: 70, z: 0 });
  });

  it('låter en kamera utanför huset stå kvar', () => {
    const camera = vec3(300, 70, 0);
    expect(cameraPositionOutsideParts(wall, target, camera)).toBe(camera);
  });

  it('stoppar inte där siktlinjen går genom en öppning', () => {
    expect(minimumCameraDistance(wall, vec3(0, 30, 0), towardWall)).toBe(0);
  });

  it('stoppar inte där siktlinjen går förbi delen', () => {
    expect(minimumCameraDistance(wall, target, vec3(-1, 0, 0))).toBe(0);
    expect(minimumCameraDistance(wall, target, vec3(0, 1, 0))).toBe(0);
  });

  it('stannar utanför både vägg och tak på ett riktigt hus', () => {
    const width = 140;
    const parts = buildParts(houseWith({ width, depth: 180, wallHeight: 100, roofPitch: 45, eaveOverhang: 10, gableOverhang: 10 }), gingerbreadDomain);
    const house = prepareClearanceParts(parts);
    const center = vec3(0, 50, 0);
    const side = cameraPositionOutsideParts(house, center, vec3(1, 50, 0));
    expect(side.x).toBeGreaterThanOrEqual(width / 2 + CAMERA_CLEARANCE_MM);
    const ridgeHeight = Math.max(...parts.flatMap(allCorners).map((corner) => corner.y));
    // Rakt upp går siktlinjen genom fogen i nocken.
    const above = cameraPositionOutsideParts(house, center, vec3(0, 51, 0));
    expect(above.y).toBeGreaterThan(ridgeHeight);
  });
});
