import type { Design } from '../model/design';
import type { Domain } from '../model/domain';
import type { Part } from '../model/part';
import { collectParts } from '../pipeline/buildParts';
import type { PlacedInstance } from '../pipeline/placeInstances';
import { placeInstances } from '../pipeline/placeInstances';
import type { RuleViolation } from './rule';
import { validateDesign } from './validateDesign';
import { coreStrings } from '../text/strings.sv';

export interface DesignEvaluation {
  placed: PlacedInstance[];
  parts: Part[];
  violations: RuleViolation[];
}

/**
 * Delar och regelbrott för en design. Kastar bara när designen inte går att
 * räkna alls, t.ex. vid ogiltiga parametrar; brott mot reglerna kommer i listan.
 */
export function evaluateDesign(design: Design, domain: Domain, resolveLabel: (key: string) => string): DesignEvaluation {
  const placed = placeInstances(design, domain);
  const { parts, failedInstanceIds } = collectParts(placed);
  const failures: RuleViolation[] = failedInstanceIds.map((instanceId) => ({ level: 'error', instanceId, message: coreStrings.openingSplitsPart }));
  return { placed, parts, violations: [...validateDesign(placed, domain.rules, resolveLabel), ...failures] };
}
