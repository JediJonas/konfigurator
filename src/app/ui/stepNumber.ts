/** Hur långt − och + flyttar ett måttfält. */
export type StepDirection = -1 | 1;

export interface StepLimits {
  min?: number;
  max?: number;
  step?: number;
}

const DEFAULT_STEP = 1;
/** Decimaler som räknas med, så att t.ex. 3 · 0,1 blir 0,3 och inte 0,30000000000000004. */
const STEP_PRECISION_DECIMALS = 6;

/**
 * Nästa värde när man trycker − eller +: närmaste steg på rutnätet åt det
 * hållet, inom fältets gränser. Ett värde mellan två steg, t.ex. 143 med
 * steget 5, går till 140 eller 145 i stället för 138 eller 148, så att man
 * snabbt kommer tillbaka till jämna mått.
 */
export function stepNumber(value: number, direction: StepDirection, limits: StepLimits): number {
  const step = limits.step ?? DEFAULT_STEP;
  const stepsFromZero = roundToPrecision(value / step);
  const nextStep = direction > 0 ? Math.floor(stepsFromZero) + 1 : Math.ceil(stepsFromZero) - 1;
  return clampToLimits(roundToPrecision(nextStep * step), limits);
}

/** Om knappen åt det hållet gör något, så att den kan visas avstängd vid gränsen. */
export function canStep(value: number, direction: StepDirection, limits: StepLimits): boolean {
  return stepNumber(value, direction, limits) !== value;
}

function clampToLimits(value: number, { min, max }: StepLimits): number {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

function roundToPrecision(value: number): number {
  return Number(value.toFixed(STEP_PRECISION_DECIMALS));
}
