import { describe, expect, it } from 'vitest';
import type { Design } from '../../src/core/model/design';
import { addChildInstance } from '../../src/core/model/instanceTree';
import { evaluateDesign } from '../../src/core/rules/evaluateDesign';
import { findAllowedParamRange, proposeChild } from '../../src/core/rules/placement';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { designWithExtensions, extension, HOST_PARAMS } from './extensionFixtures';
import { beside, BLOCK_PARAMS, houseWithTower, TOWER_PARAMS } from './neighborFixtures';
import { doorOn, windowOn } from './openingFixtures';

function errorsFor(design: Design, instanceId: string): string[] {
  return evaluateDesign(design, gingerbreadDomain, (key) => key)
    .violations.filter((violation) => violation.level === 'error' && violation.instanceId === instanceId)
    .map((violation) => violation.message);
}

/** Huset med fönster och dörrar på huvudhuset S1, efter eventuella tillbyggnader. */
function houseWithOpenings(...openings: ReturnType<typeof windowOn>[]): Design {
  return designWithExtensions(...openings);
}

describe('regler för fönster och dörrar', () => {
  it('kräver 15 mm hel vägg mot väggens kanter', () => {
    expect(errorsFor(houseWithOpenings(windowOn('side-right')), 'F1')).toEqual([]);
    expect(errorsFor(houseWithOpenings(windowOn('side-right', { sillHeight: 10 })), 'F1')).toEqual(['rule.windowOnWall']);
    expect(errorsFor(houseWithOpenings(windowOn('side-right', { sillHeight: 60 })), 'F1')).toEqual(['rule.windowOnWall']);
    expect(errorsFor(houseWithOpenings(windowOn('side-right', {}, 65)), 'F1')).toEqual(['rule.windowOnWall']);
  });

  it('kräver 15 mm mellan två öppningar', () => {
    const near = houseWithOpenings(windowOn('side-right'), windowOn('side-right', {}, 40, 'F2'));
    expect(errorsFor(near, 'F2')).toEqual(['rule.windowOnWall']);
    const apart = houseWithOpenings(windowOn('side-right', {}, -30), windowOn('side-right', {}, 45, 'F2'));
    expect(errorsFor(apart, 'F2')).toEqual([]);
  });

  it('låter inte fönsterluckor gå in i varandra', () => {
    const touching = houseWithOpenings(windowOn('side-right', { hasShutters: true }, -30), windowOn('side-right', { hasShutters: true }, 30, 'F2'));
    expect(errorsFor(touching, 'F2')).toEqual([]);
    const overlapping = houseWithOpenings(windowOn('side-right', { hasShutters: true }, -30), windowOn('side-right', { hasShutters: true }, 25, 'F2'));
    expect(errorsFor(overlapping, 'F2')).toEqual(['rule.windowOnWall']);
  });

  it('tillåter bara en dörr per vägg', () => {
    const design = houseWithOpenings(doorOn('side-right', {}, -40), doorOn('side-right', {}, 40, 'D2'));
    expect(errorsFor(design, 'D1')).toEqual([]);
    expect(errorsFor(design, 'D2')).toEqual(['rule.oneDoorPerWall']);
  });

  it('går inte i öppningen där en tillbyggnad möter väggen', () => {
    const design = houseWithOpenings(extension('side-right'), windowOn('side-right', { sillHeight: 20, height: 20 }));
    expect(errorsFor(design, 'F1')).toEqual(['rule.windowOnWall']);
  });

  it('går inte i väggen där en högre sektion står bredvid, men väl en bit därifrån', () => {
    const inHole = houseWithTower(TOWER_PARAMS);
    inHole.root.children[0]?.children.push(windowOn('side-right'));
    expect(errorsFor(inHole, 'F1')).toEqual(['rule.windowOnWall']);
    const longHouse = houseWithTower(TOWER_PARAMS);
    const host = longHouse.root.children[0];
    if (!host) throw new Error('Saknar huset');
    host.params = { ...HOST_PARAMS, depth: 300 };
    host.children.push(windowOn('side-right', {}, 100));
    expect(errorsFor(longHouse, 'F1')).toEqual([]);
  });

  it('kan sitta i tornets vägg som står mot det lägre huset ovanför husets tak', () => {
    const design = houseWithTower(TOWER_PARAMS);
    const tower = design.root.children[0]?.children[0];
    if (!tower) throw new Error('Saknar tornet');
    tower.children = [windowOn('gable-back', { sillHeight: 160, height: 20, width: 20 })];
    expect(errorsFor(design, 'F1')).toEqual([]);
  });
});

describe('förslag för fönster och dörrar', () => {
  it('föreslår ett andra fönster lika stort bredvid det första', () => {
    let design = designWithExtensions();
    const first = proposeChild(design, gingerbreadDomain, { parentId: 'S1', socketId: 'side-right', objectTypeId: 'gb.window' });
    design = { ...design, root: addChildInstance(design.root, 'S1', first.instance) };
    const second = proposeChild(design, gingerbreadDomain, { parentId: 'S1', socketId: 'side-right', objectTypeId: 'gb.window' });
    expect(second.violations).toEqual([]);
    expect(second.instance.params).toEqual(first.instance.params);
    expect(Math.abs(second.instance.attachment?.u ?? 0)).toBeGreaterThan(0);
  });

  it('säger varför en andra dörr inte går att lägga till', () => {
    const design = designWithExtensions(doorOn('gable-front'));
    const proposal = proposeChild(design, gingerbreadDomain, { parentId: 'S1', socketId: 'gable-front', objectTypeId: 'gb.door' }, (key) => key);
    expect(proposal.blockingMessage).toBe('rule.oneDoorPerWall');
  });

  it('lägger inte en ny sektion så att ett fönster som redan finns hamnar i ett hål', () => {
    const design = designWithExtensions(windowOn('side-right', { width: 100, sillHeight: 20, height: 30 }));
    const proposal = proposeChild(design, gingerbreadDomain, { parentId: 'S1', socketId: 'side-right', objectTypeId: 'gb.section' });
    expect(proposal.violations).toEqual([]);
    // Tillbyggnaden skulle ta upp en öppning över fönstret, så den föreslås bredvid, lägre än huset.
    expect(proposal.instance.attachment?.socketId).toBe('beside-side-right');
    expect(errorsFor({ ...design, root: addChildInstance(design.root, 'S1', proposal.instance) }, 'F1')).toEqual([]);
  });

  it('låter inte väggen bli så smal att dörren inte ryms', () => {
    const design = designWithExtensions(doorOn('gable-front'));
    const range = findAllowedParamRange(design, gingerbreadDomain, { instanceId: 'S1', param: 'width', current: HOST_PARAMS.width, step: 5, min: 60, max: 400 });
    expect(range.min).toBe(65);
  });
});

it('fönster i en lägre sektion bredvid går inte i väggen som huset står för', () => {
  const block = { ...BLOCK_PARAMS, wallHeight: 40 };
  const design = designWithExtensions(beside('S2', 'beside-side-right', block, [windowOn('gable-back', { width: 20, height: 15, sillHeight: 15 }, 0, 'F1')]));
  expect(errorsFor(design, 'F1')).toEqual(['rule.windowOnWall']);
  const front = designWithExtensions(beside('S2', 'beside-side-right', block, [windowOn('gable-front', { width: 20, height: 15, sillHeight: 15 }, 0, 'F1')]));
  expect(errorsFor(front, 'F1')).toEqual([]);
});
