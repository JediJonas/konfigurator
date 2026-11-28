import type { Design } from '../../core/model/design';
import type { Domain } from '../../core/model/domain';
import { migrateDesign } from '../../core/model/migrateDesign';
import { evaluateDesign } from '../../core/rules/evaluateDesign';

/**
 * Gör om en sparad eller delad design till dagens format och prövar att den
 * går att räkna. Kastar för något som inte är en design för domänen, en design
 * från en nyare version eller en som inte går att räkna.
 */
export function readStoredDesign(stored: unknown, domain: Domain): Design {
  const migrated = migrateDesign(stored);
  if (migrated.domain !== domain.id) throw new Error(`Designen hör till domänen "${migrated.domain}".`);
  const design = domain.migrateParams?.(migrated) ?? migrated;
  evaluateDesign(design, domain, (key) => key);
  return design;
}
