import { describe, expect, it } from 'vitest';
import { identityMatrix } from '../../src/core/geometry/matrix';
import { vec2 } from '../../src/core/geometry/vector';
import type { Part } from '../../src/core/model/part';
import { buildDrawingPages } from '../../src/core/export/drawingDocument';
import { RULER_LENGTH_MM } from '../../src/core/export/pageFurniture';
import { layoutPartPages, TILE_OVERLAP_MM } from '../../src/core/layout/pageLayout';
import { drawableArea, PAPER_FORMATS } from '../../src/core/layout/paper';
import { describeGroup, groupIdenticalParts } from '../../src/core/layout/partGroups';
import { designWithExtensions, extension } from '../domains/extensionFixtures';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { simpleHousePreset } from '../../src/domains/gingerbread/presets/simpleHouse';

function rectanglePart(id: string, width: number, height: number): Part {
  return {
    id,
    sourceInstanceId: 'X',
    labelKey: 'part.test',
    outline: [vec2(0, 0), vec2(width, 0), vec2(width, height), vec2(0, height)],
    holes: [],
    thickness: 4,
    transform: identityMatrix(),
    buildStep: 1,
  };
}

describe('dellista', () => {
  it('slår ihop delar med samma form och räknar dem', () => {
    const groups = groupIdenticalParts(buildParts(simpleHousePreset.create(), gingerbreadDomain));
    expect(groups.map((group) => [group.labelKey, group.count])).toEqual([
      ['part.sideWall', 2],
      ['part.gable', 2],
      ['part.roof', 2],
    ]);
  });
});

describe('delar med samma form', () => {
  const triangle = (id: string, points: [number, number][]): Part => ({ ...rectanglePart(id, 1, 1), outline: points.map(([x, y]) => vec2(x, y)) });

  it('räknas som samma oavsett var konturen börjar', () => {
    const groups = groupIdenticalParts([triangle('a', [[0, 0], [40, 0], [10, 30]]), triangle('b', [[40, 0], [10, 30], [0, 0]])]);
    expect(groups.map((group) => [group.count, group.mirroredCount])).toEqual([[2, 0]]);
  });

  it('räknas som samma oavsett i vilken ordning hålen kommer, men inte med hålen på andra ställen', () => {
    const hole = (x: number) => [vec2(x, 10), vec2(x, 20), vec2(x + 10, 20), vec2(x + 10, 10)];
    const wall = (id: string, holes: ReturnType<typeof hole>[]): Part => ({ ...rectanglePart(id, 100, 50), holes });
    expect(groupIdenticalParts([wall('a', [hole(10), hole(30)]), wall('b', [hole(30), hole(10)])]).map((group) => group.count)).toEqual([2]);
    expect(groupIdenticalParts([wall('a', [hole(10), hole(30)]), wall('b', [hole(10), hole(50)])]).map((group) => group.count)).toEqual([1, 1]);
  });

  it('slås ihop med sin spegelbild och räknas som spegelvänd', () => {
    const groups = groupIdenticalParts([triangle('a', [[0, 0], [40, 0], [10, 30]]), triangle('b', [[0, 0], [40, 0], [30, 30]])]);
    expect(groups.map((group) => [group.count, group.mirroredCount])).toEqual([[2, 1]]);
  });

  it('skriver hur många som skärs spegelvända', () => {
    const groups = groupIdenticalParts([triangle('a', [[0, 0], [40, 0], [10, 30]]), triangle('b', [[0, 0], [40, 0], [30, 30]])]);
    const [page] = layoutPartPages(groups, PAPER_FORMATS.A4);
    const pages = buildDrawingPages({
      parts: [triangle('a', [[0, 0], [40, 0], [10, 30]]), triangle('b', [[0, 0], [40, 0], [30, 30]])],
      paper: PAPER_FORMATS.A4,
      resolveLabel: (key) => key,
      overview: { title: 'Hus', materialLabel: 'Deg', thickness: 4, buildSteps: [], notes: [] },
    });
    expect(page?.shapes).toHaveLength(1);
    expect(pages.join('')).toContain('skär 2 st, varav 1 spegelvänd');
  });
});

