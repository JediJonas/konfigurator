import { describe, expect, it } from 'vitest';
import type { Design } from '../../src/core/model/design';
import { addChildInstance } from '../../src/core/model/instanceTree';
import { evaluateDesign } from '../../src/core/rules/evaluateDesign';
import { proposeChild } from '../../src/core/rules/placement';
import { placeInstances } from '../../src/core/pipeline/placeInstances';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { SECTION_TYPE_ID } from '../../src/domains/gingerbread/objects/section';
import { designWithExtensions, extension, EXTENSION_PARAMS, HOST_PARAMS } from './extensionFixtures';

/** Bygger på framgaveln gång på gång, som i panelen, och ger förslagens mått. */
function buildOnGables(times: number): { width: unknown; wallHeight: unknown; violations: number }[] {
  let design: Design = designWithExtensions();
  let parentId = 'S1';
  const sizes = [];
  for (let step = 0; step < times; step++) {
    const proposal = proposeChild(design, gingerbreadDomain, { parentId, socketId: 'gable-front', objectTypeId: SECTION_TYPE_ID });
    sizes.push({ width: proposal.instance.params.width, wallHeight: proposal.instance.params.wallHeight, violations: proposal.violations.length });
    if (proposal.violations.length > 0) break;
    design = { ...design, root: addChildInstance(design.root, parentId, proposal.instance) };
    parentId = proposal.instance.id;
  }
  return sizes;
}

describe('tillbyggnader på varandras gavlar', () => {
  it('blir smalare och lägre för varje steg tills den minsta storleken inte ryms', () => {
    // Huvudhuset är 140 mm brett med 100 mm vägghöjd. På gaveln som är 60 mm ryms inte 60 mm med 10 mm till hörnen.
    expect(buildOnGables(4)).toEqual([
      { width: 80, wallHeight: 80, violations: 0 },
      { width: 60, wallHeight: 60, violations: 0 },
      { width: undefined, wallHeight: undefined, violations: 1 },
    ]);
  });

  it('står minst 10 mm från väggens hörn och under takets undersida', () => {
    const fitsOnGable = (params: Record<string, unknown>) =>
      evaluateDesign(designWithExtensions(extension('gable-front', params)), gingerbreadDomain, (key) => key).violations.every((violation) => violation.level !== 'error');
    expect(fitsOnGable({ ...EXTENSION_PARAMS, width: 120 })).toBe(true);
    expect(fitsOnGable({ ...EXTENSION_PARAMS, width: 125 })).toBe(false);
    expect(fitsOnGable({ ...EXTENSION_PARAMS, width: 140 })).toBe(false);
  });

  it('lämnar 10 mm vägg under takfoten och vid hörnen på långväggen', () => {
    const host = placeInstances(designWithExtensions(), gingerbreadDomain).find((entry) => entry.instance.id === 'S1');
    const socket = host?.sockets.find((candidate) => candidate.id === 'side-right');
    const { depth, wallHeight, eaveOverhang, roofPitch } = HOST_PARAMS;
    const eaveHeight = wallHeight - eaveOverhang * Math.sin((roofPitch * Math.PI) / 180);
    expect(Math.max(...(socket?.bounds ?? []).map((point) => point.x))).toBeCloseTo(depth / 2 - 10);
    expect(Math.max(...(socket?.bounds ?? []).map((point) => point.y))).toBeCloseTo(eaveHeight - 10);
  });
});
