import { describe, expect, it } from 'vitest';
import { invertRigidMatrix, transformPoint } from '../../src/core/geometry/matrix';
import { boundsOf, signedArea } from '../../src/core/geometry/polygon';
import type { Vec3 } from '../../src/core/geometry/vector';
import { dot3, subtract3 } from '../../src/core/geometry/vector';
import type { Design } from '../../src/core/model/design';
import type { Socket } from '../../src/core/model/objectType';
import type { Part } from '../../src/core/model/part';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { placeInstances } from '../../src/core/pipeline/placeInstances';
import { evaluateDesign } from '../../src/core/rules/evaluateDesign';
import { setParamWithinRules } from '../../src/core/rules/paramAdjustment';
import { proposeChild } from '../../src/core/rules/placement';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { ROOF_SURFACE } from '../../src/domains/gingerbread/socketKinds';
import { dormerOn } from './dormerFixtures';
import { designWithExtensions, extension, HOST_PARAMS } from './extensionFixtures';
import { houseWith, partById, worldCorners } from './roofFixtures';

const keyAsLabel = (key: string) => key;

function roofSockets(design: Design): Socket[] {
  const house = placeInstances(design, gingerbreadDomain).find((entry) => entry.instance.id === 'S1');
  return house?.sockets.filter((socket) => socket.kind === ROOF_SURFACE) ?? [];
}

function errorKeys(design: Design, instanceId = 'K1'): string[] {
  return evaluateDesign(design, gingerbreadDomain, keyAsLabel)
    .violations.filter((violation) => violation.level === 'error' && violation.instanceId === instanceId)
    .map((violation) => violation.message);
}

/** Hur långt över takfallets ovansida en punkt ligger, mätt vinkelrätt mot takfallet. */
function heightAboveRoof(socket: Socket, point: Vec3): number {
  const length = Math.hypot(socket.frame.normal.x, socket.frame.normal.y, socket.frame.normal.z);
  return dot3(subtract3(point, socket.frame.origin), socket.frame.normal) / length;
}

function socketById(design: Design, socketId: string): Socket {
  const socket = roofSockets(design).find((candidate) => candidate.id === socketId);
  if (!socket) throw new Error(`Saknar takfallet ${socketId}`);
  return socket;
}

describe('kopplingspunkter på takfallen', () => {
  it('ger sadeltakets två takfall namn efter väggen de lutar ner mot', () => {
    const sockets = roofSockets(designWithExtensions());
    expect(sockets.map((socket) => [socket.id, socket.labelKey, socket.ownerPartId])).toEqual([
      ['roof-right', 'socket.roofToward2', 'S1/roof-right'],
      ['roof-left', 'socket.roofToward4', 'S1/roof-left'],
    ]);
  });

  it('mäter läget längs takfoten från mitten och avståndet uppför takfallet längs lutningen', () => {
    const socket = socketById(designWithExtensions(), 'roof-right');
    const us = socket.bounds.map((point) => point.x);
    const vs = socket.bounds.map((point) => point.y);
    expect(Math.min(...us)).toBeCloseTo(-Math.max(...us));
    expect(Math.min(...vs)).toBeCloseTo(0);
    // Takfallets längd längs lutningen: halva bredden och takutsprånget, delat med cos 45°.
    expect(Math.max(...vs)).toBeGreaterThan(HOST_PARAMS.width / 2 / Math.cos(Math.PI / 4));
  });

  it('har nedre och övre takfall på mansardtaket och ett per takfall på valmat tak', () => {
    expect(roofSockets(houseWith({ roof: 'mansard' })).map((socket) => socket.labelKey)).toEqual([
      'socket.lowerRoofToward2',
      'socket.lowerRoofToward4',
      'socket.upperRoofToward2',
      'socket.upperRoofToward4',
    ]);
    expect(roofSockets(houseWith({ roof: 'hip' })).map((socket) => socket.labelKey)).toEqual([
      'socket.roofToward2',
      'socket.roofToward4',
      'socket.roofToward1',
      'socket.roofToward3',
    ]);
  });

  it('saknas på platt tak och tornspiror', () => {
    for (const roof of ['flat', 'spire4', 'spire8']) expect(roofSockets(houseWith({ roof }))).toEqual([]);
  });

  it('hör till takets fältgrupp, så att panelen visar dem under Tak', () => {
    expect(roofSockets(designWithExtensions()).every((socket) => socket.paramGroupKey === 'group.roof')).toBe(true);
  });
});