describe('ritning med tillbyggnad', () => {
  const parts = buildParts(designWithExtensions(extension('side-right')), gingerbreadDomain);
  const groups = groupIdenticalParts(parts);

  it('ritar väggen med öppning för sig och den hela långväggen för sig', () => {
    const sideWalls = groups.filter((group) => group.labelKey === 'part.sideWall');
    expect(sideWalls.map((group) => group.partIds)).toEqual([['S1/side-right'], ['S1/side-left'], ['S2/side-right', 'S2/side-left']]);
  });

  it('skriver vilket objekt delarna hör till när det finns flera', () => {
    const [first] = groups;
    if (!first) throw new Error('Inga delar');
    expect(describeGroup(first, groups, 'Långvägg')).toBe('Långvägg (S1)');
    const single = groupIdenticalParts(buildParts(simpleHousePreset.create(), gingerbreadDomain));
    expect(describeGroup(single[0] ?? first, single, 'Långvägg')).toBe('Långvägg');
  });

  it('ger en sida per del med namnen', () => {
    const pages = buildDrawingPages({
      parts,
      paper: PAPER_FORMATS.A4,
      resolveLabel: (key) => key,
      overview: { title: 'Hus', materialLabel: 'Deg', thickness: 4, buildSteps: [], notes: [] },
    });
    expect(pages.join('')).toContain('part.gable (S2)');
  });
});

describe('sidindelning', () => {
  const a4 = PAPER_FORMATS.A4;

  it('lägger små delar på samma sida', () => {
    const groups = groupIdenticalParts([rectanglePart('a', 50, 40), rectanglePart('b', 60, 30)]);
    expect(layoutPartPages(groups, a4)).toHaveLength(1);
  });

  it('vrider en lång del så att den ryms på en sida', () => {
    const pages = layoutPartPages(groupIdenticalParts([rectanglePart('a', 250, 100)]), a4);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.shapes[0]?.isRotated).toBe(true);
  });

  it('delar upp en stor del i bitar som överlappar 10 mm', () => {
    const area = drawableArea(a4);
    const pages = layoutPartPages(groupIdenticalParts([rectanglePart('a', 300, 400)]), a4);
    expect(pages.length).toBeGreaterThan(1);
    const [first, second] = pages.map((page) => page.shapes[0]);
    if (!first?.tile || !second?.tile) throw new Error('Bitarna saknar skarvinfo');
    const shift = (first.outline[0]?.x ?? 0) - (second.outline[0]?.x ?? 0);
    expect(shift).toBeCloseTo(area.width - TILE_OVERLAP_MM);
    expect(first.tile.joinLines.length).toBeGreaterThan(0);
  });

  it('ritar delarna i skala 1:1', () => {
    const pages = layoutPartPages(groupIdenticalParts([rectanglePart('a', 123, 45)]), a4);
    const xs = pages[0]?.shapes[0]?.outline.map((p) => p.x) ?? [];
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(123);
  });
});

describe('ritningens sidor', () => {
  const pages = buildDrawingPages({
    parts: buildParts(simpleHousePreset.create(), gingerbreadDomain),
    paper: PAPER_FORMATS.A4,
    resolveLabel: (key) => gingerbreadDomain.strings[key] ?? key,
    overview: { title: 'Test', materialLabel: 'Deg', thickness: 4, buildSteps: [{ step: 1, label: 'Väggar' }], notes: [] },
  });

  it('har en översiktssida och sidor med delar', () => {
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[0]).toContain('Delar');
  });

  it('har en 10 cm kontrollinjal och utskriftstexten på varje sida', () => {
    for (const page of pages) {
      expect(page).toContain('Skriv ut i faktisk storlek / 100 %');
      expect(page).toContain(`x2="${10 + RULER_LENGTH_MM}"`);
    }
  });

  it('har sidan i millimeter', () => {
    expect(pages[0]).toContain('width="210mm" height="297mm" viewBox="0 0 210 297"');
  });

  it('skriver antal att skära', () => {
    expect(pages.slice(1).join('')).toContain('skär 2 st');
  });
});
