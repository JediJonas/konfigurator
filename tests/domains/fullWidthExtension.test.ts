import { describe, expect, it } from 'vitest';
import { groupIdenticalParts } from '../../src/core/layout/partGroups';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { evaluateDesign } from '../../src/core/rules/evaluateDesign';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { OPENING_INSET_MM } from '../../src/domains/gingerbread/objects/sectionSockets';
import { designWithExtensions, extension, EXTENSION_PARAMS, HOST_PARAMS } from './extensionFixtures';
import { allCorners, isRoofPart, partById } from './roofFixtures';

const THICKNESS = 4;
/** Tillbyggnadens takutsprång är större än värdens vid gaveln, så att det går förbi värdens tak. */
const WIDE_OVERHANG = { ...EXTENSION_PARAMS, eaveOverhang: 20 };

function errorsFor(design: ReturnType<typeof designWithExtensions>): string[] {
  return evaluateDesign(design, gingerbreadDomain, (key) => key)
    .violations.filter((violation) => violation.level === 'error')
    .map((violation) => violation.message);
}

describe('tillbyggnad lika bred som väggen (ägarens val)', () => {
  it('ryms från hörn till hörn på långväggen och gaveln, men inte bredare', () => {
    expect(errorsFor(designWithExtensions(extension('side-right', { ...EXTENSION_PARAMS, width: HOST_PARAMS.depth })))).toEqual([]);
    expect(errorsFor(designWithExtensions(extension('gable-front', { ...EXTENSION_PARAMS, width: HOST_PARAMS.width })))).toEqual([]);
    expect(errorsFor(designWithExtensions(extension('side-right', { ...EXTENSION_PARAMS, width: HOST_PARAMS.depth + 5 })))).toContain('rule.extensionFitsWall');
  });

  it('lämnar värdens vägg hel runt öppningen, med en kant vid hörnen', () => {
    const parts = buildParts(designWithExtensions(extension('side-right', { ...EXTENSION_PARAMS, width: HOST_PARAMS.depth })), gingerbreadDomain);
    const wall = partById(parts, 'S1/side-right');
    const xs = wall.outline.map((point) => point.x);
    // Långväggen står mellan gavlarna och är 2 × tjockleken kortare. Öppningen följer tillbyggnadens insida, 10 mm mindre.
    const wallLength = Math.max(...xs) - Math.min(...xs);
    expect(wallLength).toBeCloseTo(HOST_PARAMS.depth - 2 * THICKNESS);
    const openingCorners = wall.outline.filter((point) => point.y < 0.01 && Math.abs(point.x - (Math.max(...xs) + Math.min(...xs)) / 2) < wallLength / 2 - 0.01);
    const openingWidth = Math.max(...openingCorners.map((point) => point.x)) - Math.min(...openingCorners.map((point) => point.x));
    expect(openingWidth).toBeCloseTo(HOST_PARAMS.depth - 2 * THICKNESS - 2 * OPENING_INSET_MM);
  });

  it('låter inte det förlängda taket sticka in bredvid värdens tak när takutsprånget går förbi hörnet', () => {
    const parts = buildParts(designWithExtensions(extension('side-right', { ...WIDE_OVERHANG, width: HOST_PARAMS.depth })), gingerbreadDomain);
    const hostRoofHalfLength = HOST_PARAMS.depth / 2 + HOST_PARAMS.gableOverhang;
    const insideHost = parts
      .filter((part) => part.id.startsWith('S2/') && isRoofPart(part))
      .flatMap(allCorners)
      .filter((corner) => corner.x < HOST_PARAMS.width / 2 - 0.01);
    expect(insideHost.length).toBeGreaterThan(0);
    expect(Math.max(...insideHost.map((corner) => Math.abs(corner.z)))).toBeLessThanOrEqual(hostRoofHalfLength + 0.01);
  });

  it('låter inte det förlängda taket gå in längs gaveln under värdens takutsprång', () => {
    const parts = buildParts(designWithExtensions(extension('side-right', { ...WIDE_OVERHANG, width: HOST_PARAMS.depth - 20 })), gingerbreadDomain);
    const besideGable = parts
      .filter((part) => part.id.startsWith('S2/') && isRoofPart(part))
      .flatMap(allCorners)
      .filter((corner) => Math.abs(corner.z) > HOST_PARAMS.depth / 2 + 0.01);
    expect(Math.min(...besideGable.map((corner) => corner.x))).toBeGreaterThanOrEqual(HOST_PARAMS.width / 2 - 0.01);
  });

  it('ritar tillbyggnadens takhalvor som ett spegelvänt par', () => {
    const parts = buildParts(designWithExtensions(extension('side-right', { ...WIDE_OVERHANG, width: HOST_PARAMS.depth })), gingerbreadDomain);
    const roofGroups = groupIdenticalParts(parts).filter((group) => group.partIds.some((id) => id.startsWith('S2/roof')));
    expect(roofGroups.map((group) => [group.count, group.mirroredCount])).toEqual([[2, 1]]);
  });
});
