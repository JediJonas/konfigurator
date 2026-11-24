import { describe, expect, it } from 'vitest';
import { identityMatrix } from '../../src/core/geometry/matrix';
import { vec2 } from '../../src/core/geometry/vector';
import type { Part } from '../../src/core/model/part';
import { buildDrawingPages } from '../../src/core/export/drawingDocument';
import { RULER_LENGTH_MM } from '../../src/core/export/pageFurniture';
import { layoutPartPages, TILE_OVERLAP_MM } from '../../src/core/layout/pageLayout';
import { drawableArea, PAPER_FORMATS } from '../../src/core/layout/paper';
import { groupIdenticalParts } from '../../src/core/layout/partGroups';
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
