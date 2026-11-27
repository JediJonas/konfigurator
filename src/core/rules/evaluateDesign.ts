import type { Design } from '../model/design';
import type { Domain } from '../model/domain';
import type { Part } from '../model/part';
import { applyModifiers } from '../pipeline/applyModifiers';
import { collectParts } from '../pipeline/buildParts';
import type { InteractionResolver } from '../pipeline/interaction';
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
  const { parts, failedInstanceIds } = collectParts(placed, domain.interactions);
  return { placed, parts, violations: [...validateDesign(placed, domain.rules, resolveLabel), ...describeFailures(failedInstanceIds), ...listConflicts(placed, domain.interactions, resolveLabel)] };
}

/**
 * Bara regelbrotten, utan att räkna fram de färdiga delarna. Samverkan, t.ex.
 * vinkelrännor, ändrar bara delar och hoppas över; möten som samverkan inte
 * kan lösa prövas däremot. Används när många lägen och mått prövas efter varandra.
 */
export function listViolations(design: Design, domain: Domain, resolveLabel: (key: string) => string): RuleViolation[] {
  const placed = placeInstances(design, domain);
  const { failedInstanceIds } = applyModifiers(
    placed.flatMap((entry) => entry.parts),
    placed.flatMap((entry) => entry.modifiers.map((modifier) => ({ sourceInstanceId: entry.instance.id, modifier }))),
  );
  return [...validateDesign(placed, domain.rules, resolveLabel), ...describeFailures(failedInstanceIds), ...listConflicts(placed, domain.interactions, resolveLabel)];
}

function listConflicts(placed: readonly PlacedInstance[], interactions: readonly InteractionResolver[], resolveLabel: (key: string) => string): RuleViolation[] {
  return interactions.flatMap((interaction) =>
    (interaction.listConflicts?.(placed) ?? []).map((conflict) => ({ level: 'error' as const, instanceId: conflict.instanceId, message: resolveLabel(conflict.messageKey) })),
  );
}

function describeFailures(failedInstanceIds: readonly string[]): RuleViolation[] {
  return failedInstanceIds.map((instanceId) => ({ level: 'error', instanceId, message: coreStrings.openingSplitsPart }));
}
