import { describe, expect, it } from 'vitest';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { placeInstances } from '../../src/core/pipeline/placeInstances';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { describeHighlight } from '../../src/app/ui/selectionHighlight';
import { designWithExtensions, extension } from '../domains/extensionFixtures';
import { windowOn } from '../domains/openingFixtures';

describe('markeringen i 3D-vyn', () => {
  const design = designWithExtensions(windowOn('side-left', { hasShutters: true }), extension('side-right'));
  const placed = placeInstances(design, gingerbreadDomain);
  const parts = buildParts(design, gingerbreadDomain);

  it('ger takets delar fältgruppen för taket, även efter vinkelrännan', () => {
    const roofIds = parts.filter((part) => part.paramGroupKey === 'group.roof').map((part) => part.id);
    expect(roofIds).toEqual(expect.arrayContaining(['S1/roof-left', 'S1/roof-right', 'S2/roof-left', 'S2/roof-right']));
    expect(roofIds.some((id) => id.includes('side'))).toBe(false);
    const wallIds = parts.filter((part) => part.paramGroupKey === 'group.dimensions').map((part) => part.id);
    expect(wallIds).toEqual(expect.arrayContaining(['S1/side-left', 'S1/gable-front', 'S2/side-right']));
  });

  it('markerar taket på sektionen man tryckte på så länge den är öppen', () => {
    const focusedInstance = { instanceId: 'S2', groupKey: 'group.roof', count: 1 };
    expect([...describeHighlight(placed, parts, { focusedInstance, openInstanceId: 'S2' }).partIds].sort()).toEqual(['S2/roof-left', 'S2/roof-right']);
    expect(describeHighlight(placed, parts, { focusedInstance, openInstanceId: 'S1' }).partIds.size).toBe(0);
  });

  it('markerar fönstret som är öppet i panelen, med hålet och luckorna', () => {
    const highlight = describeHighlight(placed, parts, { openInstanceId: 'F1' });
    expect(highlight.pickInstanceId).toBe('F1');
    expect([...highlight.partIds].sort()).toEqual(['F1/shutter-left', 'F1/shutter-right']);
  });

  it('släcker fönstret efter ett tryck utanför huset', () => {
    const highlight = describeHighlight(placed, parts, { openInstanceId: 'F1', isOpenInstanceHighlighted: false });
    expect(highlight.pickInstanceId).toBeUndefined();
    expect(highlight.partIds.size).toBe(0);
  });

  it('markerar väggen man tryckte på före allt annat', () => {
    const highlight = describeHighlight(placed, parts, { selectedSocket: { instanceId: 'S1', socketId: 'side-left' }, openInstanceId: 'F1' });
    expect([...highlight.partIds]).toEqual(['S1/side-left']);
    expect(highlight.pickInstanceId).toBeUndefined();
  });
});
