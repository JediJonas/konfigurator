import type { EdgeLine } from '../../core/geometry/outerEdges';
import type { Mm, Vec3 } from '../../core/geometry/vector';
import { cross3, dot3, length3, subtract3 } from '../../core/geometry/vector';

/** Så många sidor randen har runt om. Få sidor räcker för en smal rand och sparar mobilen. */
const SIDES = 6;
/** Så många varv kulorna i ändar och hörn har från pol till pol. */
const SPHERE_RINGS = 4;
/** En böj skarpare än så här får en kula, så att randen inte får glipor i hörnen. */
const JOINT_ANGLE_DEGREES = 5;

/** Hörn, normaler och trianglar för hela randen, i en enda geometri så att den ritas med ett anrop. */
export interface BeadGeometryData {
  positions: number[];
  normals: number[];
  indices: number[];
}

/**
 * Bygger en rund rand längs varje linje: ett rör med få sidor för varje sträcka
 * och en kula i ändarna och där linjen böjer.
 */
export function buildBeadGeometry(lines: readonly EdgeLine[], radius: Mm): BeadGeometryData {
  const data: BeadGeometryData = { positions: [], normals: [], indices: [] };
  for (const line of lines) {
    line.forEach((point, index) => {
      const next = line[index + 1];
      if (next) addTube(data, point, next, radius);
      if (needsJoint(line, index)) addSphere(data, point, radius);
    });
  }
  return data;
}

function needsJoint(line: EdgeLine, index: number): boolean {
  const before = line[index - 1];
  const point = line[index];
  const after = line[index + 1];
  if (!before || !point || !after) return true;
  const incoming = subtract3(point, before);
  const outgoing = subtract3(after, point);
  const lengths = length3(incoming) * length3(outgoing);
  if (lengths === 0) return false;
  return dot3(incoming, outgoing) / lengths < Math.cos((JOINT_ANGLE_DEGREES * Math.PI) / 180);
}

function addTube(data: BeadGeometryData, start: Vec3, end: Vec3, radius: Mm): void {
  const direction = subtract3(end, start);
  if (length3(direction) === 0) return;
  const [side, up] = perpendicularAxes(direction);
  const first = data.positions.length / 3;
  for (const center of [start, end]) {
    for (let step = 0; step < SIDES; step++) {
      const angle = (step / SIDES) * 2 * Math.PI;
      const normal = combine(side, Math.cos(angle), up, Math.sin(angle));
      pushVertex(data, center, normal, radius);
    }
  }
  for (let step = 0; step < SIDES; step++) {
    const nextStep = (step + 1) % SIDES;
    const a = first + step;
    const b = first + nextStep;
    data.indices.push(a, b, a + SIDES, b, b + SIDES, a + SIDES);
  }
}

function addSphere(data: BeadGeometryData, center: Vec3, radius: Mm): void {
  const first = data.positions.length / 3;
  for (let ring = 0; ring <= SPHERE_RINGS; ring++) {
    const polar = (ring / SPHERE_RINGS) * Math.PI;
    for (let step = 0; step <= SIDES; step++) {
      const azimuth = (step / SIDES) * 2 * Math.PI;
      const normal = { x: Math.sin(polar) * Math.cos(azimuth), y: Math.cos(polar), z: Math.sin(polar) * Math.sin(azimuth) };
      pushVertex(data, center, normal, radius);
    }
  }
  const perRing = SIDES + 1;
  for (let ring = 0; ring < SPHERE_RINGS; ring++) {
    for (let step = 0; step < SIDES; step++) {
      const a = first + ring * perRing + step;
      const b = a + perRing;
      data.indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
}

function pushVertex(data: BeadGeometryData, center: Vec3, normal: Vec3, radius: Mm): void {
  data.positions.push(center.x + normal.x * radius, center.y + normal.y * radius, center.z + normal.z * radius);
  data.normals.push(normal.x, normal.y, normal.z);
}

/** Två enhetsvektorer vinkelräta mot riktningen och mot varandra. */
function perpendicularAxes(direction: Vec3): [Vec3, Vec3] {
  const along = normalize(direction);
  const helper = Math.abs(along.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const side = normalize(cross3(along, helper));
  return [side, cross3(along, side)];
}

function combine(a: Vec3, aScale: number, b: Vec3, bScale: number): Vec3 {
  return { x: a.x * aScale + b.x * bScale, y: a.y * aScale + b.y * bScale, z: a.z * aScale + b.z * bScale };
}

function normalize(vector: Vec3): Vec3 {
  const length = length3(vector);
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}
