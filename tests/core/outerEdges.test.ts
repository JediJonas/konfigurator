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
const HOLE_MARGIN_MM = 2.2;
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
  return listOuterEdges(parts, { mergeDistance: MERGE_DISTANCE_MM, holeMargin: HOLE_MARGIN_MM });
}

interface Segment {
  start: Vec3;
  end: Vec3;
}

function segmentsOf(lines: EdgeLine[]): Segment[] {
  return lines.flatMap((line) => line.slice(1).map((end, index) => ({ start: line[index] as Vec3, end })));
}

/** Lodräta sträckor (längs y) som ligger nära `near` i x och z, med varje x/z-läge räknat en gång. */
function verticalPlacesNear(lines: EdgeLine[], near: Vec3, toleranceMm = 1): string[] {
  const places = segmentsOf(lines)
    .filter(({ start, end }) => Math.abs(start.x - end.x) < 1e-6 && Math.abs(start.z - end.z) < 1e-6 && start.y !== end.y)
    .filter(({ start }) => Math.abs(start.x - near.x) <= toleranceMm && Math.abs(start.z - near.z) <= toleranceMm)
    .map(({ start }) => `${start.x.toFixed(2)},${start.z.toFixed(2)}`);
  return [...new Set(places)];
}

describe('ytterkanter', () => {
  it('ger ett hörn där två väggar möts bara en kant, på den genomgående väggens ytterhörn', () => {
    // Vägg A går ut till hörnet; vägg B står mellan med utsidan jäms med A:s ände.
    const wallA = plate('A', rectangle(0, 10, 100, 50));
    const wallB = plate('B', rectangle(0, 10, 50, 50), { transform: basisMatrix(vec3(0, 0, -1), vec3(0, 1, 0), vec3(-1, 0, 0), vec3(THICKNESS_MM, 0, 0)) });
    const lines = edges([wallA, wallB]);
    expect(verticalPlacesNear(lines, vec3(0, 0, 0), THICKNESS_MM + 1)).toEqual(['0.00,4.00']);
  });

  it('ger ett hörn som går inåt en kant, t.ex. där en vägg står mot mitten av en annan', () => {
    const wallA = plate('A', rectangle(0, 10, 100, 50));
    // Vägg B står ut från A:s utsida (z = tjockleken) vid x = 50, med sin utsida mot x = 54.
    const wallB = plate('B', rectangle(0, 10, 50, 50), { transform: basisMatrix(vec3(0, 0, 1), vec3(0, 1, 0), vec3(1, 0, 0), vec3(50, 0, THICKNESS_MM)) });
    // Strängen flyttas ut i hörnet, en strängradie från varje yta, så att den ligger an mot båda.
    expect(verticalPlacesNear(edges([wallA, wallB]), vec3(50 + THICKNESS_MM + HOLE_MARGIN_MM, 0, THICKNESS_MM + HOLE_MARGIN_MM), 0.5)).toHaveLength(1);
  });

  it('ger en fog mellan två delar som möts kant mot kant en kant', () => {
    const lines = edges([plate('A', rectangle(0, 10, 50, 50)), plate('B', rectangle(50, 10, 50, 50))]);
    expect(verticalPlacesNear(lines, vec3(50, 0, THICKNESS_MM))).toHaveLength(1);
  });

  it('ger en fri del utan insida en sluten kant mitt på kanterna i stället för en på varje sida', () => {
    const lines = edges([plate('leaf', rectangle(0, 10, 30, 50), { hasInsideAtZero: false })]);
    expect(lines).toHaveLength(1);
    const loop = lines[0] ?? [];
    expect(loop[0]).toEqual(loop[loop.length - 1]);
    expect(verticalPlacesNear(lines, vec3(0, 0, THICKNESS_MM / 2), 0.01)).toHaveLength(1);
    // Hörnen ligger kvar i hörnen; de skärs inte av.
    expect(loop.some((point) => Math.hypot(point.x, point.y - 10, point.z - THICKNESS_MM / 2) < 1e-6)).toBe(true);
  });

  it('ger en smal list mellan två hål en kant i listens mitt', () => {
    const wall = plate('wall', rectangle(0, 10, 100, 80), { holes: [rectangle(30, 30, 15, 40), rectangle(50, 30, 15, 40)] });
    expect(verticalPlacesNear(edges([wall]), vec3(47.5, 0, THICKNESS_MM), 3)).toHaveLength(1);
  });

  it('går ända fram till delen som döljer kanten', () => {
    // En skiva ligger tvärs över väggens överkant; väggens hörnkant ska gå ända upp till den.
    const wall = plate('wall', rectangle(0, 10, 100, 53));
    const roof = plate('roof', rectangle(-10, -20, 120, 40), { transform: basisMatrix(vec3(1, 0, 0), vec3(0, 0, -1), vec3(0, 1, 0), vec3(0, 63, 0)) });
    const corner = segmentsOf(edges([wall, roof])).filter(({ start, end }) => start.x === 0 && end.x === 0 && start.z === THICKNESS_MM && end.z === THICKNESS_MM);
    expect(Math.max(...corner.flatMap(({ start, end }) => [start.y, end.y]))).toBeCloseTo(63, 1);
  });

  it('fogar ihop kanterna runt en del till en slinga', () => {
    const lines = edges([plate('wall', rectangle(0, 10, 100, 50), { holes: [rectangle(30, 20, 20, 20)] })]);
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line[0]).toEqual(line[line.length - 1]);
  });

  it('räknar inte kanter som ligger på fatet', () => {
    const lines = edges([plate('wall', rectangle(0, 0, 100, 50))]);
    // Sidorna och överkanten som en obruten linje, men inte underkanten.
    expect(lines).toHaveLength(1);
    expect(segmentsOf(lines).every(({ start, end }) => start.y > 0.5 || end.y > 0.5)).toBe(true);
  });

  it('räknar inte kanter inuti ett slutet hus', () => {
    const side = (x: number) => basisMatrix(vec3(0, 0, 1), vec3(0, 1, 0), vec3(1, 0, 0), vec3(x, 0, 0));
    const box = [
      plate('front', rectangle(0, 0, 100, 60)),
      plate('back', rectangle(0, 0, 100, 60), { transform: basisMatrix(vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1), vec3(0, 0, 96)) }),
      plate('left', rectangle(0, 0, 100, 60), { transform: side(0) }),
      plate('right', rectangle(0, 0, 100, 60), { transform: side(96) }),
      plate('lid', rectangle(0, 0, 100, 100), { transform: basisMatrix(vec3(1, 0, 0), vec3(0, 0, 1), vec3(0, 1, 0), vec3(0, 60, 0)) }),
    ];
    // En del utan insida, t.ex. en takskiva, som hänger inne i huset; ett fönster öppnar inte huset.
    const inner = plate('inner', rectangle(30, 20, 40, 20), { hasInsideAtZero: false, transform: basisMatrix(vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1), vec3(0, 0, 50)) });
    const isNearInner = ({ start, end }: Segment) => [start, end].every((point) => point.z > 45 && point.z < 60 && point.x > 25 && point.x < 75);
    expect(segmentsOf(edges([inner])).some(isNearInner)).toBe(true);
    const windowed = { ...box[0], holes: [rectangle(40, 20, 20, 20)] } as Part;
    expect(segmentsOf(edges([windowed, ...box.slice(1), inner])).some(isNearInner)).toBe(false);
  });
});

