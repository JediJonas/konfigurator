import { describe, expect, it } from 'vitest';
import { boundsOf, signedArea } from '../../src/core/geometry/polygon';
import type { Vec3 } from '../../src/core/geometry/vector';
import { dot3, subtract3 } from '../../src/core/geometry/vector';
import type { Design } from '../../src/core/model/design';
import type { Socket } from '../../src/core/model/objectType';
import type { Part } from '../../src/core/model/part';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { placeInstances } from '../../src/core/pipeline/placeInstances';
import { addProposedChild } from '../../src/core/rules/addProposedChild';
import { evaluateDesign } from '../../src/core/rules/evaluateDesign';
import { setParamWithinRules } from '../../src/core/rules/paramAdjustment';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { chimneyOn } from './chimneyFixtures';
import { dormerOn } from './dormerFixtures';
import { designWithExtensions } from './extensionFixtures';
import { allCorners, partById } from './roofFixtures';

const keyAsLabel = (key: string) => key;

function roofSocket(design: Design, socketId: string): Socket {
  const house = placeInstances(design, gingerbreadDomain).find((entry) => entry.instance.id === 'S1');
  const socket = house?.sockets.find((candidate) => candidate.id === socketId);
  if (!socket) throw new Error(`Saknar takfallet ${socketId}`);
  return socket;
}

/** Hur långt över takfallets ovansida en punkt ligger, mätt vinkelrätt mot takfallet. */
function heightAboveRoof(socket: Socket, point: Vec3): number {
  const length = Math.hypot(socket.frame.normal.x, socket.frame.normal.y, socket.frame.normal.z);
  return dot3(subtract3(point, socket.frame.origin), socket.frame.normal) / length;
}

function errorKeys(design: Design, instanceId = 'SK1'): string[] {
  return evaluateDesign(design, gingerbreadDomain, keyAsLabel)
    .violations.filter((violation) => violation.level === 'error' && violation.instanceId === instanceId)
    .map((violation) => violation.message);
}

describe('skorsten', () => {
  const design = designWithExtensions(chimneyOn('roof-right'));
  const parts = buildParts(design, gingerbreadDomain);
  const socket = roofSocket(design, 'roof-right');
  const chimneyParts = parts.filter((part) => part.sourceInstanceId === 'SK1');

  it('har fyra sidor och läggs efter huvudtaket i byggordningen', () => {
    expect(chimneyParts.map((part) => [part.id, part.labelKey])).toEqual([
      ['SK1/front', 'part.chimneyFront'],
      ['SK1/back', 'part.chimneyBack'],
      ['SK1/side-right', 'part.chimneySide'],
      ['SK1/side-left', 'part.chimneySide'],
    ]);
    const roofStep = partById(parts, 'S1/roof-right').buildStep;
    expect(chimneyParts.every((part) => part.buildStep > roofStep)).toBe(true);
  });

  it('har sidor med nederkanten snedskuren mot takfallet, så att de står på takytan', () => {
    for (const id of ['SK1/side-right', 'SK1/side-left']) {
      const heights = allCorners(partById(parts, id)).map((corner) => heightAboveRoof(socket, corner));
      expect(Math.min(...heights)).toBeCloseTo(0, 3);
      expect(heights.filter((height) => Math.abs(height) < 1e-3)).toHaveLength(4);
    }
  });

  it('går inte upp genom taket någonstans där det syns, och alla sidor slutar i samma höjd', () => {
    const tops = chimneyParts.map((part) => Math.max(...allCorners(part).map((corner) => corner.y)));
    for (const top of tops) expect(top).toBeCloseTo(tops[0] ?? 0, 3);
  });

  it('är så hög över taket som höjden på baksidan, där taket är högst', () => {
    const side = partById(parts, 'SK1/side-right').outline;
    // Sidans bakre kant går från takytan vid baksidan upp till överkanten.
    expect((side[2]?.y ?? 0) - (side[1]?.y ?? 0)).toBeCloseTo(30);
  });

  it('har fram- och baksidan mellan sidorna, som är lika djupa som skorstenen', () => {
    const front = boundsOf(partById(parts, 'SK1/front').outline);
    expect(front.maxX - front.minX).toBeCloseTo(25 - 2 * 4);
    const side = boundsOf(partById(parts, 'SK1/side-right').outline);
    expect(side.maxX - side.minX).toBeCloseTo(20);
  });

  it('tar inget hål i taket', () => {
    expect(partById(parts, 'S1/roof-right').holes).toEqual([]);
  });

  it('klarar reglerna mitt på takfallet', () => {
    expect(errorKeys(design)).toEqual([]);
  });
});

describe('skorstenens regler', () => {
  it('behöver helt tak mot takfoten och måste ligga under nocken', () => {
    expect(errorKeys(designWithExtensions(chimneyOn('roof-right', { eaveDistance: 0 })))).toContain('rule.chimneyOnRoof');
    expect(errorKeys(designWithExtensions(chimneyOn('roof-right', { eaveDistance: 100 })))).toContain('rule.chimneyOnRoof');
  });

  it('får inte stå på samma yta som en takkupa', () => {
    const design = designWithExtensions(dormerOn('roof-right', { eaveDistance: 40 }), chimneyOn('roof-right', { eaveDistance: 50 }));
    expect(errorKeys(design)).toContain('rule.chimneyOnRoof');
  });

  it('krockar med en takkupas takutsprång som går in i den', () => {
    // Skorstenen står bredvid kupan, så ytorna på taket överlappar inte, men kupans tak når in i den.
    const design = designWithExtensions(dormerOn('roof-right'), chimneyOn('roof-right', { eaveDistance: 25, width: 15, depth: 15 }, 28));
    expect(errorKeys(design)).toEqual(['rule.chimneyMeetsRoof']);
    const apart = designWithExtensions(dormerOn('roof-right'), chimneyOn('roof-right', { eaveDistance: 25, width: 15, depth: 15 }, 40));
    expect(errorKeys(apart)).toEqual([]);
  });
});

