import { describe, expect, it } from 'vitest';
import { signedArea } from '../../src/core/geometry/polygon';
import { degreesToRadians, dot3 } from '../../src/core/geometry/vector';
import type { Vec3 } from '../../src/core/geometry/vector';
import { groupIdenticalParts } from '../../src/core/layout/partGroups';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { placeInstances } from '../../src/core/pipeline/placeInstances';
import { evaluateDesign } from '../../src/core/rules/evaluateDesign';
import { proposeChild } from '../../src/core/rules/placement';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { OPENING_INSET_MM } from '../../src/domains/gingerbread/objects/sectionSockets';
import { SECTION_TYPE_ID } from '../../src/domains/gingerbread/objects/section';
import { designWithExtensions, extension, EXTENSION_PARAMS, HOST_PARAMS } from './extensionFixtures';
import { allCorners, partById, worldCorners } from './roofFixtures';

void signedArea;

const HOST_HALF_WIDTH = HOST_PARAMS.width / 2;
const PITCH = degreesToRadians(HOST_PARAMS.roofPitch);
/** Ovansidan på husets högra takhalva: undersidan genom väggens yttre överkant, flyttad tjockleken utåt. */
function hostRoofTop(x: number): number {
  return HOST_PARAMS.wallHeight + (HOST_HALF_WIDTH - x) * Math.tan(PITCH) + 4 / Math.cos(PITCH);
}

function errorsFor(design: ReturnType<typeof designWithExtensions>): string[] {
  return evaluateDesign(design, gingerbreadDomain, (key) => key)
    .violations.filter((violation) => violation.level === 'error')
    .map((violation) => violation.message);
}

/** Hörn på tillbyggnadens takundersida som ligger på husets tak, dvs. längs rännan. */
function valleyCorners(parts: ReturnType<typeof buildParts>, id: string): Vec3[] {
  return worldCorners(partById(parts, id)).filter((corner) => corner.x < HOST_HALF_WIDTH + 10 && Math.abs(corner.y - hostRoofTop(corner.x)) < 0.1);
}

describe('vinkelränna mot en hög tillbyggnad på långväggen', () => {
  const high = { ...EXTENSION_PARAMS, wallHeight: 80 };
  const design = designWithExtensions(extension('side-right', high));
  const parts = buildParts(design, gingerbreadDomain);

  it('går att bygga', () => {
    expect(errorsFor(design)).toEqual([]);
  });

  it('lämnar huvudhusets tak helt (snickarmetoden)', () => {
    const alone = buildParts(designWithExtensions(), gingerbreadDomain);
    for (const id of ['S1/roof-right', 'S1/roof-left']) expect(partById(parts, id)).toEqual(partById(alone, id));
  });

  it('lägger tillbyggnadens tak på huvudtakets ovansida längs rännan', () => {
    // Rännan går från takfoten upp till tillbyggnadens nock.
    const corners = valleyCorners(parts, 'S2/roof-right');
    expect(corners.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...corners.map((corner) => corner.y))).toBeCloseTo(high.wallHeight + EXTENSION_PARAMS.width / 2);
  });

  it('ger rännan 45° sett uppifrån när lutningarna är lika', () => {
    const [low, top] = [...valleyCorners(parts, 'S2/roof-right')].sort((a, b) => a.y - b.y);
    if (!low || !top) throw new Error('Rännan saknar två hörn');
    expect(Math.abs((top.z - low.z) / (top.x - low.x))).toBeCloseTo(1, 3);
  });

  it('ritar tillbyggnadens takhalvor som ett spegelvänt par', () => {
    const roofGroups = groupIdenticalParts(parts).filter((group) => group.partIds.some((id) => id.startsWith('S2/roof')));
    expect(roofGroups.map((group) => [group.count, group.mirroredCount])).toEqual([[2, 1]]);
  });

  it('lämnar 10 mm av husets vägg under överkanten, så att väggen inte delas', () => {
    const wall = partById(parts, 'S1/side-right');
    expect(wall.holes).toEqual([]);
    const openingTop = Math.max(...wall.outline.filter((point) => point.y < HOST_PARAMS.wallHeight - 0.01).map((point) => point.y));
    expect(openingTop).toBeCloseTo(HOST_PARAMS.wallHeight - OPENING_INSET_MM);
  });
});

