import { gingerbreadDomain } from '../domains/gingerbread';

/**
 * Ägaren har valt en app för alla domäner, med startsida först när det finns
 * en andra domän. Tills dess är pepparkakshus den enda.
 */
export const activeDomain = gingerbreadDomain;

export function translate(key: string): string {
  return activeDomain.strings[key] ?? key;
}
