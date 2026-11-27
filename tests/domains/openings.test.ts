import { describe, expect, it } from 'vitest';
import { invertRigidMatrix, transformPoint } from '../../src/core/geometry/matrix';
import { boundsOf } from '../../src/core/geometry/polygon';
import { vec3 } from '../../src/core/geometry/vector';
import type { Part } from '../../src/core/model/part';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { openingOutline } from '../../src/domains/gingerbread/objects/openings/openingShape';
import { designWithExtensions } from './extensionFixtures';
import { doorOn, windowOn, WINDOW_PARAMS } from './openingFixtures';
import { partById } from './roofFixtures';

/** Delens hörn i en annan dels egna koordinater, t.ex. en lucka sedd i väggens plan. */
function cornersIn(part: Part, frame: Part) {
  const toFrame = invertRigidMatrix(frame.transform);
  return [0, part.thickness].flatMap((z) => part.outline.map((point) => transformPoint(toFrame, transformPoint(part.transform, vec3(point.x, point.y, z)))));
}

function span(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

describe('fönster', () => {
  it('tar upp ett hål i väggen och lämnar väggen hel runt det', () => {
    const wall = partById(buildParts(designWithExtensions(windowOn('side-right')), gingerbreadDomain), 'S1/side-right');
    expect(wall.holes).toHaveLength(1);
    const hole = boundsOf(wall.holes[0] ?? []);
    expect(hole.maxX - hole.minX).toBeCloseTo(WINDOW_PARAMS.width);
    expect([hole.minY, hole.maxY]).toEqual([WINDOW_PARAMS.sillHeight, WINDOW_PARAMS.sillHeight + WINDOW_PARAMS.height]);
  });

  it('med spröjs skärs fyra rutor och spröjsen blir kvar av väggen', () => {
    const wall = partById(buildParts(designWithExtensions(windowOn('side-right', { mullions: 'cross' })), gingerbreadDomain), 'S1/side-right');
    expect(wall.holes).toHaveLength(4);
  });

  it('med rundbåge når bågen fönstrets höjd mitt på', () => {
    const outline = openingOutline({ shape: 'arch', width: 30, height: 40, bottom: 20 });
    expect(Math.max(...outline.map((point) => point.y))).toBeCloseTo(60);
    expect(span(outline.map((point) => point.x))).toEqual([-15, 15]);
    const flat = openingOutline({ shape: 'arch', width: 40, height: 10, bottom: 0 });
    expect(Math.max(...flat.map((point) => point.y))).toBeCloseTo(10);
  });

  it('har luckorna uppslagna mot väggens utsida på var sin sida om fönstret', () => {
    const parts = buildParts(designWithExtensions(windowOn('side-right', { hasShutters: true })), gingerbreadDomain);
    const wall = partById(parts, 'S1/side-right');
    const hole = boundsOf(wall.holes[0] ?? []);
    const [left, right] = ['F1/shutter-left', 'F1/shutter-right'].map((id) => cornersIn(partById(parts, id), wall));
    const xs = [left, right].map((corners) => span((corners ?? []).map((point) => point.x))).sort((a, b) => a[0] - b[0]);
    expect(xs[0]?.[0]).toBeCloseTo(hole.minX - WINDOW_PARAMS.width / 2);
    expect(xs[0]?.[1]).toBeCloseTo(hole.minX);
    expect(xs[1]?.[0]).toBeCloseTo(hole.maxX);
    expect(xs[1]?.[1]).toBeCloseTo(hole.maxX + WINDOW_PARAMS.width / 2);
    // Väggens utsida ligger vid z = tjockleken; luckan ligger utanför den.
    expect(span((left ?? []).map((point) => point.z))).toEqual([wall.thickness, 2 * wall.thickness].map((value) => expect.closeTo(value)));
  });
});

describe('dörr', () => {
  it('går från golvet och har ett blad med samma form som fyller öppningen när det är stängt', () => {
    const parts = buildParts(designWithExtensions(doorOn('gable-front', { shape: 'arch' })), gingerbreadDomain);
    const wall = partById(parts, 'S1/gable-front');
    expect(wall.holes).toHaveLength(0);
    expect(Math.min(...wall.outline.map((point) => point.y))).toBeCloseTo(0);
    const leaf = cornersIn(partById(parts, 'D1/leaf'), wall);
    const wallXs = span(wall.outline.map((point) => point.x));
    const middle = (wallXs[0] + wallXs[1]) / 2;
    expect(span(leaf.map((point) => point.x - middle)).map((value) => Math.round(value * 100) / 100)).toEqual([-17.5, 17.5]);
    expect(span(leaf.map((point) => point.z))).toEqual([0, wall.thickness].map((value) => expect.closeTo(value)));
    expect(Math.max(...leaf.map((point) => point.y))).toBeCloseTo(60);
  });

  it('står på glänt utåt med gångjärnet i öppningens kant', () => {
    for (const hinge of ['left', 'right']) {
      const parts = buildParts(designWithExtensions(doorOn('gable-front', { hinge, openAngle: 90 })), gingerbreadDomain);
      const wall = partById(parts, 'S1/gable-front');
      const leaf = cornersIn(partById(parts, 'D1/leaf'), wall);
      // Helt öppen står bladet vinkelrätt ut från väggen, 35 mm ut.
      expect(Math.max(...leaf.map((point) => point.z))).toBeCloseTo(wall.thickness + 35);
      expect(Math.min(...leaf.map((point) => point.z))).toBeGreaterThan(wall.thickness - 0.01);
    }
  });
});

it('markerar väggarnas och takets insida, men inte luckor och dörrblad', () => {
  const parts = buildParts(designWithExtensions(windowOn('side-right', { hasShutters: true }), doorOn('gable-front')), gingerbreadDomain);
  expect(parts.filter((part) => part.sourceInstanceId === 'S1').every((part) => part.hasInsideAtZero)).toBe(true);
  expect(parts.filter((part) => part.sourceInstanceId !== 'S1').some((part) => part.hasInsideAtZero)).toBe(false);
});