describe('ytterkanter i en öppen tillbyggnad', () => {
  it('ger ingen kant på värdens vägg inuti en tillbyggnad vars sidor slutar i väggens plan', () => {
    // Värdväggens utsida (z = 0) ligger inne i en tillbyggnad vars sidor (z 0–60), tak och framvägg står runt hålet.
    const host = plate('host', rectangle(-50, 0, 100, 80), { holes: [rectangle(-10, 20, 20, 30)], transform: basisMatrix(vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1), vec3(0, 0, -THICKNESS_MM)) });
    const toFront = (x: number, z: number) => basisMatrix(vec3(0, 0, 1), vec3(0, 1, 0), vec3(1, 0, 0), vec3(x, 0, z));
    const parts = [
      host,
      plate('left', rectangle(0, 0, 60, 70), { transform: toFront(-36, 0) }),
      plate('right', rectangle(0, 0, 60, 70), { transform: toFront(36, 0) }),
      plate('front', rectangle(-40, 0, 80, 70), { transform: basisMatrix(vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1), vec3(0, 0, 56)) }),
      plate('roof', rectangle(-40, 0, 80, 60), { transform: basisMatrix(vec3(1, 0, 0), vec3(0, 0, 1), vec3(0, -1, 0), vec3(0, 70, 0)) }),
    ];
    const inside = segmentsOf(edges(parts)).filter(({ start, end }) => [start, end].every((point) => point.z > -1 && point.z < 55 && Math.abs(point.x) < 30 && point.y > 15 && point.y < 55));
    expect(inside).toHaveLength(0);
  });
});

describe('ytterkanter på framsidan', () => {
  it('lägger randen på framsidan, innanför kanten, för en del med hasEdgeBeadOnFront', () => {
    const shutter = { ...plate('shutter', rectangle(0, 10, 30, 50), { hasInsideAtZero: false }), hasEdgeBeadOnFront: true };
    const points = edges([shutter]).flat();
    // Strängens mitt ligger en strängradie innanför kanten och en strängradie ovanför framsidan.
    expect(points.every((point) => Math.abs(point.z - (THICKNESS_MM + HOLE_MARGIN_MM)) < 1e-9)).toBe(true);
    expect(Math.min(...points.map((point) => point.x))).toBeCloseTo(HOLE_MARGIN_MM, 6);
    expect(Math.max(...points.map((point) => point.x))).toBeCloseTo(30 - HOLE_MARGIN_MM, 6);
  });
});
