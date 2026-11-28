import { describe, expect, it } from 'vitest';
import { identityMatrix } from '../../../src/core/geometry/matrix';
import type { Part } from '../../../src/core/model/part';
import { doesPartFitSheet } from '../../../src/core/rules/sheetFit';

const SHEET = { width: 400, height: 300 };

function rectanglePart(width: number, height: number): Part {
  const outline = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  return { id: 'P', sourceInstanceId: 'S1', labelKey: 'part', outline, holes: [], thickness: 4, transform: identityMatrix(), buildStep: 1 };
}

describe('delar på skivan', () => {
  it('rymmer en del lika stor som skivan, som den ligger eller vriden 90°', () => {
    expect(doesPartFitSheet(rectanglePart(400, 300), SHEET)).toBe(true);
    expect(doesPartFitSheet(rectanglePart(300, 400), SHEET)).toBe(true);
  });

  it('rymmer inte en del som är för lång eller för bred åt båda hållen', () => {
    expect(doesPartFitSheet(rectanglePart(401, 20), SHEET)).toBe(false);
    expect(doesPartFitSheet(rectanglePart(310, 310), SHEET)).toBe(false);
  });
});
