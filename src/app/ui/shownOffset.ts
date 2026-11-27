import type { OffsetRange } from '../../core/rules/placement';

/**
 * Läget längs väggen som fältet visar. Kopplingspunktens u pekar åt vänster
 * sett utifrån mot väggen, så fältet visar -u: plus flyttar objektet åt höger
 * och minus åt vänster (ägarens val).
 */
export function toShownOffset(u: number): number {
  return u === 0 ? 0 : -u;
}

/** Fältets värde tillbaka till kopplingspunktens u. */
export function fromShownOffset(shown: number): number {
  return toShownOffset(shown);
}

/** Gränserna för u som gränser för fältet. */
export function toShownOffsetRange(range: OffsetRange): OffsetRange {
  return { min: toShownOffset(range.max), max: toShownOffset(range.min) };
}