describe('ny skorsten', () => {
  it('föreslås högt upp på takfallet och klarar reglerna', () => {
    const design = addProposedChild(designWithExtensions(), gingerbreadDomain, { parentId: 'S1', socketId: 'roof-right', objectTypeId: 'gb.chimney' });
    const chimney = design.root.children[0]?.children.find((child) => child.type === 'gb.chimney');
    expect(chimney).toBeDefined();
    expect(Number(chimney?.params.eaveDistance)).toBeGreaterThan(40);
    expect(evaluateDesign(design, gingerbreadDomain, keyAsLabel).violations.filter((violation) => violation.level === 'error')).toEqual([]);
  });

  it('ärver måtten från förra skorstenen på huset', () => {
    const design = designWithExtensions(chimneyOn('roof-right', { width: 20, depth: 15, height: 40 }));
    const added = addProposedChild(design, gingerbreadDomain, { parentId: 'S1', socketId: 'roof-left', objectTypeId: 'gb.chimney' });
    const second = added.root.children[0]?.children.filter((child) => child.type === 'gb.chimney')[1];
    expect(second?.params).toMatchObject({ width: 20, depth: 15, height: 40 });
  });
});

describe('skorsten mot väggen', () => {
  const onWall = (params: Record<string, unknown> = {}, u = 0) => ({ ...chimneyOn('side-right', { eaveDistance: 0, ...params }, u) });
  const design = designWithExtensions(onWall());
  const parts = buildParts(design, gingerbreadDomain);

  it('står på fatet och går upp förbi husets tak', () => {
    const chimney = parts.filter((part) => part.sourceInstanceId === 'SK1');
    expect(chimney).toHaveLength(4);
    const corners = chimney.flatMap(allCorners);
    expect(Math.min(...corners.map((corner) => corner.y))).toBeCloseTo(0, 3);
    const roofTop = Math.max(...allCorners(partById(parts, 'S1/roof-right')).map((corner) => corner.y));
    expect(Math.max(...corners.map((corner) => corner.y))).toBeCloseTo(roofTop + 30, 0);
  });

  it('ger takutsprånget ett urtag där den går upp, men låter väggen vara', () => {
    const plain = buildParts(designWithExtensions(), gingerbreadDomain);
    const area = (part: Part) => Math.abs(signedArea(part.outline));
    expect(area(partById(parts, 'S1/roof-right'))).toBeLessThan(area(partById(plain, 'S1/roof-right')) - 1);
    expect(partById(parts, 'S1/roof-left').outline).toEqual(partById(plain, 'S1/roof-left').outline);
    expect(partById(parts, 'S1/side-right').holes).toEqual([]);
    expect(errorKeys(design)).toEqual([]);
  });

  it('får flyttas förbi hörnet så länge den har kontakt med väggen', () => {
    // Långväggen är 180 mm; skorstenen är 20 mm bred och långväggen står mellan gavlarna.
    expect(errorKeys(designWithExtensions(onWall({ width: 20 }, 90)))).toEqual([]);
    expect(errorKeys(designWithExtensions(onWall({ width: 20 }, 105)))).toContain('rule.chimneyOnRoof');
  });

  it('får inte täcka ett fönster', () => {
    const window = { id: 'F1', type: 'gb.window', params: { width: 20, height: 25, sillHeight: 40 }, attachment: { socketId: 'side-right', u: 0, v: 0, rotationDegrees: 0 }, children: [] };
    expect(errorKeys(designWithExtensions(window, onWall()))).toContain('rule.chimneyOnRoof');
  });

  it('flyttar ut till väggen under takfoten när avståndet sätts till 0, och upp igen när det ökas', () => {
    const onRoof = designWithExtensions(chimneyOn('roof-right'));
    const down = setParamWithinRules(onRoof, gingerbreadDomain, { instanceId: 'SK1', key: 'eaveDistance', value: 0 });
    expect(findChimney(down)?.attachment?.socketId).toBe('side-right');
    const up = setParamWithinRules(down, gingerbreadDomain, { instanceId: 'SK1', key: 'eaveDistance', value: 60 });
    expect(findChimney(up)?.attachment?.socketId).toBe('roof-right');
  });

  it('läggs till mot väggen när man trycker på knappen under väggen', () => {
    const added = addProposedChild(designWithExtensions(), gingerbreadDomain, { parentId: 'S1', socketId: 'side-right', objectTypeId: 'gb.chimney' });
    expect(findChimney(added)?.attachment?.socketId).toBe('side-right');
    expect(findChimney(added)?.params.eaveDistance).toBe(0);
    expect(evaluateDesign(added, gingerbreadDomain, keyAsLabel).violations.filter((violation) => violation.level === 'error')).toEqual([]);
  });
});

function findChimney(design: Design) {
  return design.root.children[0]?.children.find((child) => child.type === 'gb.chimney');
}
