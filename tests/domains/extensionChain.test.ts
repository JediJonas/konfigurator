import { describe, expect, it } from 'vitest';
import type { Design } from '../../src/core/model/design';
import { addChildInstance } from '../../src/core/model/instanceTree';
import { proposeChild } from '../../src/core/rules/placement';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { SECTION_TYPE_ID } from '../../src/domains/gingerbread/objects/section';
import { designWithExtensions } from './extensionFixtures';

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
  it('blir smalare och lägre för varje steg tills den minsta storleken', () => {
    // Huvudhuset är 140 mm brett med 100 mm vägghöjd.
    expect(buildOnGables(4)).toEqual([
      { width: 80, wallHeight: 80, violations: 0 },
      { width: 60, wallHeight: 60, violations: 0 },
      { width: 60, wallHeight: 40, violations: 0 },
      { width: undefined, wallHeight: undefined, violations: 1 },
    ]);
  });
});
