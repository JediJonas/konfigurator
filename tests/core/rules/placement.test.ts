import { describe, expect, it } from 'vitest';
import { findInstance } from '../../../src/core/model/instanceTree';
import { setParamWithinRules } from '../../../src/core/rules/paramAdjustment';
import { findAllowedOffsetRange, findAllowedParamRange, measureOffsetReach, proposeChild, snapAttachmentOffset } from '../../../src/core/rules/placement';
import { placeInstances } from '../../../src/core/pipeline/placeInstances';
import { gingerbreadDomain } from '../../../src/domains/gingerbread';
import { SECTION_TYPE_ID } from '../../../src/domains/gingerbread/objects/section';
import { designWithExtensions, extension, EXTENSION_PARAMS, HOST_PARAMS } from '../../domains/extensionFixtures';

describe('nya objekt i en kopplingspunkt', () => {
  it('snäpper mitt på väggen i största storleken som ryms', () => {
    const proposal = proposeChild(designWithExtensions(), gingerbreadDomain, { parentId: 'S1', socketId: 'side-right', objectTypeId: SECTION_TYPE_ID });
    expect(proposal.violations).toEqual([]);
    expect(proposal.instance.id).toBe('S2');
    expect(proposal.instance.attachment).toEqual({ socketId: 'side-right', u: 0, v: 0, rotationDegrees: 0 });
    // 60 % av väggen (108 mm) avrundat nedåt, och 60 % av väggens höjd.
    expect(proposal.instance.params).toMatchObject({ width: 100, wallHeight: 60 });
  });

  it('ger en högre tillbyggnad på gaveln, där taket ger mer plats på mitten', () => {
    const proposal = proposeChild(designWithExtensions(), gingerbreadDomain, { parentId: 'S1', socketId: 'gable-front', objectTypeId: SECTION_TYPE_ID });
    expect(proposal.violations).toEqual([]);
    expect(proposal.instance.params).toMatchObject({ width: 80, wallHeight: 60 });
  });

  it('föreslår en sektion bredvid när väggen är för låg för den lägsta tillbyggnaden', () => {
    const design = designWithExtensions();
    const host = design.root.children[0];
    if (!host) throw new Error('Mallen saknar sektion');
    host.params = { ...HOST_PARAMS, wallHeight: 40 };
    const proposal = proposeChild(design, gingerbreadDomain, { parentId: 'S1', socketId: 'side-right', objectTypeId: SECTION_TYPE_ID }, (key) => key);
    expect(proposal.violations).toEqual([]);
    expect(proposal.instance.attachment?.socketId).toBe('beside-side-right');
  });

  it('snäpper läget längs väggen till 5 mm och blir en sektion bredvid förbi hörnet', () => {
    const design = designWithExtensions(extension('side-right'));
    const attachmentAt = (u: number) => findInstance(snapAttachmentOffset(design, gingerbreadDomain, 'S2', u).root, 'S2')?.attachment;
    expect(attachmentAt(23)).toMatchObject({ u: 25, socketId: 'side-right' });
    // Väggen är 180 mm och tillbyggnaden 80 mm. Från hörn till hörn går det till ±50 mm.
    expect(attachmentAt(50)).toMatchObject({ u: 50, socketId: 'side-right' });
    // Längre ut går den förbi hörnet och står bredvid, så länge den har minst en tjocklek (4 mm) kontakt med väggen: 90 + 40 − 4 = 126 mm.
    expect(attachmentAt(55)).toMatchObject({ u: 55, socketId: 'beside-side-right' });
    expect(attachmentAt(200)).toMatchObject({ u: 125, socketId: 'beside-side-right' });
    expect(attachmentAt(-200)).toMatchObject({ u: -125, socketId: 'beside-side-right' });
  });

  it('räknar ut hur långt sektionen kan flyttas, som tillbyggnad eller bredvid', () => {
    const design = designWithExtensions(extension('side-right'));
    const entry = placeInstances(design, gingerbreadDomain).find((candidate) => candidate.instance.id === 'S2');
    if (!entry) throw new Error('Saknar S2');
    // Halva väggen och halva sektionen med takutsprången.
    const reach = measureOffsetReach(entry);
    expect(reach).toBeGreaterThan(130);
    expect(findAllowedOffsetRange(design, gingerbreadDomain, { instanceId: 'S2', currentU: 0, maxReachMm: reach })).toEqual({ min: -125, max: 125 });
  });

  it('låter huset bli kortare och lägre än tillbyggnaden, som då står bredvid', () => {
    const design = designWithExtensions(extension('side-right', { ...EXTENSION_PARAMS, wallHeight: 60 }));
    const depth = findAllowedParamRange(design, gingerbreadDomain, { instanceId: 'S1', param: 'depth', current: 180, step: 5, min: 60, max: 400 });
    // Blir huset kortare än tillbyggnaden står den bredvid i stället, ända ner till schemats minsta längd.
    expect(depth).toEqual({ min: 60, max: 400 });
    const wallHeight = findAllowedParamRange(design, gingerbreadDomain, { instanceId: 'S1', param: 'wallHeight', current: 100, step: 5, min: 40, max: 300 });
    // Blir huset lägre än tillbyggnaden står den bredvid i stället.
    expect(wallHeight.min).toBe(40);
    const lowHouse = setParamWithinRules(design, gingerbreadDomain, { instanceId: 'S1', key: 'wallHeight', value: 40 });
    expect(findInstance(lowHouse.root, 'S2')?.attachment?.socketId).toBe('beside-side-right');
  });

  it('släpper gränserna när designen redan har fel, så att man kan ändra sig ur felet', () => {
    const design = designWithExtensions(extension('side-right', { ...EXTENSION_PARAMS, wallHeight: 120 }));
    expect(findAllowedParamRange(design, gingerbreadDomain, { instanceId: 'S2', param: 'wallHeight', current: 120, step: 5, min: 40, max: 300 })).toEqual({ min: 40, max: 300 });
  });
});

describe('tak som ärvs till en ny tillbyggnad', () => {
  const houseWithShedRoof = (roofPitch: number) => {
    const design = designWithExtensions();
    const host = design.root.children[0];
    if (!host) throw new Error('Mallen saknar sektion');
    host.params = { ...HOST_PARAMS, roof: 'shed', roofPitch };
    return design;
  };

  it('gör ett ärvt pulpettak flackare när ingen vägg ryms på gaveln med förälderns lutning', () => {
    const proposal = proposeChild(houseWithShedRoof(45), gingerbreadDomain, { parentId: 'S1', socketId: 'gable-front', objectTypeId: SECTION_TYPE_ID });
    expect(proposal.violations).toEqual([]);
    expect(proposal.instance.params.roof).toBe('shed');
    expect(proposal.instance.params.roofPitch).toBeLessThan(45);
  });

  it('behåller förälderns lutning när någon storlek ryms med den', () => {
    const proposal = proposeChild(houseWithShedRoof(60), gingerbreadDomain, { parentId: 'S1', socketId: 'side-right', objectTypeId: SECTION_TYPE_ID });
    expect(proposal.violations).toEqual([]);
    expect(proposal.instance.params).toMatchObject({ roof: 'shed', roofPitch: 60 });
  });
});
