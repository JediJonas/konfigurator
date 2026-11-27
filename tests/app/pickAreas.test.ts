import { describe, expect, it } from 'vitest';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { placeInstances } from '../../src/core/pipeline/placeInstances';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { listPickAreas, triangulatePlanarRegion } from '../../src/app/three/pickAreas';
import { findLeafInstanceOf } from '../../src/app/ui/socketSelection';
import { designWithExtensions } from '../domains/extensionFixtures';
import { doorOn, windowOn } from '../domains/openingFixtures';

describe('tryck på fönster och dörrar i 3D-vyn', () => {
  const design = designWithExtensions(windowOn('side-right', { mullions: 'cross', hasShutters: true }), doorOn('gable-front'));
  const placed = placeInstances(design, gingerbreadDomain);

  it('ger fönstrets rutor och dörrens öppning en yta att trycka på, men inte sektionerna', () => {
    const areas = listPickAreas(placed);
    expect(areas.map((area) => area.instanceId)).toEqual(['F1', 'F1', 'F1', 'F1', 'D1']);
  });

  it('delar en yta i trianglar även när den står lodrätt', () => {
    const [area] = listPickAreas(placed);
    if (!area) throw new Error('Ingen yta');
    expect(triangulatePlanarRegion(area.region)).toHaveLength(6);
  });

  it('öppnar fönstret när man trycker på en lucka, men inte när man trycker på väggen', () => {
    const parts = buildParts(design, gingerbreadDomain);
    expect(findLeafInstanceOf(placed, parts, 'F1/shutter-left')).toBe('F1');
    expect(findLeafInstanceOf(placed, parts, 'S1/side-right')).toBeUndefined();
  });
});
