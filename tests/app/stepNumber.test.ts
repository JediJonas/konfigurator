import { describe, expect, it } from 'vitest';
import { canStep, stepNumber } from '../../src/app/ui/stepNumber';

describe('stepNumber', () => {
  it('går ett steg upp och ner', () => {
    expect(stepNumber(140, 1, { step: 5 })).toBe(145);
    expect(stepNumber(140, -1, { step: 5 })).toBe(135);
  });

  it('går till närmaste jämna steg från ett värde mellan två steg', () => {
    expect(stepNumber(143, 1, { step: 5 })).toBe(145);
    expect(stepNumber(143, -1, { step: 5 })).toBe(140);
  });

  it('räknar decimalsteg utan avrundningsfel', () => {
    expect(stepNumber(4, 1, { step: 0.5 })).toBe(4.5);
    expect(stepNumber(0.2, 1, { step: 0.1 })).toBe(0.3);
  });

  it('fungerar för negativa lägen längs väggen', () => {
    expect(stepNumber(-10, -1, { step: 5 })).toBe(-15);
    expect(stepNumber(-12, 1, { step: 5 })).toBe(-10);
  });

  it('stannar vid gränserna', () => {
    expect(stepNumber(398, 1, { min: 60, max: 400, step: 5 })).toBe(400);
    expect(stepNumber(400, 1, { min: 60, max: 400, step: 5 })).toBe(400);
    expect(stepNumber(62, -1, { min: 60, max: 400, step: 5 })).toBe(60);
  });

  it('tar tillbaka ett värde utanför gränserna', () => {
    expect(stepNumber(500, -1, { min: 60, max: 400, step: 5 })).toBe(400);
  });

  it('använder steget 1 när fältet inte anger något', () => {
    expect(stepNumber(7, 1, {})).toBe(8);
  });
});

describe('canStep', () => {
  it('är falskt vid gränsen åt det hållet', () => {
    expect(canStep(400, 1, { min: 60, max: 400, step: 5 })).toBe(false);
    expect(canStep(400, -1, { min: 60, max: 400, step: 5 })).toBe(true);
  });

  it('är falskt åt båda hållen när inget utrymme finns', () => {
    expect(canStep(0, 1, { min: 0, max: 0, step: 5 })).toBe(false);
    expect(canStep(0, -1, { min: 0, max: 0, step: 5 })).toBe(false);
  });
});