describe('vinkelränna när tillbyggnaden är lika hög som huset', () => {
  const same = { ...EXTENSION_PARAMS, wallHeight: HOST_PARAMS.wallHeight };
  const parts = buildParts(designWithExtensions(extension('side-right', same)), gingerbreadDomain);

  it('kapar tillbyggnadens väggar där de skulle gå upp i husets takutsprång', () => {
    const wall = partById(parts, 'S2/side-right');
    // Under takutsprånget (10 mm längs lutningen) följer väggens överkant takets undersida ner.
    const underOverhang = allCorners(wall).filter((corner) => corner.x > HOST_HALF_WIDTH + 1 && corner.x < HOST_HALF_WIDTH + 10);
    expect(Math.min(...underOverhang.map((corner) => corner.y))).toBeLessThan(HOST_PARAMS.wallHeight - 5);
    expect(Math.max(...allCorners(wall).map((corner) => corner.y))).toBeCloseTo(HOST_PARAMS.wallHeight);
  });

  it('ger korstak med nockarna på samma höjd när bredd och lutning är lika', () => {
    const cross = { ...same, width: HOST_PARAMS.width, roofPitch: HOST_PARAMS.roofPitch };
    const design = designWithExtensions(extension('side-right', cross));
    expect(errorsFor(design)).toEqual([]);
    const crossParts = buildParts(design, gingerbreadDomain);
    const ridge = (id: string) => Math.max(...worldCorners(partById(crossParts, id)).map((corner) => corner.y));
    expect(ridge('S2/roof-right')).toBeCloseTo(ridge('S1/roof-right'));
    // Rännorna möts vid husets nock: tillbyggnadens tak når nästan in till mitten.
    const reach = Math.min(...worldCorners(partById(crossParts, 'S2/roof-right')).map((corner) => corner.x));
    expect(reach).toBeGreaterThan(0);
    expect(reach).toBeLessThan(10);
  });
});

describe('tillbyggnad som går över huset', () => {
  it('stoppas när nocken går över huvudhusets nock', () => {
    const wide = { ...EXTENSION_PARAMS, width: HOST_PARAMS.width + 10, wallHeight: HOST_PARAMS.wallHeight };
    expect(errorsFor(designWithExtensions(extension('side-right', wide)))).toContain('rule.extensionFitsWall');
  });

  it('låter inte det förlängda taket sticka ut genom huset medan felet visas', () => {
    const steep = { ...EXTENSION_PARAMS, roof: 'shed', roofPitch: 60, wallHeight: 80 };
    const parts = buildParts(designWithExtensions(extension('side-right', steep)), gingerbreadDomain);
    expect(Math.min(...allCorners(partById(parts, 'S2/roof')).map((corner) => corner.x))).toBeGreaterThanOrEqual(-HOST_HALF_WIDTH - 0.01);
  });
});

describe('pulpettak som stiger in mot huset', () => {
  it.each([20, 32, 39, 41])('slutar vid gaveln och går inte upp genom huvudtaket vid %s°', (roofPitch) => {
    const design = designWithExtensions(extension('gable-front', { ...EXTENSION_PARAMS, roof: 'shed', roofPitch, wallHeight: 60 }));
    expect(errorsFor(design)).toEqual([]);
    const gable = placeInstances(design, gingerbreadDomain).find((entry) => entry.instance.id === 'S2')?.socket;
    if (!gable) throw new Error('Tillbyggnaden saknar kopplingspunkt');
    const wallPlane = dot3(gable.frame.normal, gable.frame.origin);
    const parts = buildParts(design, gingerbreadDomain);
    const innermost = Math.min(...allCorners(partById(parts, 'S2/roof')).map((corner) => dot3(gable.frame.normal, corner)));
    expect(innermost).toBeGreaterThanOrEqual(wallPlane - 0.01);
  });
});

describe('vinkelrännor mot andra taktyper', () => {
  it.each(['hip', 'mansard', 'shed', 'flat', 'spire4', 'spire8'])('klipper tillbyggnadens tak mot ett hus med %s', (roof) => {
    const design = designWithExtensions(extension('side-right', { ...EXTENSION_PARAMS, wallHeight: 60 }));
    const host = design.root.children[0];
    if (!host) throw new Error('Mallen saknar sektion');
    host.params = { ...HOST_PARAMS, roof, roofPitch: 30 };
    expect(errorsFor(design)).toEqual([]);
    const parts = buildParts(design, gingerbreadDomain);
    const roofParts = parts.filter((part) => part.id.startsWith('S2/roof'));
    expect(roofParts).toHaveLength(2);
    for (const part of roofParts) {
      expect(signedArea(part.outline)).toBeGreaterThan(0);
      // Taket slutar inne över huset eller mot väggen, aldrig bortom husets mitt.
      expect(Math.min(...allCorners(part).map((corner) => corner.x))).toBeGreaterThan(-1);
    }
  });
});

describe('tornspira', () => {
  it('kan inte vara tillbyggnad', () => {
    const design = designWithExtensions(extension('side-right', { ...EXTENSION_PARAMS, roof: 'spire4' }));
    expect(errorsFor(design)).toContain('rule.noSpireOnExtension');
  });

  it('ärvs inte av en ny tillbyggnad, som får sadeltak i stället', () => {
    const design = designWithExtensions();
    const host = design.root.children[0];
    if (!host) throw new Error('Mallen saknar sektion');
    host.params = { ...HOST_PARAMS, roof: 'spire4', width: 140, depth: 180 };
    const proposal = proposeChild(design, gingerbreadDomain, { parentId: 'S1', socketId: 'side-right', objectTypeId: SECTION_TYPE_ID });
    expect(proposal.violations).toEqual([]);
    expect(proposal.instance.params.roof).toBe('gable');
  });
});