describe('takkupa', () => {
  const design = designWithExtensions(dormerOn('roof-right'));
  const parts = buildParts(design, gingerbreadDomain);
  const socket = socketById(design, 'roof-right');
  const dormerParts = parts.filter((part) => part.sourceInstanceId === 'K1');

  it('har framvägg, två sidoväggar och två takhalvor', () => {
    expect(dormerParts.map((part) => [part.id, part.labelKey])).toEqual([
      ['K1/side-right', 'part.dormerSide'],
      ['K1/side-left', 'part.dormerSide'],
      ['K1/gable-front', 'part.dormerFront'],
      ['K1/roof-right', 'part.dormerRoof'],
      ['K1/roof-left', 'part.dormerRoof'],
    ]);
  });

  it('läggs efter huvudtaket i byggordningen', () => {
    const roofStep = partById(parts, 'S1/roof-right').buildStep;
    expect(dormerParts.every((part) => part.buildStep > roofStep)).toBe(true);
  });

  it('står med väggarna på takfallet: de går ner till ovansidan men inte genom den', () => {
    for (const id of ['K1/side-right', 'K1/side-left', 'K1/gable-front']) {
      // Väggarna kapas längs utsidan, där de syns.
      const heights = worldCorners(partById(parts, id), true).map((corner) => heightAboveRoof(socket, corner));
      expect(Math.min(...heights)).toBeCloseTo(0, 3);
    }
  });

  it('har sidoväggar som är trianglar med underkanten längs takets lutning och spegelvända mot varandra', () => {
    const right = partById(parts, 'K1/side-right');
    const left = partById(parts, 'K1/side-left');
    expect(right.outline).toHaveLength(3);
    expect(Math.abs(signedArea(right.outline))).toBeCloseTo(Math.abs(signedArea(left.outline)), 3);
  });

  it('har framväggen lika bred som kupan och så hög som vägghöjden plus taket', () => {
    const front = boundsOf(partById(parts, 'K1/gable-front').outline);
    expect(front.maxX - front.minX).toBeCloseTo(40);
    expect(front.maxY - front.minY).toBeGreaterThan(20);
  });

  it('lägger taket ovanpå husets tak, klippt i vinkelrännor', () => {
    for (const id of ['K1/roof-right', 'K1/roof-left']) {
      const heights = worldCorners(partById(parts, id)).map((corner) => heightAboveRoof(socket, corner));
      expect(Math.min(...heights)).toBeGreaterThan(-0.01);
      expect(Math.min(...heights)).toBeLessThan(0.01);
    }
  });

  it('tar upp ett hål i takfallet innanför väggarna och låter resten av taket vara helt', () => {
    const roof = partById(parts, 'S1/roof-right');
    expect(roof.holes).toHaveLength(1);
    expect(partById(parts, 'S1/roof-left').holes).toHaveLength(0);
    const toRoof = invertRigidMatrix(roof.transform);
    const hole = boundsOf(roof.holes[0] ?? []);
    const wallInside = boundsOf(
      ['K1/side-right', 'K1/side-left'].flatMap((id) => worldCorners(partById(parts, id))).map((corner) => {
        const local = transformPoint(toRoof, corner);
        return { x: local.x, y: local.y };
      }),
    );
    expect(hole.minX).toBeGreaterThan(wallInside.minX);
    expect(hole.maxX).toBeLessThan(wallInside.maxX);
  });

  it('går att bygga mitt på takfallet', () => {
    expect(errorKeys(design)).toEqual([]);
  });

  it('kan inte vridas', () => {
    const turned = designWithExtensions({ ...dormerOn('roof-right'), attachment: { socketId: 'roof-right', u: 0, v: 0, rotationDegrees: 90 } });
    expect(errorKeys(turned)).toContain('rule.dormerUpright');
  });
});

describe('takkupans regler', () => {
  it('behöver helt tak mellan framväggen och takfoten', () => {
    expect(errorKeys(designWithExtensions(dormerOn('roof-right', { eaveDistance: 0 })))).toContain('rule.dormerOnRoof');
  });

  it('måste ligga under nocken', () => {
    expect(errorKeys(designWithExtensions(dormerOn('roof-right', { eaveDistance: 50, wallHeight: 50 })))).toContain('rule.dormerOnRoof');
  });

  it('får inte gå utanför takfallet vid gaveln', () => {
    expect(errorKeys(designWithExtensions(dormerOn('roof-right', {}, 85)))).toContain('rule.dormerOnRoof');
  });

  it('får inte ta samma yta som en annan kupa', () => {
    const errors = errorKeys(designWithExtensions(dormerOn('roof-right'), dormerOn('roof-right', {}, 20, 'K2')), 'K2');
    expect(errors).toContain('rule.dormerOnRoof');
  });

  it('kan stå bredvid en annan kupa', () => {
    const design = designWithExtensions(dormerOn('roof-right', {}, -40), dormerOn('roof-right', {}, 40, 'K2'));
    expect([...errorKeys(design), ...errorKeys(design, 'K2')]).toEqual([]);
  });

  it('krockar med en tillbyggnads tak som ligger på samma takfall', () => {
    const tall = { width: 80, depth: 80, wallHeight: 90, roofPitch: 45, eaveOverhang: 8, gableOverhang: 8 };
    const design = designWithExtensions(extension('side-right', tall), dormerOn('roof-right'));
    expect(errorKeys(design)).toContain('rule.dormerMeetsRoof');
    const beside = designWithExtensions(extension('side-right', tall, 40), dormerOn('roof-right', {}, -60));
    expect(errorKeys(beside)).not.toContain('rule.dormerMeetsRoof');
  });
});

