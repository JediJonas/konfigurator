/// <reference lib="webworker" />
import { activeDomain } from '../activeDomain';
import type { RangeRequest, RangeResult } from './ruleRanges';
import { computeRanges, createLatestRequests } from './ruleRanges';

/**
 * Räknar fältens gränser vid sidan av, så att 3D-vyn och fälten svarar direkt
 * medan man scrollar ett mått. Bara den senaste begäran för varje objekt räknas klart.
 */
const latest = createLatestRequests();

const yieldToMessages = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

self.onmessage = (event: MessageEvent<RangeRequest>) => {
  const request = event.data;
  latest.mark(request);
  const isOutdated = () => latest.isOutdated(request);
  void (async () => {
    // Väntar ett varv, så att en begäran som kommer direkt efter tar över.
    await yieldToMessages();
    if (isOutdated()) return;
    await computeRanges(
      request,
      activeDomain,
      (result: RangeResult) => self.postMessage(result),
      async () => {
        await yieldToMessages();
        return isOutdated();
      },
    );
  })();
};
