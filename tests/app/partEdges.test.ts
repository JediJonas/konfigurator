import { describe, expect, it } from 'vitest';
import { listPartEdges } from '../../src/app/three/partEdges';
import { vec2 } from '../../src/core/geometry/vector';

const rectangle = (x: number, y: number, width: number, height: number) => [vec2(x, y), vec2(x + width, y), vec2(x + width, y + height), vec2(x, y + height)];

function segments(positions: number[]): number[][] {
  const result: number[][] = [];
  for (let index = 0; index < positions.length; index += 6) result.push(positions.slice(index, index + 6));
  return result;
}

describe('kantlinjer på en del', () => {
  it('följer bara konturen och hålen, inte linjer mellan hål på samma höjd', () => {
    const wall = { outline: rectangle(0, 0, 170, 100), holes: [rectangle(20, 30, 10, 20), rectangle(140, 30, 10, 20)], thickness: 4 };
    const lines = segments(listPartEdges(wall));
    // Tre ringar med fyra sidor på två sidor av delen, och fyra hörn genom tjockleken per ring.
    expect(lines).toHaveLength(3 * 4 * 2 + 3 * 4);
    const longest = Math.max(...lines.filter(([, y1, , , y2]) => y1 === 30 && y2 === 30).map(([x1, , , x2]) => Math.abs((x2 ?? 0) - (x1 ?? 0))));
    expect(longest).toBe(10);
  });

  it('drar ingen linje genom tjockleken där konturen nästan går rakt, t.ex. i en rundbåge', () => {
    const arch = Array.from({ length: 17 }, (_, index) => vec2(10 * Math.cos((Math.PI * index) / 16), 10 * Math.sin((Math.PI * index) / 16)));
    const through = segments(listPartEdges({ outline: arch, holes: [], thickness: 4 })).filter(([, , z1, , , z2]) => z1 !== z2);
    expect(through).toHaveLength(2);
  });
});
