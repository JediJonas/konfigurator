import { describe, expect, it } from 'vitest';
import type { Design } from '../../src/core/model/design';
import { evaluateDesign, listViolations } from '../../src/core/rules/evaluateDesign';
import { findAllowedParamRange } from '../../src/core/rules/placement';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { designWithExtensions, extension, HOST_PARAMS } from './extensionFixtures';

const resolveKey = (key: string) => key;

function withHost(params: Record<string, unknown>): Design {
  const design = designWithExtensions();
  const host = design.root.children[0];
  if (host) host.params = { ...HOST_PARAMS, ...params };
  return design;
}

function listErrors(design: Design): string[] {
  return evaluateDesign(design, gingerbreadDomain, resolveKey).violations.map((violation) => `${violation.instanceId} ${violation.message}`);
}

/** Ägarens val: varje bit ska rymmas på plåten, 400 × 300 mm. */
describe('varje bit ryms på plåten', () => {
  it('ger fel när takfallet blir längre än plåten, men en sparad design går fortfarande att räkna', () => {
    // 400 mm långt hus med 10 mm takutsprång vid gavlarna: takfallen blir 420 mm.
    expect(listErrors(withHost({ depth: 400 }))).toEqual(['S1 rule.sectionFitsSheet']);
    expect(listErrors(withHost({ depth: 380 }))).toEqual([]);
  });

  it('låter en smal vägg vara högre än plåtens kortsida', () => {
    expect(listErrors(withHost({ width: 100, depth: 100, wallHeight: 400, roof: 'spire4' }))).toEqual([]);
    expect(listErrors(withHost({ width: 100, depth: 100, wallHeight: 380, roof: 'flat' }))).toEqual([]);
  });

  it('ger fel när gaveln med takets höjd blir högre än plåten', () => {
    expect(listErrors(withHost({ width: 140, wallHeight: 350 }))).toEqual(['S1 rule.sectionFitsSheet']);
  });

  it('stoppar fältet för husets längd där taket slutar rymmas', () => {
    const range = findAllowedParamRange(withHost({}), gingerbreadDomain, { instanceId: 'S1', param: 'depth', current: 180, step: 5, min: 60, max: 400 });
    expect(range.max).toBe(380);
  });

  it('mäter inte en tillbyggnads tak som är förlängt till vinkelrännan förrän rännan har klippt det', () => {
    const design = designWithExtensions(extension('side-right'));
    expect(listViolations(design, gingerbreadDomain, resolveKey)).toEqual([]);
    expect(listErrors(design)).toEqual([]);
  });
});
