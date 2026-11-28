import { describe, expect, it } from 'vitest';
import { mergeParallelSegments } from '../../src/core/geometry/mergeParallelSegments';
import { joinEdgeLines } from '../../src/core/geometry/joinEdgeLines';
import { vec3 } from '../../src/core/geometry/vector';

const MERGE_DISTANCE_MM = 7;

describe('parallella kanter', () => {
  it('flyttar två lika långa kanter till mitten', () => {
    const merged = mergeParallelSegments([{ start: vec3(0, 0, 0), end: vec3(0, 10, 0) }, { start: vec3(5, 0, 0), end: vec3(5, 10, 0) }], MERGE_DISTANCE_MM);
    expect(merged).toEqual([{ start: vec3(2.5, 0, 0), end: vec3(2.5, 10, 0) }]);
  });

  it('låter korta kanter gå upp i en lång bredvid, så att den långa förblir rak', () => {
    const long = { start: vec3(0, 0, 4), end: vec3(0, 40, 4) };
    const shorts = [0, 15, 30].map((y) => ({ start: vec3(0, y, 0), end: vec3(0, y + 10, 0) }));
    expect(mergeParallelSegments([...shorts, long], MERGE_DISTANCE_MM)).toEqual([long]);
  });
});

describe('skarvar', () => {
  it('fogar ihop ändar som nästan möts till en obruten linje', () => {
    const lines = joinEdgeLines([[vec3(0, 0, 0), vec3(10, 0, 0)], [vec3(11, 1, 0), vec3(11, 10, 0)]], MERGE_DISTANCE_MM);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveLength(3);
  });

  it('drar inte ihop korta bitar längs en båge till en klump', () => {
    // Fem korta bitar med små glapp: varje glapp fogas för sig.
    const pieces = Array.from({ length: 5 }, (_, index) => [vec3(index * 3, 0, 0), vec3(index * 3 + 2.5, 0, 0)]);
    const lines = joinEdgeLines(pieces, MERGE_DISTANCE_MM);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveLength(6);
    const xs = (lines[0] ?? []).map((point) => point.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });
});
