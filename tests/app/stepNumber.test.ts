import { describe, expect, it } from 'vitest';
import { canStep, findGap, stepNumber } from '../../src/app/ui/stepNumber';

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

  it('hoppar över glapp där inget går att bygga', () => {
    const limits = { min: 60, max: 400, step: 5, gaps: [{ after: 120, before: 130 }] };
    expect(stepNumber(120, 1, limits)).toBe(130);
    expect(stepNumber(130, -1, limits)).toBe(120);
    // Ett värde mitt i glappet, t.ex. från ett äldre sparat hus, går till närmaste ände åt det hållet.
    expect(stepNumber(125, 1, limits)).toBe(130);
    expect(stepNumber(125, -1, limits)).toBe(120);
    expect(stepNumber(115, 1, limits)).toBe(120);
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

describe('findGap', () => {
  it('hittar glappet för värden strikt mellan ändarna', () => {
    const gaps = [{ after: 120, before: 130 }];
    expect(findGap(125, gaps)).toEqual({ after: 120, before: 130 });
    expect(findGap(120, gaps)).toBeUndefined();
    expect(findGap(130, gaps)).toBeUndefined();
    expect(findGap(125)).toBeUndefined();
  });
});
