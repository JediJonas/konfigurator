import type { EdgeLine } from '../../core/geometry/outerEdges';
import type { Mm, Vec3 } from '../../core/geometry/vector';
import { cross3, dot3, length3, subtract3 } from '../../core/geometry/vector';

/** Så många sidor randen har runt om. */
const SIDES = 10;
/** Så många varv kulorna i ändar och knutar har från pol till pol. */
const SPHERE_RINGS = 6;
/**
 * Böjer linjen mer än så här fogas rören inte i gering, eftersom skarven då
 * blir spetsig; där sitter en kula i stället.
 */
const MAX_MITER_TURN_DEGREES = 100;
/** Punkter närmare än så här räknas som samma, t.ex. där en slinga slutar. */
const SAME_POINT_MM = 1e-6;

/** Hörn, normaler och trianglar för hela randen, i en enda geometri så att den ritas med ett anrop. */
export interface BeadGeometryData {
  positions: number[];
  normals: number[];
  indices: number[];
}

interface Frame {
  side: Vec3;
  up: Vec3;
}

/** Ett hörn där två rör fogas i gering; ramen ligger vinkelrätt mot den inkommande riktningen. */
interface MiterJoint {
  center: Vec3;
  frame: Frame;
  incoming: Vec3;
  outgoing: Vec3;
}

/**
 * Bygger en rund rand längs varje linje: ett obrutet rör som fogas i gering
 * där linjen böjer, så att skarven blir slät, och en kula i fria ändar,
 * där flera linjer möts och i spetsiga hörn. En linje som slutar där den
 * börjar blir en sluten slinga.
 */
export function buildBeadGeometry(lines: readonly EdgeLine[], radius: Mm): BeadGeometryData {
  const data: BeadGeometryData = { positions: [], normals: [], indices: [] };
  for (const line of lines) addLine(data, removeRepeats(line), radius);
  return data;
}

function removeRepeats(line: EdgeLine): Vec3[] {
  return line.filter((point, index) => index === 0 || distance(point, line[index - 1] as Vec3) > SAME_POINT_MM);
}

function addLine(data: BeadGeometryData, line: Vec3[], radius: Mm): void {
  if (line.length < 2) return;
  const isClosed = line.length > 3 && distance(line[0] as Vec3, line[line.length - 1] as Vec3) <= SAME_POINT_MM;
  const points = isClosed ? line.slice(0, -1) : line;
  const segmentCount = isClosed ? points.length : points.length - 1;
  const directionOf = (segment: number) => normalize(subtract3(points[(segment + 1) % points.length] as Vec3, points[segment % points.length] as Vec3));
  let direction = directionOf(0);
  let frame = perpendicularFrame(direction);
  const startPoint = points[0] as Vec3;
  const firstIncoming = isClosed ? directionOf(segmentCount - 1) : undefined;
  let ring = firstIncoming && canMiter(firstIncoming, direction) ? addMiteredRing(data, { center: startPoint, frame: transportFrame(frame, direction, firstIncoming), incoming: firstIncoming, outgoing: direction }, radius) : addRing(data, startPoint, frame, radius);
  const firstRing = ring;
  if (!firstIncoming || !canMiter(firstIncoming, direction)) addSphere(data, startPoint, radius);
  for (let segment = 0; segment < segmentCount; segment++) {
    const end = points[(segment + 1) % points.length] as Vec3;
    const isLast = segment === segmentCount - 1;
    if (isLast && isClosed && firstIncoming && canMiter(firstIncoming, directionOf(0))) {
      connectRings(data, ring, firstRing);
      return;
    }
    const nextDirection = isLast ? undefined : directionOf(segment + 1);
    if (nextDirection && canMiter(direction, nextDirection)) {
      const endRing = addMiteredRing(data, { center: end, frame, incoming: direction, outgoing: nextDirection }, radius);
      connectRings(data, ring, endRing);
      ring = endRing;
      frame = transportFrame(frame, direction, nextDirection);
    } else {
      connectRings(data, ring, addRing(data, end, frame, radius));
      addSphere(data, end, radius);
      if (nextDirection) {
        frame = perpendicularFrame(nextDirection);
        ring = addRing(data, end, frame, radius);
      }
    }
    if (nextDirection) direction = nextDirection;
  }
}

function canMiter(incoming: Vec3, outgoing: Vec3): boolean {
  return dot3(incoming, outgoing) > Math.cos((MAX_MITER_TURN_DEGREES * Math.PI) / 180);
}

/** En ring vinkelrätt mot riktningen. Ger index på ringens första hörn. */
function addRing(data: BeadGeometryData, center: Vec3, frame: Frame, radius: Mm): number {
  const first = data.positions.length / 3;
  for (let step = 0; step < SIDES; step++) {
    const normal = ringNormal(frame, step);
    pushVertex(data, offset(center, normal, radius), normal);
  }
  return first;
}

