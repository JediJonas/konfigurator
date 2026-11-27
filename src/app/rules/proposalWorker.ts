/// <reference lib="webworker" />
import { activeDomain, translate } from '../activeDomain';
import type { WallProposalRequest } from './wallProposals';
import { computeWallProposals, wallKey } from './wallProposals';

/**
 * Räknar vilka knappar under en vägg som går (+ Sektion, + Fönster, + Dörr)
 * vid sidan av, så att fälten och 3D-vyn svarar direkt när designen ändras.
 * Bara den senaste begäran för varje vägg räknas.
 */
const latestIds = new Map<string, number>();

const yieldToMessages = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

self.onmessage = (event: MessageEvent<WallProposalRequest>) => {
  const request = event.data;
  const key = wallKey(request.parentId, request.socketId);
  latestIds.set(key, request.id);
  void (async () => {
    // Väntar ett varv, så att en begäran som kommer direkt efter tar över.
    await yieldToMessages();
    if (latestIds.get(key) !== request.id) return;
    self.postMessage(computeWallProposals(request, activeDomain, translate));
  })();
};
