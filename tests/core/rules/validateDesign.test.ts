import { describe, expect, it } from 'vitest';
import type { Design } from '../../../src/core/model/design';
import { evaluateDesign } from '../../../src/core/rules/evaluateDesign';
import { gingerbreadDomain } from '../../../src/domains/gingerbread';
import { designWithExtensions, extension, EXTENSION_PARAMS } from '../../domains/extensionFixtures';

function findViolations(design: Design) {
  return evaluateDesign(design, gingerbreadDomain, (key) => key).violations.map((violation) => `${violation.level} ${violation.instanceId} ${violation.message}`);
}

function withHostDepth(depth: number, design: Design): Design {
  const host = design.root.children[0];
  if (host) host.params = { ...host.params, depth };
  return design;
}

/** Regelmotorn med en tabell över tillåtna och otillåtna kombinationer, SPEC.md avsnitt 17. */
describe('kopplingsreglerna för pepparkakshus', () => {
  const cases: { name: string; design: Design; expected: string[] }[] = [
    { name: 'enkla huset', design: designWithExtensions(), expected: [] },
    { name: 'tillbyggnad på långväggen', design: designWithExtensions(extension('side-right')), expected: [] },
    { name: 'tillbyggnad på framgaveln', design: designWithExtensions(extension('gable-front')), expected: [] },
    {
      name: 'tillbyggnad som är för hög för långväggen',
      design: designWithExtensions(extension('side-right', { ...EXTENSION_PARAMS, wallHeight: 105 })),
      expected: ['error S2 rule.extensionFitsWall'],
    },
    {
      name: 'tillbyggnad som går utanför långväggens ände',
      design: designWithExtensions(extension('side-right', EXTENSION_PARAMS, 60)),
      expected: ['error S2 rule.extensionFitsWall'],
    },
    {
      name: 'tillbyggnad som är vriden',
      design: designWithExtensions({ ...extension('side-right'), attachment: { socketId: 'side-right', u: 0, v: 0, rotationDegrees: 90 } }),
      expected: ['error S2 rule.extensionUpright', 'error S2 rule.extensionFitsWall'],
    },
    {
      name: 'två tillbyggnader som går in i varandra',
      design: designWithExtensions(extension('side-right', EXTENSION_PARAMS, -10), extension('side-right', EXTENSION_PARAMS, 10, 'S3')),
      expected: ['error S3 rule.sectionsOverlap'],
    },
    {
      name: 'två tillbyggnader bredvid varandra',
      design: withHostDepth(240, designWithExtensions(extension('side-right', { ...EXTENSION_PARAMS, width: 60 }, -40), extension('side-right', { ...EXTENSION_PARAMS, width: 60 }, 40, 'S3'))),
      expected: [],
    },
  ];

  it.each(cases)('$name', ({ design, expected }) => {
    expect(findViolations(design).sort()).toEqual(expected.sort());
  });

  it('tillåter bara räta vinklar på fatet', () => {
    const design = designWithExtensions();
    const host = design.root.children[0];
    if (!host?.attachment) throw new Error('Mallen saknar sektion');
    host.attachment.rotationDegrees = 45;
    expect(findViolations(design)).toContain('error S1 rule.rightAnglesOnly');
    host.attachment.rotationDegrees = -90;
    expect(findViolations(design)).not.toContain('error S1 rule.rightAnglesOnly');
  });

  it('varnar inte för höga väggar (ägarens val)', () => {
    const design = designWithExtensions();
    const host = design.root.children[0];
    if (!host) throw new Error('Mallen saknar sektion');
    host.params = { ...host.params, wallHeight: 200 };
    expect(findViolations(design)).toEqual([]);
  });

  it('ger en varning när ett mått går över en gräns i domänens regler', () => {
    const design = designWithExtensions();
    const host = design.root.children[0];
    if (!host) throw new Error('Mallen saknar sektion');
    host.params = { ...host.params, wallHeight: 200 };
    const domain = { ...gingerbreadDomain, rules: [{ kind: 'paramLimit' as const, level: 'warning' as const, objectType: host.type, param: 'wallHeight', max: 160, messageKey: 'tall' }] };
    expect(evaluateDesign(design, domain, (key) => key).violations.map((violation) => `${violation.level} ${violation.message}`)).toEqual(['warning tall']);
  });

  it('säger till när ett objekt sitter i en kopplingspunkt det inte kan fästa i', () => {
    const design = designWithExtensions();
    const host = design.root.children[0];
    if (!host) throw new Error('Mallen saknar sektion');
    const domain = { ...gingerbreadDomain, objectTypes: gingerbreadDomain.objectTypes.map((type) => (type.id === host.type ? { ...type, attachesTo: ['wall-surface'] } : type)) };
    const violations = evaluateDesign(design, domain, (key) => key).violations;
    expect(violations.map((violation) => violation.instanceId)).toEqual(['S1']);
  });
});
