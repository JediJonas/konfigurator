import { describe, expect, it } from 'vitest';
import { invertRigidMatrix, transformPoint } from '../../src/core/geometry/matrix';
import { boundsOf } from '../../src/core/geometry/polygon';
import { vec3 } from '../../src/core/geometry/vector';
import type { Part } from '../../src/core/model/part';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { listViolations } from '../../src/core/rules/evaluateDesign';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { arePanesBigEnough, heightAtCenter, listPanes, openingOutline } from '../../src/domains/gingerbread/objects/openings/openingShape';
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

  it('med Fyra rutor skärs fyra rutor och spröjsen blir kvar av väggen', () => {
    const wall = partById(buildParts(designWithExtensions(windowOn('side-right', { mullions: 'four' })), gingerbreadDomain), 'S1/side-right');
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

  it('runt fönster med spröjs ger fyra rutor och kan ha luckor', () => {
    const parts = buildParts(designWithExtensions(windowOn('side-right', { shape: 'circle', mullions: 'four', hasShutters: true })), gingerbreadDomain);
    expect(partById(parts, 'S1/side-right').holes).toHaveLength(4);
    expect(parts.filter((part) => part.id.startsWith('F1/shutter'))).toHaveLength(2);
  });

  it('halvmåne kan ha luckor', () => {
    const parts = buildParts(designWithExtensions(windowOn('side-right', { shape: 'halfMoon', hasShutters: true })), gingerbreadDomain);
    expect(parts.filter((part) => part.id.startsWith('F1/shutter'))).toHaveLength(2);
  });

  it('spetsbåge har raka sidor och en spets mitt över som når fönstrets höjd', () => {
    const outline = openingOutline({ shape: 'pointed', width: 30, height: 60, bottom: 20 });
    const bounds = boundsOf(outline);
    expect([bounds.minX, bounds.maxX]).toEqual([-15, 15]);
    expect([bounds.minY, bounds.maxY]).toEqual([20, 80].map((value) => expect.closeTo(value)));
    const top = outline.find((point) => Math.abs(point.y - 80) < 1e-6);
    expect(top?.x).toBeCloseTo(0);
    // Varje båge har radien lika med bredden, med medelpunkten i motsatta hörnet på bågens fot.
    const spring = 80 - 30 * Math.sqrt(3) / 2;
    for (const point of outline.filter((point) => point.y > spring + 1e-6 && point.x > 0.01)) expect(Math.hypot(point.x + 15, point.y - spring)).toBeCloseTo(30);
  });

  it('spetsbåge som är lägre än bågen trycks ihop så att spetsen når höjden', () => {
    const outline = openingOutline({ shape: 'pointed', width: 40, height: 20, bottom: 10 });
    expect(Math.max(...outline.map((point) => point.y))).toBeCloseTo(30);
    expect(Math.min(...outline.map((point) => point.y))).toBeCloseTo(10);
  });

  it('trekantigt fönster är rätvinkligt med två raka sidor, nederkant och höger', () => {
    expect(openingOutline({ shape: 'triangle', width: 30, height: 40, bottom: 20 })).toEqual([
      { x: -15, y: 20 },
      { x: 15, y: 20 },
      { x: 15, y: 60 },
    ]);
  });

  it('Invertera speglar trekantigt och snedskuret åt andra hållet, med hörnen moturs', () => {
    const triangle = openingOutline({ shape: 'triangle', width: 30, height: 40, bottom: 20, isInverted: true });
    expect(triangle.map((point) => point.x).sort((a, b) => a - b)).toEqual([-15, -15, 15]);
    expect(triangle.find((point) => point.y === 60)?.x).toBe(-15);
    const slanted = openingOutline({ shape: 'slanted', width: 30, height: 40, bottom: 20, isInverted: true });
    expect(slanted.find((point) => point.x === 15 && point.y > 20)?.y).toBe(45);
    for (const outline of [triangle, slanted]) {
      const area = outline.reduce((sum, point, index) => sum + point.x * outline[(index + 1) % outline.length]!.y - outline[(index + 1) % outline.length]!.x * point.y, 0);
      expect(area).toBeGreaterThan(0);
    }
  });

  it.each(['four', 'six'] as const)('rutorna delas från mittlinjen så att alla rader har samma höjd där (%s)', (style) => {
    for (const shape of ['slanted', 'triangle'] as const) {
      const size = { shape, width: 60, height: 90, bottom: 10 };
      const rows = style === 'six' ? 3 : 2;
      const rowHeight = heightAtCenter(size) / rows;
      const starts = Array.from({ length: rows }, (_, index) => 10 + index * rowHeight + (index > 0 ? 2.5 : 0));
      for (const pane of listPanes(size, style).map(boundsOf)) expect(starts.some((start) => Math.abs(start - pane.minY) < 1e-6)).toBe(true);
    }
  });

  it.each([
    ['slanted', false],
    ['slanted', true],
  ] as const)('rutorna intill den lodräta spröjsen är lika höga mot den, spröjsen borträknad (%s, inverterad %s)', (shape, isInverted) => {
    const size = { shape, width: 60, height: 90, bottom: 10, isInverted };
    const panes = listPanes(size, 'two').map(boundsOf);
    expect(panes).toHaveLength(2);
    const [leftPane, rightPane] = panes.sort((a, b) => a.minX - b.minX);
    const sideHeight = (pane: ReturnType<typeof boundsOf>, x: number) => {
      const points = listPanes(size, 'two').flat().filter((point) => Math.abs(point.x - x) < 1e-6);
      expect(points.length).toBeGreaterThan(0);
      return Math.max(...points.map((point) => point.y)) - pane.minY;
    };
    expect(sideHeight(leftPane!, leftPane!.maxX)).toBeCloseTo(sideHeight(rightPane!, rightPane!.minX));
  });

  it('heightAtCenter är hälften för trekantigt och mellan sidorna för snedskuret', () => {
    expect(heightAtCenter({ shape: 'triangle', width: 40, height: 60, bottom: 0 })).toBe(30);
    expect(heightAtCenter({ shape: 'slanted', width: 40, height: 60, bottom: 0 })).toBe(50);
    expect(heightAtCenter({ shape: 'rect', width: 40, height: 60, bottom: 0 })).toBe(60);
  });

  it('rutorna måste vara minst lika stora som spröjsen', () => {
    expect(arePanesBigEnough({ shape: 'rect', width: 40, height: 60, bottom: 0 }, 'six')).toBe(true);
    expect(arePanesBigEnough({ shape: 'rect', width: 14, height: 60, bottom: 0 }, 'two')).toBe(false);
    expect(arePanesBigEnough({ shape: 'rect', width: 40, height: 20, bottom: 0 }, 'six')).toBe(false);
    expect(arePanesBigEnough({ shape: 'rect', width: 10, height: 10, bottom: 0 }, 'none')).toBe(true);
  });

  it('ett fönster med för små rutor är ett fel', () => {
    const design = designWithExtensions(windowOn('side-right', { mullions: 'six', height: 20 }));
    const placed = listViolations(design, gingerbreadDomain, (key) => key);
    expect(placed.some((violation) => violation.message === 'rule.windowPanesTooSmall')).toBe(true);
  });

  it('dörrar kan ha spetsbåge', () => {
    const parts = buildParts(designWithExtensions(doorOn('gable-front', { shape: 'pointed' })), gingerbreadDomain);
    expect(partById(parts, 'D1/leaf').outline.length).toBeGreaterThan(4);
  });

  it('snedskuret fönster har rak underkant och sidor och är lägre åt vänster', () => {
    const outline = openingOutline({ shape: 'slanted', width: 30, height: 40, bottom: 20 });
    expect(outline).toEqual([
      { x: -15, y: 20 },
      { x: 15, y: 20 },
      { x: 15, y: 60 },
      { x: -15, y: 45 },
    ]);
  });

  it('två rutor har en lodrät spröjs i mitten, sex rutor två vågräta till', () => {
    const size = { shape: 'rect' as const, width: 40, height: 60, bottom: 10 };
    const two = listPanes(size, 'two').map(boundsOf);
    expect(two.map((pane) => [pane.minX, pane.maxX])).toEqual([[-20, -2.5], [2.5, 20]].map((pair) => pair.map((value) => expect.closeTo(value))));
    expect(two.every((pane) => pane.minY === 10 && pane.maxY === 70)).toBe(true);
    const six = listPanes(size, 'six');
    expect(six).toHaveLength(6);
    expect(listPanes(size, 'four')).toHaveLength(4);
    expect(listPanes(size, 'none')).toHaveLength(1);
    // Rutorna går inte in i spröjsen: mellan två rutor över varandra är det minst en spröjs bred vägg.
    const rows = [...new Set(six.map((pane) => boundsOf(pane).minY))].sort((a, b) => a - b);
    const lower = six.map(boundsOf).filter((pane) => pane.minY === rows[0]);
    expect(rows[1]! - lower[0]!.maxY).toBeGreaterThanOrEqual(5 - 1e-9);
  });

  it.each(['pointed', 'triangle', 'slanted', 'circle', 'halfMoon', 'arch'] as const)('%s går att sätta spröjs i, och rutorna ligger inom öppningen', (shape) => {
    const size = { shape, width: 40, height: 60, bottom: 10 };
    const outline = boundsOf(openingOutline(size));
    for (const style of ['two', 'four', 'six'] as const) {
      const panes = listPanes(size, style);
      expect(panes.length).toBeGreaterThan(0);
      for (const pane of panes.map(boundsOf)) {
        expect(pane.minX).toBeGreaterThanOrEqual(outline.minX - 1e-9);
        expect(pane.maxX).toBeLessThanOrEqual(outline.maxX + 1e-9);
        expect(pane.minY).toBeGreaterThanOrEqual(outline.minY - 1e-9);
        expect(pane.maxY).toBeLessThanOrEqual(outline.maxY + 1e-9);
      }
    }
  });

  it('hoppar över rutor som är för små att skära, t.ex. i spetsen på ett trekantigt fönster', () => {
    const size = { shape: 'triangle' as const, width: 40, height: 60, bottom: 10 };
    expect(listPanes(size, 'six').length).toBeLessThan(6);
    for (const pane of listPanes(size, 'six').map(boundsOf)) expect(Math.min(pane.maxX - pane.minX, pane.maxY - pane.minY)).toBeGreaterThanOrEqual(5);
  });

  it('nya former bygger delar med hål och luckor i väggen', () => {
    for (const shape of ['pointed', 'triangle', 'slanted'] as const) {
      const parts = buildParts(designWithExtensions(windowOn('side-right', { shape, mullions: 'six', hasShutters: true, width: 60, height: 90, sillHeight: 10 })), gingerbreadDomain);
      expect(partById(parts, 'S1/side-right').holes.length).toBeGreaterThan(1);
      expect(parts.filter((part) => part.id.startsWith('F1/shutter'))).toHaveLength(2);
    }
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
