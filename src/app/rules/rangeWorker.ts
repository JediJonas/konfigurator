/// <reference lib="webworker" />
import { activeDomain } from '../activeDomain';
import type { RangeRequest, RangeResult } from './ruleRanges';
import { computeRanges } from './ruleRanges';

/**
 * Räknar fältens gränser vid sidan av, så att 3D-vyn och fälten svarar direkt
 * medan man scrollar ett mått. Bara den senaste begäran räknas klart.
 */
let latestId = 0;

const yieldToMessages = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

self.onmessage = (event: MessageEvent<RangeRequest>) => {
  const request = event.data;
  latestId = request.id;
  void (async () => {
    // Väntar ett varv, så att en begäran som kommer direkt efter tar över.
    await yieldToMessages();
    if (request.id !== latestId) return;
    await computeRanges(
      request,
      activeDomain,
      (result: RangeResult) => self.postMessage(result),
      async () => {
        await yieldToMessages();
        return request.id !== latestId;
      },
    );
  })();
};
