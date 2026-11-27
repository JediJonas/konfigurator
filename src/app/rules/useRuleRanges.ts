import { useEffect, useRef, useState } from 'react';
import type { ParamField } from '../../core/model/paramForm';
import { describeParams, isFieldVisible } from '../../core/model/paramForm';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import type { OffsetRange } from '../../core/rules/placement';
import { measureOffsetReach } from '../../core/rules/placement';
import { activeDomain } from '../activeDomain';
import { useDesignStore } from '../state/designStore';
import type { RangeRequest, RangeResult } from './ruleRanges';
import { computeRanges, createLatestRequests } from './ruleRanges';

type ResultListener = (result: RangeResult) => void;

/** Räknaren delas av alla fält; för varje objekt räknas bara den senaste begäran klart. */
let worker: Worker | undefined;
const listeners = new Set<ResultListener>();
let nextRequestId = 1;
const latest = createLatestRequests();

function sendRequest(request: Omit<RangeRequest, 'id'>): number {
  const id = nextRequestId++;
  const full = { ...request, id };
  latest.mark(full);
  if (typeof Worker === 'undefined') {
    // Utan räknare vid sidan av, t.ex. i en äldre webbläsare, räknas gränserna direkt.
    void computeRanges(full, activeDomain, notify, async () => latest.isOutdated(full));
    return id;
  }
  worker ??= createWorker();
  worker.postMessage(full);
  return id;
}

function createWorker(): Worker {
  const created = new Worker(new URL('./rangeWorker.ts', import.meta.url), { type: 'module' });
  created.onmessage = (event: MessageEvent<RangeResult>) => notify(event.data);
  return created;
}

function notify(result: RangeResult) {
  listeners.forEach((listener) => listener(result));
}

/** Gränserna som är kända för ett objekt: läget och fälten, med nyckeln som i `RangeResult`. */
export type KnownRanges = Record<string, OffsetRange>;

/**
 * Gränserna för det öppna objektets läge och mått, räknade vid sidan av.
 * Medan en ny beräkning pågår gäller de senast kända gränserna, så att
 * fälten och 3D-vyn svarar direkt. Fältet som ändrades sist räknas först.
 */
export function useRuleRanges(entry: PlacedInstance, isOpen: boolean, isMovable: boolean): KnownRanges {
  const design = useDesignStore((state) => state.design);
  const [ranges, setRanges] = useState<{ instanceId: string; values: KnownRanges }>({ instanceId: entry.instance.id, values: {} });
  const previousParams = useRef(entry.params);
  const lastChangedKey = useRef<string | undefined>(undefined);
  const requestId = useRef(0);
  const { instance, objectType, params } = entry;

  useEffect(() => {
    const listener: ResultListener = (result) => {
      if (result.requestId !== requestId.current) return;
      setRanges((current) => ({
        instanceId: result.instanceId,
        values: { ...(current.instanceId === result.instanceId ? current.values : {}), [result.key]: result.range },
      }));
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    const changed = Object.keys(params).find((key) => params[key] !== previousParams.current[key]);
    if (changed) lastChangedKey.current = changed;
    previousParams.current = params;
    if (!isOpen) return;
    const fields = listRangedFields(describeParams(objectType.params), params);
    const first = lastChangedKey.current;
    const ordered = [...fields.filter((field) => field.param === first), ...fields.filter((field) => field.param !== first)];
    const offset = isMovable && entry.socket ? { currentU: instance.attachment?.u ?? 0, maxReachMm: measureOffsetReach(entry) } : undefined;
    requestId.current = sendRequest({ design, instanceId: instance.id, offset, fields: ordered });
    // entry ändras med designen; designen räcker som beroende.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design, instance.id, isOpen, isMovable]);

  return ranges.instanceId === instance.id ? ranges.values : {};
}

/** Synliga talfält med schemats gränser, som sökningen aldrig går förbi. */
function listRangedFields(fields: ParamField[], params: Record<string, unknown>): RangeRequest['fields'] {
  return fields.flatMap((field) => {
    const current = params[field.key];
    if (field.kind !== 'number' || typeof current !== 'number' || field.min === undefined || field.max === undefined) return [];
    // Dolda fält, t.ex. kantens höjd när taket inte är platt, behöver inga gränser.
    if (!isFieldVisible(field, params, fields)) return [];
    return [{ param: field.key, current, step: field.meta.step ?? 1, min: field.min, max: field.max }];
  });
}
