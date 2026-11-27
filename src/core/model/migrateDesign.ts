import type { Design } from './design';
import { DESIGN_SCHEMA_VERSION } from './design';

/**
 * Gör om en sparad design till dagens format. Varje höjning av
 * `DESIGN_SCHEMA_VERSION` får ett steg här, så att äldre sparade och delade
 * designer går att öppna. Kastar för en design från en nyare version av appen
 * eller något som inte är en design; parametrarna prövas först när designen räknas.
 */
export function migrateDesign(stored: unknown): Design {
  if (!isDesignLike(stored)) throw new Error('Det sparade är ingen design.');
  if (stored.version > DESIGN_SCHEMA_VERSION) throw new Error(`Designen är från en nyare version (${stored.version}).`);
  // Version 1 är den första; här läggs stegen till när formatet ändras.
  return stored;
}

function isDesignLike(value: unknown): value is Design {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Design>;
  return typeof candidate.version === 'number' && typeof candidate.domain === 'string' && typeof candidate.root === 'object' && candidate.root !== null && typeof candidate.material === 'object';
}
