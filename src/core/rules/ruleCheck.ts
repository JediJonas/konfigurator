import type { Design } from '../model/design';
import type { Domain } from '../model/domain';
import { listViolations } from './evaluateDesign';
import type { RuleViolation } from './rule';

/**
 * Så många designer som minns per domän. Sökningen efter fältens gränser
 * prövar några hundra lägen och mått, och samma design prövas ofta flera
 * gånger, t.ex. först när kopplingspunkten väljs och sedan för hela designen.
 */
const CACHE_SIZE = 2000;

/**
 * Regelbrotten med nycklar i stället för texter, eller inget om designen inte
 * gick att räkna. Placeringen minns inte, eftersom den tar mycket minne och går fort.
 */
interface CheckedDesign {
  violations?: RuleViolation[];
}

const caches = new WeakMap<Domain, Map<string, CheckedDesign>>();

const keepKey = (key: string) => key;

/**
 * Designens regelbrott med nycklar som meddelanden, ihågkomna. Går designen
 * inte att räkna kommer inget tillbaka, vilket räknas som ett fel.
 */
export function listViolationKeysRemembered(design: Design, domain: Domain): RuleViolation[] | undefined {
  const entry = rememberedEntry(design, domain);
  if (!('violations' in entry)) {
    try {
      entry.violations = listViolations(design, domain, keepKey);
    } catch {
      entry.violations = undefined;
    }
  }
  return entry.violations;
}

/** Om designen bryter mot någon regel, eller inte går att räkna. */
export function hasAnyErrorRemembered(design: Design, domain: Domain): boolean {
  const violations = listViolationKeysRemembered(design, domain);
  return !violations || violations.some((violation) => violation.level === 'error');
}

function rememberedEntry(design: Design, domain: Domain): CheckedDesign {
  let cache = caches.get(domain);
  if (!cache) {
    cache = new Map();
    caches.set(domain, cache);
  }
  const key = JSON.stringify(design);
  const found = cache.get(key);
  if (found) {
    // Läggs sist igen, så att det som användes längst sedan glöms först.
    cache.delete(key);
    cache.set(key, found);
    return found;
  }
  const created: CheckedDesign = {};
  cache.set(key, created);
  if (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return created;
}
