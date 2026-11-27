import { describe, expect, it } from 'vitest';
import { hasAnyErrorRemembered, listViolationKeysRemembered } from '../../../src/core/rules/ruleCheck';
import { gingerbreadDomain } from '../../../src/domains/gingerbread';
import { designWithExtensions, extension, EXTENSION_PARAMS } from '../../domains/extensionFixtures';

describe('ihågkomna regelbrott', () => {
  it('ger samma svar för en kopia med samma värden, utan att räkna om', () => {
    const first = listViolationKeysRemembered(designWithExtensions(extension('side-right')), gingerbreadDomain);
    const second = listViolationKeysRemembered(designWithExtensions(extension('side-right')), gingerbreadDomain);
    expect(second).toBe(first);
  });

  it('räknar om en design som ändrats efter att den prövats', () => {
    const design = designWithExtensions(extension('side-right'));
    expect(hasAnyErrorRemembered(design, gingerbreadDomain)).toBe(false);
    const section = design.root.children[0]?.children[0];
    if (!section) throw new Error('Mallen saknar tillbyggnad');
    // En tillbyggnad som är högre än väggen och inte heller kan stå bredvid den på det här läget.
    section.params = { ...EXTENSION_PARAMS, width: 400 };
    expect(hasAnyErrorRemembered(design, gingerbreadDomain)).toBe(true);
  });
});
