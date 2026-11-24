import { describe, expect, it } from 'vitest';
import { findInstance } from '../../../src/core/model/instanceTree';
import { findAllowedOffsetRange, proposeChild, snapAttachmentOffset } from '../../../src/core/rules/placement';
import { gingerbreadDomain } from '../../../src/domains/gingerbread';
import { SECTION_TYPE_ID } from '../../../src/domains/gingerbread/objects/section';
import { designWithExtensions, extension, HOST_PARAMS } from '../../domains/extensionFixtures';

describe('nya objekt i en kopplingspunkt', () => {
  it('snäpper mitt på väggen i största storleken som ryms', () => {
    const proposal = proposeChild(designWithExtensions(), gingerbreadDomain, { parentId: 'S1', socketId: 'side-right', objectTypeId: SECTION_TYPE_ID });
    expect(proposal.violations).toEqual([]);
    expect(proposal.instance.id).toBe('S2');
    expect(proposal.instance.attachment).toEqual({ socketId: 'side-right', u: 0, v: 0, rotationDegrees: 0 });
    expect(proposal.instance.params).toMatchObject({ width: 100, wallHeight: 40 });
  });

  it('ger en högre tillbyggnad på gaveln, där taket ger mer plats på mitten', () => {
    const proposal = proposeChild(designWithExtensions(), gingerbreadDomain, { parentId: 'S1', socketId: 'gable-front', objectTypeId: SECTION_TYPE_ID });
    expect(proposal.violations).toEqual([]);
    expect(proposal.instance.params).toMatchObject({ width: 80, wallHeight: 80 });
  });

  it('förklarar varför det inte går när väggen är för låg', () => {
    const design = designWithExtensions();
    const host = design.root.children[0];
    if (!host) throw new Error('Mallen saknar sektion');
    host.params = { ...HOST_PARAMS, wallHeight: 40 };
    const proposal = proposeChild(design, gingerbreadDomain, { parentId: 'S1', socketId: 'side-right', objectTypeId: SECTION_TYPE_ID }, (key) => key);
    expect(proposal.violations.map((violation) => violation.message)).toContain('rule.extensionFitsWall');
  });

  it('snäpper läget längs väggen till 5 mm och stannar där tillbyggnaden ryms', () => {
    const design = designWithExtensions(extension('side-right'));
    expect(findInstance(snapAttachmentOffset(design, gingerbreadDomain, 'S2', 23).root, 'S2')?.attachment?.u).toBe(25);
    // Väggen är 180 mm och tillbyggnaden 80 mm, så väggarna når husets hörn vid ±50 mm.
    expect(findInstance(snapAttachmentOffset(design, gingerbreadDomain, 'S2', 200).root, 'S2')?.attachment?.u).toBe(50);
    expect(findInstance(snapAttachmentOffset(design, gingerbreadDomain, 'S2', -200).root, 'S2')?.attachment?.u).toBe(-50);
  });

  it('räknar ut hur långt tillbyggnaden kan flyttas', () => {
    const design = designWithExtensions(extension('side-right'));
    expect(findAllowedOffsetRange(design, gingerbreadDomain, { instanceId: 'S2', currentU: 0, maxReachMm: 90 })).toEqual({ min: -50, max: 50 });
  });
});
