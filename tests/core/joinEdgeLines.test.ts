import { describe, expect, it } from 'vitest';
import { joinEdgeLines } from '../../src/core/geometry/joinEdgeLines';
import { vec3 } from '../../src/core/geometry/vector';

describe('joinEdgeLines', () => {
  it('lämnar en lodrät kant lodrät när en kant bredvid ligger några mm åt sidan', () => {
    // Väggens hörn slutar 6 mm innanför takutsprångets kant: hörnet ska inte luta mot den.
    const corner = [vec3(40, 0, 0), vec3(40, 70, 0)];
    const eave = [vec3(46, 75, 0), vec3(46, 75, -80)];
    const joined = joinEdgeLines([corner, eave], 7);
    const top = joined.flat().filter((point) => point.y > 60 && point.y < 72 && point.z === 0 && point.x < 43);
    expect(top.length).toBeGreaterThan(0);
    expect(joined.some((line) => line.some((point) => point.x === 40 && point.y === 70))).toBe(true);
  });

  it('flyttar en fri ände till en kant som ligger nära i linjens egen riktning', () => {
    const wall = [vec3(0, 0, 0), vec3(0, 60, 0)];
    const roof = [vec3(-30, 63, 0), vec3(30, 63, 0)];
    const joined = joinEdgeLines([wall, roof], 7);
    expect(joined.flat().some((point) => point.x === 0 && Math.abs(point.y - 63) < 1e-9)).toBe(true);
  });
});
