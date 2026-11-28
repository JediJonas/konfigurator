import type { Mm, Vec3 } from './vector';
import { length3, subtract3 } from './vector';

/** Ändar närmare än så här är samma punkt, t.ex. två kanter i hörnet på samma del. */
const SAME_POINT_MM = 0.5;

interface LineEnd {
  lineIndex: number;
  isStart: boolean;
  point: Vec3;
}

/**
 * Fogar ihop linjer som möts. Först slås ändar som sammanfaller ihop, sedan
 * fria ändar närmare än `joinDistance`, t.ex. där två takfall möts i nocken.
 * Ändarna flyttas till mitten av sin grupp, och där precis två linjer möts
 * blir de en linje, så att randen går obruten runt hörnet. En linje som går
 * runt och möter sig själv slutar i samma punkt som den börjar.
 */
export function joinEdgeLines(lines: readonly Vec3[][], joinDistance: Mm): Vec3[][] {
  const usable = lines.filter((line) => line.length >= 2).map((line) => [...line]);
  const ends: LineEnd[] = usable.flatMap((line, lineIndex) => [
    { lineIndex, isStart: true, point: line[0] as Vec3 },
    { lineIndex, isStart: false, point: line[line.length - 1] as Vec3 },
  ]);
  const exact = clusterEnds(ends, SAME_POINT_MM);
  const free = exact.filter((group) => group.length === 1).map((group) => group[0] as LineEnd);
  const groups = [...exact.filter((group) => group.length > 1), ...clusterEnds(free, joinDistance)];
  for (const group of groups) {
    const center = averageOf(group.map((end) => end.point));
    for (const end of group) {
      const line = usable[end.lineIndex] as Vec3[];
      line[end.isStart ? 0 : line.length - 1] = center;
    }
  }
  return chainLines(usable, groups);
}

/**
 * Grupperar ändar, närmaste par först. Två grupper slås bara ihop när alla
 * ändar i dem ligger inom avståndet från varandra och ingen linje får båda
 * sina ändar i gruppen, så att t.ex. korta bitar längs en båge inte dras ihop
 * till en klump.
 */
function clusterEnds(ends: readonly LineEnd[], distance: Mm): LineEnd[][] {
  const cellSize = Math.max(distance, SAME_POINT_MM);
  const keyOf = (point: Vec3, dx = 0, dy = 0, dz = 0) => `${Math.floor(point.x / cellSize) + dx},${Math.floor(point.y / cellSize) + dy},${Math.floor(point.z / cellSize) + dz}`;
  const cells = new Map<string, number[]>();
  ends.forEach((end, index) => {
    const key = keyOf(end.point);
    cells.set(key, [...(cells.get(key) ?? []), index]);
  });
  const pairs: { a: number; b: number; gap: Mm }[] = [];
  ends.forEach((end, a) => {
    for (const b of listNeighbors(end.point, cells, keyOf)) {
      if (b <= a) continue;
      const gap = length3(subtract3((ends[b] as LineEnd).point, end.point));
      if (gap <= distance) pairs.push({ a, b, gap });
    }
  });
  pairs.sort((first, second) => first.gap - second.gap);
  const groupOf = ends.map((_, index) => index);
  const members = ends.map((_, index) => [index]);
  for (const { a, b } of pairs) {
    const [groupA, groupB] = [groupOf[a] as number, groupOf[b] as number];
    if (groupA === groupB) continue;
    const joined = [...(members[groupA] as number[]), ...(members[groupB] as number[])];
    const lineIndices = joined.map((index) => (ends[index] as LineEnd).lineIndex);
    if (new Set(lineIndices).size < lineIndices.length) continue;
    const isCompact = joined.every((first) => joined.every((second) => length3(subtract3((ends[first] as LineEnd).point, (ends[second] as LineEnd).point)) <= distance));
    if (!isCompact) continue;
    members[groupA] = joined;
    members[groupB] = [];
    for (const index of joined) groupOf[index] = groupA;
  }
  return members.filter((group) => group.length > 0).map((group) => group.map((index) => ends[index] as LineEnd));
}

function listNeighbors(point: Vec3, cells: Map<string, number[]>, keyOf: (point: Vec3, dx: number, dy: number, dz: number) => string): number[] {
  const near: number[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) near.push(...(cells.get(keyOf(point, dx, dy, dz)) ?? []));
  return near;
}

/** Sätter ihop linjerna genom grupper där precis två ändar möts. */
function chainLines(lines: readonly Vec3[][], groups: readonly LineEnd[][]): Vec3[][] {
  const endKey = (lineIndex: number, isStart: boolean) => `${lineIndex}:${isStart ? 's' : 'e'}`;
  const partnerOf = new Map<string, LineEnd>();
  for (const group of groups) {
    const [a, b] = group;
    if (group.length !== 2 || !a || !b) continue;
    partnerOf.set(endKey(a.lineIndex, a.isStart), b);
    partnerOf.set(endKey(b.lineIndex, b.isStart), a);
  }
  const hasPartner = (lineIndex: number, isStart: boolean) => partnerOf.has(endKey(lineIndex, isStart));
  const indices = lines.map((_, index) => index);
  // Först linjer med en fri ände, så att öppna kedjor börjar i en ände; sedan slingorna.
  const order = [...indices.filter((index) => !hasPartner(index, true) || !hasPartner(index, false)), ...indices];
  const isUsed = new Array<boolean>(lines.length).fill(false);
  const chains: Vec3[][] = [];
  for (const first of order) {
    if (isUsed[first]) continue;
    isUsed[first] = true;
    const isForward = !hasPartner(first, true) || hasPartner(first, false);
    const line = lines[first] as Vec3[];
    const chain = isForward ? [...line] : [...line].reverse();
    let tail = partnerOf.get(endKey(first, !isForward));
    while (tail && !isUsed[tail.lineIndex]) {
      isUsed[tail.lineIndex] = true;
      const next = lines[tail.lineIndex] as Vec3[];
      chain.push(...(tail.isStart ? next : [...next].reverse()).slice(1));
      tail = partnerOf.get(endKey(tail.lineIndex, !tail.isStart));
    }
    chains.push(chain);
  }
  return chains;
}

function averageOf(points: readonly Vec3[]): Vec3 {
  const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y, z: total.z + point.z }), { x: 0, y: 0, z: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length, z: sum.z / points.length };
}
