import type { Design } from '../model/design';
import type { Domain } from '../model/domain';
import { findInstance, updateInstance } from '../model/instanceTree';
import type { ParamField } from '../model/paramForm';
import { describeParams, isFieldVisible } from '../model/paramForm';
import { findObjectType } from '../pipeline/placeInstances';
import { hasAnyErrorRemembered } from './ruleCheck';
import { attachInFittingSockets, listAffectedInstanceIds } from './socketChoice';

/** Steget i sökningen när fältet inte anger något. */
const DEFAULT_SEARCH_STEP = 1;


export interface ParamChange {
  instanceId: string;
  key: string;
  value: unknown;
}

type NumberField = Extract<ParamField, { kind: 'number' }>;

/**
 * Sätter ett fält på ett objekt. När ett val, t.ex. taktypen, gör att
 * designen bryter mot reglerna med de övriga värdena i samma grupp, t.ex. en
 * ärvd taklutning som är för brant för den nya taktypen, flyttas det första
 * synliga talet i gruppen som kan rätta det till närmaste värde som klarar
 * reglerna, utan att objektet byter kopplingspunkt. Går det inte att rätta får
 * objektet byta kopplingspunkt, t.ex. från tillbyggnad till sektion bredvid.
 * Hade designen redan fel, eller går inget av det, sätts bara valet, så att
 * panelen kan visa felet.
 */
export function setParamWithinRules(design: Design, domain: Domain, change: ParamChange): Design {
  const { instanceId, key, value } = change;
  const plain = withParam(design, { instanceId, key, value });
  const changed = attachInFittingSockets(plain, domain, listAffectedInstanceIds(plain, instanceId));
  const instance = findInstance(design.root, instanceId);
  if (!instance) return changed;
  const fields = describeParams(findObjectType(domain, instance.type).params);
  const field = fields.find((candidate) => candidate.key === key);
  if (field?.kind !== 'choice' || !field.meta.groupKey) return changed;
  if (!hasAnyError(plain, domain) || hasAnyError(design, domain)) return changed;
  const params = { ...instance.params, [key]: value };
  const adjustable = fields.filter(
    (candidate): candidate is NumberField =>
      candidate.kind === 'number' && candidate.meta.groupKey === field.meta.groupKey && isFieldVisible(candidate, params, fields),
  );
  for (const candidate of adjustable) {
    const current = params[candidate.key] ?? candidate.defaultValue;
    if (typeof current !== 'number') continue;
    const fixed = findNearestValidValue(plain, domain, { instanceId, field: candidate, current });
    if (fixed) return fixed;
  }
  return changed;
}

interface NumberSearch {
  instanceId: string;
  field: NumberField;
  current: number;
}

/** Designen med fältets närmaste värde som klarar reglerna, inom schemats gränser och lägre värden först vid lika avstånd. */
function findNearestValidValue(design: Design, domain: Domain, search: NumberSearch): Design | undefined {
  const { instanceId, field, current } = search;
  const step = field.meta.step ?? DEFAULT_SEARCH_STEP;
  const min = field.min ?? current;
  const max = field.max ?? current;
  for (let distance = step; current - distance >= min || current + distance <= max; distance += step) {
    for (const value of [current - distance, current + distance]) {
      if (value < min || value > max) continue;
      const candidate = withParam(design, { instanceId, key: field.key, value });
      if (!hasAnyError(candidate, domain)) return candidate;
    }
  }
  return undefined;
}

function withParam(design: Design, change: ParamChange): Design {
  return {
    ...design,
    root: updateInstance(design.root, change.instanceId, (instance) => ({ ...instance, params: { ...instance.params, [change.key]: change.value } })),
  };
}

function hasAnyError(design: Design, domain: Domain): boolean {
  return hasAnyErrorRemembered(design, domain);
}