/**
 * En ring i geringsplanet mellan två riktningar: cirkeln runt den inkommande
 * riktningen skjuts längs den till planet som delar vinkeln mitt itu, så att
 * båda rören slutar exakt där.
 */
function addMiteredRing(data: BeadGeometryData, { center, frame, incoming, outgoing }: MiterJoint, radius: Mm): number {
  const planeNormal = normalize({ x: incoming.x + outgoing.x, y: incoming.y + outgoing.y, z: incoming.z + outgoing.z });
  const along = dot3(incoming, planeNormal);
  const first = data.positions.length / 3;
  for (let step = 0; step < SIDES; step++) {
    const normal = ringNormal(frame, step);
    const onCircle = offset(center, normal, radius);
    const shift = -dot3(subtract3(onCircle, center), planeNormal) / along;
    const smoothNormal = normalize(subtract3(normal, scale(planeNormal, dot3(normal, planeNormal))));
    pushVertex(data, offset(onCircle, incoming, shift), smoothNormal);
  }
  return first;
}

function connectRings(data: BeadGeometryData, from: number, to: number): void {
  for (let step = 0; step < SIDES; step++) {
    const next = (step + 1) % SIDES;
    data.indices.push(from + step, from + next, to + step, from + next, to + next, to + step);
  }
}

function addSphere(data: BeadGeometryData, center: Vec3, radius: Mm): void {
  const first = data.positions.length / 3;
  for (let ring = 0; ring <= SPHERE_RINGS; ring++) {
    const polar = (ring / SPHERE_RINGS) * Math.PI;
    for (let step = 0; step <= SIDES; step++) {
      const azimuth = (step / SIDES) * 2 * Math.PI;
      const normal = { x: Math.sin(polar) * Math.cos(azimuth), y: Math.cos(polar), z: Math.sin(polar) * Math.sin(azimuth) };
      pushVertex(data, offset(center, normal, radius), normal);
    }
  }
  const perRing = SIDES + 1;
  for (let ring = 0; ring < SPHERE_RINGS; ring++) {
    for (let step = 0; step < SIDES; step++) {
      const a = first + ring * perRing + step;
      const b = a + perRing;
      // Moturs sett utifrån, annars syns kulan inifrån och ser ihålig ut.
      data.indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
}

function ringNormal(frame: Frame, step: number): Vec3 {
  const angle = (step / SIDES) * 2 * Math.PI;
  return { x: frame.side.x * Math.cos(angle) + frame.up.x * Math.sin(angle), y: frame.side.y * Math.cos(angle) + frame.up.y * Math.sin(angle), z: frame.side.z * Math.cos(angle) + frame.up.z * Math.sin(angle) };
}

function pushVertex(data: BeadGeometryData, position: Vec3, normal: Vec3): void {
  data.positions.push(position.x, position.y, position.z);
  data.normals.push(normal.x, normal.y, normal.z);
}

/** Två enhetsvektorer vinkelräta mot riktningen och mot varandra. */
function perpendicularFrame(direction: Vec3): Frame {
  const helper = Math.abs(direction.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const side = normalize(cross3(direction, helper));
  return { side, up: cross3(direction, side) };
}

/** Vrider ramen med den minsta vridning som tar `from` till `to`, så att rören inte vrids runt sin axel. */
function transportFrame(frame: Frame, from: Vec3, to: Vec3): Frame {
  return { side: rotate(frame.side, from, to), up: rotate(frame.up, from, to) };
}

/** Rodrigues vridning av vektorn med vridningen som tar enhetsvektorn `from` till `to`. */
function rotate(vector: Vec3, from: Vec3, to: Vec3): Vec3 {
  const axis = cross3(from, to);
  const sin = length3(axis);
  const cos = dot3(from, to);
  if (sin < 1e-9) return vector;
  const k = scale(axis, 1 / sin);
  const kCross = cross3(k, vector);
  const kDot = dot3(k, vector);
  return {
    x: vector.x * cos + kCross.x * sin + k.x * kDot * (1 - cos),
    y: vector.y * cos + kCross.y * sin + k.y * kDot * (1 - cos),
    z: vector.z * cos + kCross.z * sin + k.z * kDot * (1 - cos),
  };
}

function offset(point: Vec3, direction: Vec3, distanceMm: number): Vec3 {
  return { x: point.x + direction.x * distanceMm, y: point.y + direction.y * distanceMm, z: point.z + direction.z * distanceMm };
}

function scale(vector: Vec3, factor: number): Vec3 {
  return { x: vector.x * factor, y: vector.y * factor, z: vector.z * factor };
}

function normalize(vector: Vec3): Vec3 {
  const length = length3(vector);
  return length === 0 ? vector : scale(vector, 1 / length);
}

function distance(a: Vec3, b: Vec3): number {
  return length3(subtract3(a, b));
}
