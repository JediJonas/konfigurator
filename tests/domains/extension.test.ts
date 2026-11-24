import { describe, expect, it } from 'vitest';
import { transformPoint } from '../../src/core/geometry/matrix';
import { boundsOf, edgeLengths, signedArea } from '../../src/core/geometry/polygon';
import type { Vec3 } from '../../src/core/geometry/vector';
import { vec3 } from '../../src/core/geometry/vector';
import type { Part } from '../../src/core/model/part';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { designWithExtensions, extension, EXTENSION_PARAMS, HOST_PARAMS } from './extensionFixtures';

const THICKNESS = 4;

function partById(parts: Part[], id: string): Part {
  const part = parts.find((candidate) => candidate.id === id);
  if (!part) throw new Error(`Saknar ${id}`);
  return part;
}

function worldCorners(part: Part): Vec3[] {
  return [0, part.thickness].flatMap((z) => part.outline.map((p) => transformPoint(part.transform, vec3(p.x, p.y, z))));
}

describe('tillbyggnad på långväggen', () => {
  const parts = buildParts(designWithExtensions(extension('side-right')), gingerbreadDomain);

  it('har ingen egen vägg mot huset', () => {
    const own = parts.filter((part) => part.sourceInstanceId === 'S2').map((part) => part.id);
    expect(own.sort()).toEqual(['S2/gable-front', 'S2/roof-left', 'S2/roof-right', 'S2/side-left', 'S2/side-right']);
  });

  it('står upprätt med framgaveln rakt ut från väggen', () => {
    const xs = worldCorners(partById(parts, 'S2/gable-front')).map((p) => p.x);
    expect(Math.max(...xs)).toBeCloseTo(HOST_PARAMS.width / 2 + EXTENSION_PARAMS.depth);
    const ys = worldCorners(partById(parts, 'S2/side-right')).map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(0);
    expect(Math.max(...ys)).toBeCloseTo(EXTENSION_PARAMS.wallHeight);
  });

  it('låter långväggarna gå stumt mot husets vägg', () => {
    for (const id of ['S2/side-left', 'S2/side-right']) {
      const xs = worldCorners(partById(parts, id)).map((p) => p.x);
      expect(Math.min(...xs)).toBeCloseTo(HOST_PARAMS.width / 2);
    }
  });

  it('låter taket sluta mot husets vägg utan takutsprång', () => {
    const xs = worldCorners(partById(parts, 'S2/roof-right')).map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(HOST_PARAMS.width / 2);
    expect(Math.max(...xs)).toBeCloseTo(HOST_PARAMS.width / 2 + EXTENSION_PARAMS.depth + EXTENSION_PARAMS.gableOverhang);
  });

  it('tar upp en öppning i husets vägg som är lika bred som tillbyggnadens insida', () => {
    const wall = partById(parts, 'S1/side-right');
    const untouched = partById(parts, 'S1/side-left');
    const openingArea = Math.abs(signedArea(untouched.outline)) - Math.abs(signedArea(wall.outline));
    const innerWidth = EXTENSION_PARAMS.width - 2 * THICKNESS;
    const sideTop = EXTENSION_PARAMS.wallHeight + THICKNESS;
    const ridge = EXTENSION_PARAMS.wallHeight + EXTENSION_PARAMS.width / 2;
    const expected = innerWidth * sideTop + (innerWidth / 2) * (ridge - sideTop);
    expect(openingArea).toBeCloseTo(expected, 1);
    expect(wall.holes).toEqual([]);
  });

  it('behåller väggens yttermått, så att den fortfarande möter gavlarna', () => {
    const wall = partById(parts, 'S1/side-right');
    expect(boundsOf(wall.outline)).toEqual(boundsOf(partById(parts, 'S1/side-left').outline));
  });

  it('ger öppningen samma kantlängder som tillbyggnadens tvärsnitt där de möts', () => {
    const lengths = edgeLengths(partById(parts, 'S1/side-right').outline).map((length) => Math.round(length * 10) / 10);
    const slope = Math.hypot(EXTENSION_PARAMS.width / 2 - THICKNESS, EXTENSION_PARAMS.width / 2 - THICKNESS);
    expect(lengths).toContain(Math.round(slope * 10) / 10);
  });
});

describe('tillbyggnad på framgaveln', () => {
  const parts = buildParts(designWithExtensions(extension('gable-front')), gingerbreadDomain);

  it('står framför gaveln', () => {
    const zs = worldCorners(partById(parts, 'S2/gable-front')).map((p) => p.z);
    expect(Math.max(...zs)).toBeCloseTo(HOST_PARAMS.depth / 2 + EXTENSION_PARAMS.depth);
  });

  it('tar upp en öppning i gaveln', () => {
    const gable = partById(parts, 'S1/gable-front');
    expect(Math.abs(signedArea(gable.outline))).toBeLessThan(Math.abs(signedArea(partById(parts, 'S1/gable-back').outline)));
  });
});

describe('tillbyggnad på en tillbyggnad', () => {
  it('sitter på tillbyggnadens vägg och tar upp en öppning där', () => {
    const inner = extension('side-right', { ...EXTENSION_PARAMS, width: 60, wallHeight: 40, roofPitch: 40 }, 0, 'S3');
    const outer = { ...extension('gable-front', { ...EXTENSION_PARAMS, depth: 120, wallHeight: 80 }), children: [inner] };
    const parts = buildParts(designWithExtensions(outer), gingerbreadDomain);
    expect(parts.some((part) => part.id === 'S3/gable-front')).toBe(true);
    expect(partById(parts, 'S2/side-right').outline.length).toBeGreaterThan(4);
  });
});
