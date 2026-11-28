import { describe, expect, it } from 'vitest';
import { listOuterEdges } from '../../src/core/geometry/outerEdges';
import type { EdgeLine } from '../../src/core/geometry/outerEdges';
import { basisMatrix, identityMatrix } from '../../src/core/geometry/matrix';
import type { Matrix4 } from '../../src/core/geometry/matrix';
import { vec2, vec3 } from '../../src/core/geometry/vector';
import type { Vec3 } from '../../src/core/geometry/vector';
import type { Part } from '../../src/core/model/part';

const THICKNESS_MM = 4;
const MERGE_DISTANCE_MM = 7;
const rectangle = (x: number, y: number, width: number, height: number) => [vec2(x, y), vec2(x + width, y), vec2(x + width, y + height), vec2(x, y + height)];

function plate(id: string, outline: ReturnType<typeof rectangle>, options: { holes?: ReturnType<typeof rectangle>[]; transform?: Matrix4; hasInsideAtZero?: boolean } = {}): Part {
  return {
    id,
    sourceInstanceId: 'S1',
    labelKey: id,
    outline,
    holes: options.holes ?? [],
    thickness: THICKNESS_MM,
    transform: options.transform ?? identityMatrix(),
    buildStep: 1,
    hasInsideAtZero: options.hasInsideAtZero ?? true,
  };
}

function edges(parts: Part[]): EdgeLine[] {
  return listOuterEdges(parts, { mergeDistance: MERGE_DISTANCE_MM });
}

/** Linjerna som går längs y (lodrätt) och vars första punkt ligger nära `near` i x och z. */
function verticalLinesNear(lines: EdgeLine[], near: Vec3, toleranceMm = 1): EdgeLine[] {
  return lines.filter((line) => {
    const [first, last] = [line[0], line[line.length - 1]];
    if (!first || !last) return false;
    const isVertical = Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.z - last.z) < 1e-6 && first.y !== last.y;
    return isVertical && Math.abs(first.x - near.x) <= toleranceMm && Math.abs(first.z - near.z) <= toleranceMm;
  });
}

describe('ytterkanter', () => {
  it('ger ett hörn där två väggar möts bara en kant, på den genomgående väggens ytterhörn', () => {
    // Vägg A går ut till hörnet; vägg B står mellan med utsidan jäms med A:s ände.
    const wallA = plate('A', rectangle(0, 10, 100, 50));
    const wallB = plate('B', rectangle(0, 10, 50, 50), { transform: basisMatrix(vec3(0, 0, -1), vec3(0, 1, 0), vec3(-1, 0, 0), vec3(THICKNESS_MM, 0, 0)) });
    const lines = edges([wallA, wallB]);
    expect(verticalLinesNear(lines, vec3(0, 0, 0), THICKNESS_MM + 1)).toHaveLength(1);
    expect(verticalLinesNear(lines, vec3(0, 0, THICKNESS_MM))).toHaveLength(1);
  });

  it('ger en fog mellan två delar som möts kant mot kant en kant', () => {
    const lines = edges([plate('A', rectangle(0, 10, 50, 50)), plate('B', rectangle(50, 10, 50, 50))]);
    expect(verticalLinesNear(lines, vec3(50, 0, THICKNESS_MM))).toHaveLength(1);
  });

  it('ger en fri del utan insida en kant mitt på varje kant i stället för en på varje sida', () => {
    const lines = edges([plate('leaf', rectangle(0, 10, 30, 50), { hasInsideAtZero: false })]);
    expect(lines).toHaveLength(4);
    expect(verticalLinesNear(lines, vec3(0, 0, THICKNESS_MM / 2), 0.01)).toHaveLength(1);
  });

  it('ger en smal list mellan två hål en kant i listens mitt', () => {
    const wall = plate('wall', rectangle(0, 10, 100, 80), { holes: [rectangle(30, 30, 15, 40), rectangle(50, 30, 15, 40)] });
    const lines = verticalLinesNear(edges([wall]), vec3(47.5, 0, THICKNESS_MM), 3);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.[0]?.x).toBeCloseTo(47.5);
  });

  it('räknar inte kanter som ligger på fatet', () => {
    const lines = edges([plate('wall', rectangle(0, 0, 100, 50))]);
    // Sidorna och överkanten, men inte underkanten.
    expect(lines).toHaveLength(3);
    expect(lines.every((line) => line.some((point) => point.y > 1))).toBe(true);
  });
});