describe('förslag på takkupa', () => {
  it('föreslår en kupa mitt på takfallet som går att bygga', () => {
    const proposal = proposeChild(designWithExtensions(), gingerbreadDomain, { parentId: 'S1', socketId: 'roof-right', objectTypeId: 'gb.dormer' });
    expect(proposal.violations).toEqual([]);
    expect(proposal.instance.id).toBe('K1');
    expect(proposal.instance.attachment?.u).toBe(0);
  });

  it('ger en andra kupa samma mått som den första och flyttar den från mitten', () => {
    const first = dormerOn('roof-right', { width: 35, wallHeight: 20, roofPitch: 50 });
    const proposal = proposeChild(designWithExtensions(first), gingerbreadDomain, { parentId: 'S1', socketId: 'roof-right', objectTypeId: 'gb.dormer' });
    expect(proposal.violations).toEqual([]);
    expect(proposal.instance.params).toMatchObject({ width: 35, wallHeight: 20, roofPitch: 50 });
    expect(proposal.instance.attachment?.u).not.toBe(0);
  });
});

/** Delens hörn sett uppifrån, för att jämföra kupor på olika takfall. */
function planOf(part: Part): { x: number; z: number }[] {
  return worldCorners(part).map((corner) => ({ x: corner.x, z: corner.z }));
}

it('kupan på andra takfallet blir en spegelbild', () => {
  const right = buildParts(designWithExtensions(dormerOn('roof-right')), gingerbreadDomain).filter((part) => part.sourceInstanceId === 'K1');
  const left = buildParts(designWithExtensions(dormerOn('roof-left')), gingerbreadDomain).filter((part) => part.sourceInstanceId === 'K1');
  const xs = (parts: Part[]) => parts.flatMap(planOf).map((point) => point.x);
  expect(Math.min(...xs(right))).toBeCloseTo(-Math.max(...xs(left)), 3);
});

describe('takkupa med pulpettak', () => {
  const design = designWithExtensions(dormerOn('roof-right', { roof: 'shed', roofPitch: 15, wallHeight: 25 }));
  const parts = buildParts(design, gingerbreadDomain);
  const socket = socketById(design, 'roof-right');

  it('har framvägg, två sidoväggar och ett tak som lutar ut från huset', () => {
    expect(parts.filter((part) => part.sourceInstanceId === 'K1').map((part) => [part.id, part.labelKey])).toEqual([
      ['K1/side-right', 'part.dormerSide'],
      ['K1/side-left', 'part.dormerSide'],
      ['K1/gable-front', 'part.dormerFront'],
      ['K1/roof', 'part.dormerShedRoof'],
    ]);
  });

  it('slutar taket där det möter husets tak, ovanpå det', () => {
    const heights = worldCorners(partById(parts, 'K1/roof')).map((corner) => heightAboveRoof(socket, corner));
    expect(Math.min(...heights)).toBeGreaterThan(-0.01);
    expect(Math.min(...heights)).toBeLessThan(0.01);
  });

  it('har en rak framvägg och sidoväggar som följer taket', () => {
    const front = boundsOf(partById(parts, 'K1/gable-front').outline);
    expect(front.maxY - front.minY).toBeCloseTo(25, 0);
    expect(partById(parts, 'K1/side-right').outline.length).toBeGreaterThanOrEqual(3);
    expect(errorKeys(design)).toEqual([]);
  });

  it('går inte att bygga när taket lutar lika brant som husets', () => {
    expect(errorKeys(designWithExtensions(dormerOn('roof-right', { roof: 'shed', roofPitch: 45 })))).toContain('rule.dormerRoofTooSteep');
  });
});

it('rättar taklutningen när man väljer pulpettak, så att taket möter husets tak', () => {
  const changed = setParamWithinRules(designWithExtensions(dormerOn('roof-right')), gingerbreadDomain, { instanceId: 'K1', key: 'roof', value: 'shed' });
  const dormer = changed.root.children[0]?.children[0];
  expect(dormer?.params.roof).toBe('shed');
  expect(Number(dormer?.params.roofPitch)).toBeLessThan(45);
  expect(errorKeys(changed)).toEqual([]);
});
