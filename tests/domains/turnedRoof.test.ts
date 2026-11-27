import { describe, expect, it } from 'vitest';
import { signedArea } from '../../src/core/geometry/polygon';
import { degreesToRadians } from '../../src/core/geometry/vector';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { evaluateDesign } from '../../src/core/rules/evaluateDesign';
import { proposeChild } from '../../src/core/rules/placement';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { SECTION_TYPE_ID } from '../../src/domains/gingerbread/objects/section';
import { SLOPED_ROOFS } from '../../src/domains/gingerbread/objects/sectionParams';
import { designWithExtensions, extension, EXTENSION_PARAMS, HOST_PARAMS } from './extensionFixtures';
import { allCorners, houseWith, isRoofPart, partById, THICKNESS } from './roofFixtures';

const BASE = { width: 140, depth: 180, wallHeight: 100, roofPitch: 45, eaveOverhang: 10, gableOverhang: 10 };

function partsFor(params: Record<string, unknown>) {
  return buildParts(houseWith({ ...BASE, ...params }), gingerbreadDomain);
}

function errorsFor(design: ReturnType<typeof designWithExtensions>): string[] {
  return evaluateDesign(design, gingerbreadDomain, (key) => key)
    .violations.filter((violation) => violation.level === 'error')
    .map((violation) => violation.message);
}

function extent(parts: ReturnType<typeof partsFor>, id: string, axis: 'x' | 'y' | 'z'): { min: number; max: number } {
  const values = allCorners(partById(parts, id)).map((corner) => corner[axis]);
  return { min: Math.min(...values), max: Math.max(...values) };
}

describe('vridet tak', () => {
  it.each(SLOPED_ROOFS)('%s vridet går att bygga, med delar moturs och utan väggar genom taket', (roof) => {
    const design = houseWith({ ...BASE, roof, isRoofTurned: true });
    const { parts, violations } = evaluateDesign(design, gingerbreadDomain, (key) => key);
    expect(violations).toEqual([]);
    for (const part of parts) expect(signedArea(part.outline)).toBeGreaterThan(0);
    const roofTop = Math.max(...parts.filter(isRoofPart).flatMap(allCorners).map((corner) => corner.y));
    for (const wall of parts.filter((part) => !isRoofPart(part))) expect(extent(parts, wall.id, 'y').max).toBeLessThan(roofTop);
  });

  it.each(SLOPED_ROOFS)('%s vridet har samma delar som taket på ett hus med bredd och längd bytta', (roof) => {
    const turned = partsFor({ roof, isRoofTurned: true });
    const swapped = partsFor({ roof, width: BASE.depth, depth: BASE.width });
    const outlines = (parts: typeof turned) =>
      parts
        .filter(isRoofPart)
        .map((part) => part.outline.map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(' '))
        .sort();
    expect(outlines(turned)).toEqual(outlines(swapped));
  });

  describe('sadeltak', () => {
    const parts = partsFor({ roof: 'gable', isRoofTurned: true });

    it('har nocken tvärs över huset och gavlarna på långsidorna', () => {
      const ridge = BASE.wallHeight + (BASE.depth / 2) * Math.tan(degreesToRadians(BASE.roofPitch));
      expect(extent(parts, 'S1/side-right', 'y').max).toBeCloseTo(ridge);
      expect(extent(parts, 'S1/roof-front', 'z').min).toBeCloseTo(0, 0);
      expect(partById(parts, 'S1/side-right').labelKey).toBe('part.gable');
      expect(partById(parts, 'S1/gable-front').labelKey).toBe('part.sideWall');
    });

    it('låter gavlarna gå ut och de raka väggarna stå mellan (hörnregeln)', () => {
      const right = extent(parts, 'S1/side-right', 'z');
      const front = extent(parts, 'S1/gable-front', 'x');
      expect(right.max - right.min).toBeCloseTo(BASE.depth);
      expect(front.max - front.min).toBeCloseTo(BASE.width - 2 * THICKNESS);
    });
  });

  it.each(['flat', 'spire4', 'spire8'])('%s påverkas inte, eftersom fältet bara gäller tak med lutning', (roof) => {
    expect(partsFor({ roof, isRoofTurned: true })).toEqual(partsFor({ roof }));
  });
});

describe('vridet tak på tillbyggnad', () => {
  it.each(SLOPED_ROOFS)('%s går att bygga och slutar vid värdens vägg eller i rännan', (roof) => {
    const design = designWithExtensions(extension('side-right', { ...EXTENSION_PARAMS, roof, roofPitch: 30, isRoofTurned: true }));
    expect(errorsFor(design)).toEqual([]);
    const parts = buildParts(design, gingerbreadDomain);
    const roofParts = parts.filter((part) => part.sourceInstanceId === 'S2' && isRoofPart(part));
    expect(roofParts.length).toBeGreaterThan(0);
    // Inget av tillbyggnadens tak går in genom värdens vägg under värdens tak.
    const hostWallTop = HOST_PARAMS.wallHeight;
    for (const corner of roofParts.flatMap(allCorners)) {
      if (corner.y < hostWallTop) expect(corner.x).toBeGreaterThan(HOST_PARAMS.width / 2 - 0.01);
    }
  });

  it('sadeltak har nocken längs värdens vägg', () => {
    const design = designWithExtensions(extension('side-right', { ...EXTENSION_PARAMS, isRoofTurned: true }));
    const parts = buildParts(design, gingerbreadDomain);
    expect(parts.filter((part) => part.sourceInstanceId === 'S2' && isRoofPart(part)).map((part) => part.id).sort()).toEqual([
      'S2/roof-back',
      'S2/roof-front',
    ]);
  });

  it('vinkelrännan fungerar mot ett vridet tak på värden', () => {
    const design = designWithExtensions(extension('gable-front', { ...EXTENSION_PARAMS, wallHeight: 60 }));
    const host = design.root.children[0];
    if (host) host.params = { ...HOST_PARAMS, isRoofTurned: true };
    expect(errorsFor(design)).toEqual([]);
  });

  it('en ny tillbyggnad på ett hus med vridet tak får nocken in mot huset', () => {
    const design = designWithExtensions();
    const host = design.root.children[0];
    if (host) host.params = { ...HOST_PARAMS, isRoofTurned: true };
    const proposal = proposeChild(design, gingerbreadDomain, { parentId: 'S1', socketId: 'side-right', objectTypeId: SECTION_TYPE_ID });
    expect(proposal.violations).toEqual([]);
    expect(proposal.instance.params.isRoofTurned).toBe(false);
  });
});
