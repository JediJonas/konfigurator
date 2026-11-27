import { describe, expect, it } from 'vitest';
import { invertRigidMatrix, transformPoint } from '../../src/core/geometry/matrix';
import { boundsOf } from '../../src/core/geometry/polygon';
import { vec3 } from '../../src/core/geometry/vector';
import type { Part } from '../../src/core/model/part';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { openingOutline } from '../../src/domains/gingerbread/objects/openings/openingShape';
import type { WindowParams } from '../../src/domains/gingerbread/objects/openings/window';
import { windowSizeOf } from '../../src/domains/gingerbread/objects/openings/window';
import { designWithExtensions } from './extensionFixtures';
import { doorOn, windowOn, WINDOW_PARAMS } from './openingFixtures';
import { partById } from './roofFixtures';

/** Delens hörn i en annan dels egna koordinater, t.ex. en lucka sedd i väggens plan. */
function cornersIn(part: Part, frame: Part) {
  const toFrame = invertRigidMatrix(frame.transform);
  return [0, part.thickness].flatMap((z) => part.outline.map((point) => transformPoint(toFrame, transformPoint(part.transform, vec3(point.x, point.y, z)))));
}

/** Dörren står alltid 30° öppen. */
const OPEN_ANGLE = Math.PI / 6;

/**
 * Ett blad som står 30° ut från väggens utsida (z = tjockleken): den yttre
 * kanten når bladets bredd · sin 30° utanför väggen, och inget går in i huset.
 */
function expectOpenLeaf(leaf: { z: number }[], thickness: number, leafWidth: number) {
  const reach = Math.max(...leaf.map((point) => point.z)) - thickness;
  expect(Math.min(...leaf.map((point) => point.z))).toBeGreaterThan(-0.01);
  expect(reach).toBeGreaterThan(leafWidth * Math.sin(OPEN_ANGLE) - 0.01);
  expect(reach).toBeLessThan(leafWidth * Math.sin(OPEN_ANGLE) + thickness);
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

  it('runt fönster är en cirkel med bredden som diameter, oavsett höjdfältet', () => {
    const params = { ...WINDOW_PARAMS, shape: 'circle', width: 30, height: 80 } as WindowParams;
    const outline = openingOutline(windowSizeOf(params));
    const bounds = boundsOf(outline);
    expect([bounds.minX, bounds.maxX]).toEqual([-15, 15].map((value) => expect.closeTo(value)));
    expect([bounds.minY, bounds.maxY]).toEqual([30, 60].map((value) => expect.closeTo(value)));
    for (const point of outline) expect(Math.hypot(point.x, point.y - 45)).toBeCloseTo(15);
  });

  it('halvmåne är en halvcirkel med rak underkant, hälften så hög som bred', () => {
    const params = { ...WINDOW_PARAMS, shape: 'halfMoon', width: 40, height: 80 } as WindowParams;
    const outline = openingOutline(windowSizeOf(params));
    const bounds = boundsOf(outline);
    expect([bounds.minY, bounds.maxY]).toEqual([30, 50].map((value) => expect.closeTo(value)));
    for (const point of outline.filter((point) => point.y > 30.001)) expect(Math.hypot(point.x, point.y - 30)).toBeCloseTo(20);
  });

  it('runt fönster med spröjs ger fyra rutor och aldrig luckor', () => {
    const parts = buildParts(designWithExtensions(windowOn('side-right', { shape: 'circle', mullions: 'cross', hasShutters: true })), gingerbreadDomain);
    expect(partById(parts, 'S1/side-right').holes).toHaveLength(4);
    expect(parts.filter((part) => part.id.startsWith('F1/shutter'))).toHaveLength(0);
  });

  it('halvmåne kan ha luckor', () => {
    const parts = buildParts(designWithExtensions(windowOn('side-right', { shape: 'halfMoon', hasShutters: true })), gingerbreadDomain);
    expect(parts.filter((part) => part.id.startsWith('F1/shutter'))).toHaveLength(2);
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
  it('som öppning tar upp samma hål men har inget dörrblad', () => {
    const archway = buildParts(designWithExtensions(doorOn('gable-front', { kind: 'opening', shape: 'arch' })), gingerbreadDomain);
    const door = buildParts(designWithExtensions(doorOn('gable-front', { shape: 'arch' })), gingerbreadDomain);
    expect(partById(archway, 'S1/gable-front').outline).toEqual(partById(door, 'S1/gable-front').outline);
    expect(archway.some((part) => part.id === 'D1/leaf')).toBe(false);
  });

  it('går från golvet och har ett blad med samma form, med gångjärnet i öppningens vänstra kant', () => {
    const parts = buildParts(designWithExtensions(doorOn('gable-front', { shape: 'arch' })), gingerbreadDomain);
    const wall = partById(parts, 'S1/gable-front');
    expect(wall.holes).toHaveLength(0);
    expect(Math.min(...wall.outline.map((point) => point.y))).toBeCloseTo(0);
    const leaf = cornersIn(partById(parts, 'D1/leaf'), wall);
    const wallXs = span(wall.outline.map((point) => point.x));
    const middle = (wallXs[0] + wallXs[1]) / 2;
    expect(Math.min(...leaf.map((point) => point.x - middle))).toBeCloseTo(-17.5);
    expectOpenLeaf(leaf, wall.thickness, 35);
    expect(Math.max(...leaf.map((point) => point.y))).toBeCloseTo(60);
  });

  it('som dubbeldörr har två blad, var sin halva, på glänt utåt åt var sitt håll', () => {
    const parts = buildParts(designWithExtensions(doorOn('gable-front', { kind: 'double', shape: 'arch' })), gingerbreadDomain);
    const wall = partById(parts, 'S1/gable-front');
    const wallXs = span(wall.outline.map((point) => point.x));
    const middle = (wallXs[0] + wallXs[1]) / 2;
    const [left, right] = ['D1/leaf-left', 'D1/leaf-right'].map((id) => cornersIn(partById(parts, id), wall));
    expect(Math.min(...(left ?? []).map((point) => point.x - middle))).toBeLessThan(-17.5 + 0.01);
    expect(Math.max(...(right ?? []).map((point) => point.x - middle))).toBeCloseTo(17.5);
    for (const leaf of [left, right]) expectOpenLeaf(leaf ?? [], wall.thickness, 17.5);
    expect(parts.some((part) => part.id === 'D1/leaf')).toBe(false);
  });
});

it('markerar väggarnas och takets insida, men inte luckor och dörrblad', () => {
  const parts = buildParts(designWithExtensions(windowOn('side-right', { hasShutters: true }), doorOn('gable-front')), gingerbreadDomain);
  expect(parts.filter((part) => part.sourceInstanceId === 'S1').every((part) => part.hasInsideAtZero)).toBe(true);
  expect(parts.filter((part) => part.sourceInstanceId !== 'S1').some((part) => part.hasInsideAtZero)).toBe(false);
});
