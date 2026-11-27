import type { Design } from '../../core/model/design';
import type { Domain } from '../../core/model/domain';
import type { OffsetRange, ParamRangeRequest } from '../../core/rules/placement';
import { findAllowedOffsetRange, findAllowedParamRange } from '../../core/rules/placement';

/** Nyckeln för läget längs kopplingspunkten bland fältens gränser. */
export const OFFSET_KEY = 'u';

/** Gränserna för ett objekts läge och mått, räknade för en viss design. */
export interface RangeRequest {
  id: number;
  design: Design;
  instanceId: string;
  offset?: { currentU: number; maxReachMm: number };
  fields: Omit<ParamRangeRequest, 'instanceId'>[];
}

export interface RangeResult {
  requestId: number;
  instanceId: string;
  /** `OFFSET_KEY` för läget, annars fältets nyckel. */
  key: string;
  range: OffsetRange;
}

/**
 * Räknar gränserna en i taget, först läget och sedan fälten i ordning, och
 * lämnar varje resultat så snart det finns. `shouldStop` frågas mellan varje,
 * så att en ny begäran kan ta över när man fortsätter ändra.
 */
export async function computeRanges(
  request: RangeRequest,
  domain: Domain,
  report: (result: RangeResult) => void,
  shouldStop: () => Promise<boolean>,
): Promise<void> {
  const { id: requestId, design, instanceId } = request;
  if (request.offset) {
    report({ requestId, instanceId, key: OFFSET_KEY, range: findAllowedOffsetRange(design, domain, { instanceId, ...request.offset }) });
  }
  for (const field of request.fields) {
    if (await shouldStop()) return;
    report({ requestId, instanceId, key: field.param, range: findAllowedParamRange(design, domain, { instanceId, ...field }) });
  }
}
