import { useEffect, useRef, useState } from 'react';
import type { Socket } from '../../core/model/objectType';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import { activeDomain, translate } from '../activeDomain';
import { useDesignStore } from '../state/designStore';
import type { WallProposalRequest, WallProposalResult, WallProposalState } from './wallProposals';
import { computeWallProposals, wallKey } from './wallProposals';

type ResultListener = (result: WallProposalResult) => void;

let worker: Worker | undefined;
const listeners = new Set<ResultListener>();
let nextRequestId = 1;

function sendRequest(request: Omit<WallProposalRequest, 'id'>): number {
  const id = nextRequestId++;
  const full = { ...request, id };
  if (typeof Worker === 'undefined') {
    // Utan räknare vid sidan av, t.ex. i en äldre webbläsare, räknas förslagen direkt.
    queueMicrotask(() => notify(computeWallProposals(full, activeDomain, translate)));
    return id;
  }
  worker ??= createWorker();
  worker.postMessage(full);
  return id;
}

function createWorker(): Worker {
  const created = new Worker(new URL('./proposalWorker.ts', import.meta.url), { type: 'module' });
  created.onmessage = (event: MessageEvent<WallProposalResult>) => notify(event.data);
  return created;
}

function notify(result: WallProposalResult) {
  listeners.forEach((listener) => listener(result));
}

/**
 * Vilka objekt som går att lägga till på väggen, räknade vid sidan av. Medan
 * en ny beräkning pågår gäller de senast kända, och innan någon är känd räknas
 * alla som möjliga; ett tryck prövar förslaget igen och lägger inget som inte går.
 */
export function useWallProposals(entry: PlacedInstance, wall: Socket): WallProposalState[] | undefined {
  const design = useDesignStore((state) => state.design);
  const key = wallKey(entry.instance.id, wall.id);
  const [known, setKnown] = useState<{ key: string; states: WallProposalState[] } | undefined>(undefined);
  const requestId = useRef(0);

  useEffect(() => {
    const listener: ResultListener = (result) => {
      if (result.requestId === requestId.current) setKnown({ key: result.wallKey, states: result.states });
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    requestId.current = sendRequest({ design, parentId: entry.instance.id, socketId: wall.id });
  }, [design, entry.instance.id, wall.id]);

  return known?.key === key ? known.states : undefined;
}
