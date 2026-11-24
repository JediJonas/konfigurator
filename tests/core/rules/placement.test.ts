import { describe, expect, it } from 'vitest';
import { findInstance } from '../../../src/core/model/instanceTree';
import { findAllowedOffsetRange, findAllowedParamRange, proposeChild, snapAttachmentOffset } from '../../../src/core/rules/placement';
import { coreStrings } from '../../../src/core/text/strings.sv';
import { gingerbreadDomain } from '../../../src/domains/gingerbread';
import { SECTION_TYPE_ID } from '../../../src/domains/gingerbread/objects/section';
import { designWithExtensions, extension, EXTENSION_PARAMS, HOST_PARAMS } from '../../domains/extensionFixtures';

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

  it('föreslår inget när väggen är för låg för den lägsta tillbyggnaden', () => {
    const design = designWithExtensions();
    const host = design.root.children[0];
    if (!host) throw new Error('Mallen saknar sektion');
    host.params = { ...HOST_PARAMS, wallHeight: 40 };
    const proposal = proposeChild(design, gingerbreadDomain, { parentId: 'S1', socketId: 'side-right', objectTypeId: SECTION_TYPE_ID }, (key) => key);
    expect(proposal.violations.map((violation) => violation.message)).toEqual([coreStrings.noSizeFits]);
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

  it('låter inte huset bli kortare eller lägre än tillbyggnaden på dess vägg', () => {
    const design = designWithExtensions(extension('side-right'));
    const depth = findAllowedParamRange(design, gingerbreadDomain, { instanceId: 'S1', param: 'depth', current: 180, step: 5, min: 60, max: 400 });
    expect(depth).toEqual({ min: 80, max: 400 });
    const wallHeight = findAllowedParamRange(design, gingerbreadDomain, { instanceId: 'S1', param: 'wallHeight', current: 100, step: 5, min: 40, max: 300 });
    expect(wallHeight.min).toBe(100);
  });

  it('släpper gränserna när designen redan har fel, så att man kan ändra sig ur felet', () => {
    const design = designWithExtensions(extension('side-right', { ...EXTENSION_PARAMS, wallHeight: 80 }));
    expect(findAllowedParamRange(design, gingerbreadDomain, { instanceId: 'S2', param: 'wallHeight', current: 80, step: 5, min: 40, max: 300 })).toEqual({ min: 40, max: 300 });
  });
});
