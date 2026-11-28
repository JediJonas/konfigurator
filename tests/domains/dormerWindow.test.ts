import { describe, expect, it } from 'vitest';
import { boundsOf } from '../../src/core/geometry/polygon';
import type { Design, Instance } from '../../src/core/model/design';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { placeInstances } from '../../src/core/pipeline/placeInstances';
import { addProposedChild } from '../../src/core/rules/addProposedChild';
import { evaluateDesign } from '../../src/core/rules/evaluateDesign';
import { proposeChild } from '../../src/core/rules/placement';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { DORMER_WALL } from '../../src/domains/gingerbread/socketKinds';
import { dormerOn } from './dormerFixtures';
import { designWithExtensions } from './extensionFixtures';
import { partById } from './roofFixtures';

const keyAsLabel = (key: string) => key;

function windowOn(params: Record<string, unknown>, id = 'F1'): Instance {
  return { id, type: 'gb.window', params: { shape: 'rect', mullions: 'none', hasShutters: false, ...params }, attachment: { socketId: 'gable-front', u: 0, v: 0, rotationDegrees: 0 }, children: [] };
}

function dormerWith(...windows: Instance[]): Design {
  return designWithExtensions({ ...dormerOn('roof-right'), children: windows });
}

function errorKeys(design: Design, instanceId: string): string[] {
  return evaluateDesign(design, gingerbreadDomain, keyAsLabel)
    .violations.filter((violation) => violation.level === 'error' && violation.instanceId === instanceId)
    .map((violation) => violation.message);
}

function findDormer(design: Design): Instance | undefined {
  return design.root.children.find((child) => child.id === 'S1')?.children.find((child) => child.type === 'gb.dormer');
}

describe('fönster i takkupans framvägg', () => {
  it('har en kopplingspunkt på framväggen, från takytan upp till väggens överkant', () => {
    const dormer = placeInstances(dormerWith(), gingerbreadDomain).find((entry) => entry.instance.id === 'K1');
    const socket = dormer?.sockets.find((candidate) => candidate.kind === DORMER_WALL);
    expect(socket?.labelKey).toBe('socket.dormerFront');
    expect(socket?.ownerPartId).toBe('K1/gable-front');
    const bounds = boundsOf(socket?.bounds ?? []);
    expect(bounds.minX).toBeCloseTo(-20, 3);
    expect(bounds.maxX).toBeCloseTo(20, 3);
    expect(bounds.minY).toBe(0);
    // Vägghöjden vid hörnen och gaveln upp till kupans nock (45°, halva bredden).
    expect(bounds.maxY).toBeCloseTo(40, 0);
  });

  it('skär ett hål i framväggen', () => {
    const parts = buildParts(dormerWith(windowOn({ width: 15, height: 15, sillHeight: 5 })), gingerbreadDomain);
    expect(partById(parts, 'K1/gable-front').holes).toHaveLength(1);
  });

  it('behöver 5 mm hel vägg runt sig i kupan', () => {
    expect(errorKeys(dormerWith(windowOn({ width: 15, height: 15, sillHeight: 5 })), 'F1')).toEqual([]);
    // Ovankanten med kanten når över gaveln: vid 12,5 mm från mitten är väggen 27,5 mm hög.
    expect(errorKeys(dormerWith(windowOn({ width: 15, height: 20, sillHeight: 5 })), 'F1')).toContain('rule.windowOnWall');
    expect(errorKeys(dormerWith(windowOn({ width: 35, height: 15, sillHeight: 5 })), 'F1')).toContain('rule.windowOnWall');
  });

  it('kan inte få en dörr eller en tillbyggnad', () => {
    const dormer = placeInstances(dormerWith(), gingerbreadDomain).find((entry) => entry.instance.id === 'K1');
    const kinds = dormer?.sockets.map((socket) => socket.kind);
    expect(kinds).toEqual([DORMER_WALL]);
    const accepting = gingerbreadDomain.objectTypes.filter((type) => type.attachesTo.includes(DORMER_WALL)).map((type) => type.id);
    expect(accepting).toEqual(['gb.window']);
  });

  it('föreslår ett fönster som ryms i framväggen, med husets form men mindre', () => {
    const houseWindow: Instance = { id: 'F9', type: 'gb.window', params: { width: 30, height: 40, sillHeight: 30, shape: 'arch', mullions: 'four', hasShutters: false }, attachment: { socketId: 'side-right', u: 0, v: 0, rotationDegrees: 0 }, children: [] };
    const design = designWithExtensions(houseWindow, dormerOn('roof-right'));
    const proposal = proposeChild(design, gingerbreadDomain, { parentId: 'K1', socketId: 'gable-front', objectTypeId: 'gb.window' });
    expect(proposal.violations).toEqual([]);
    expect(proposal.instance.params).toMatchObject({ shape: 'arch', mullions: 'four' });
    expect(Number(proposal.instance.params.height)).toBeLessThan(40);
  });
});

describe('ny takkupa', () => {
  it('får ett fönster direkt när det ryms', () => {
    const design = addProposedChild(designWithExtensions(), gingerbreadDomain, { parentId: 'S1', socketId: 'roof-right', objectTypeId: 'gb.dormer' });
    const dormer = findDormer(design);
    expect(dormer?.children.map((child) => [child.type, child.attachment?.socketId])).toEqual([['gb.window', 'gable-front']]);
    expect(evaluateDesign(design, gingerbreadDomain, keyAsLabel).violations.filter((violation) => violation.level === 'error')).toEqual([]);
  });

  it('läggs till utan fönster när inget fönster ryms', () => {
    const tiny = { eaveDistance: 20, width: 30, wallHeight: 15, roofPitch: 20, eaveOverhang: 5, gableOverhang: 5 };
    const design = designWithExtensions(dormerOn('roof-right', tiny, -60, 'K1'));
    const added = addProposedChild(design, gingerbreadDomain, { parentId: 'S1', socketId: 'roof-right', objectTypeId: 'gb.dormer' });
    const dormers = added.root.children.find((child) => child.id === 'S1')?.children.filter((child) => child.type === 'gb.dormer') ?? [];
    expect(dormers).toHaveLength(2);
    expect(dormers[1]?.children).toEqual([]);
  });
});
