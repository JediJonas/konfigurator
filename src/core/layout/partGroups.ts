import type { Polygon } from '../geometry/polygon';
import { boundsOf, translatePolygon } from '../geometry/polygon';
import type { Mm } from '../geometry/vector';
import type { Part } from '../model/part';

/** Delar med samma form skärs ut flera gånger men ritas bara en gång. */
export interface PartGroup {
  /** Löpnummer på ritningen, från 1. */
  number: number;
  labelKey: string;
  /** Konturen flyttad så att omslutande rektangel börjar i origo. */
  outline: Polygon;
  holes: Polygon[];
  thickness: Mm;
  count: number;
  isMirrored: boolean;
  partIds: string[];
  buildStep: number;
}

/** Avrundning när former jämförs, så att flyttalsbrus inte ger olika grupper. */
const SHAPE_KEY_PRECISION_MM = 0.01;

export function groupIdenticalParts(parts: readonly Part[]): PartGroup[] {
  const groups = new Map<string, PartGroup>();
  for (const part of parts) {
    const { outline, holes } = normalizeShape(part.outline, part.holes);
    const key = shapeKey(part, outline, holes);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.partIds.push(part.id);
      continue;
    }
    groups.set(key, {
      number: groups.size + 1,
      labelKey: part.labelKey,
      outline,
      holes,
      thickness: part.thickness,
      count: 1,
      isMirrored: part.mirroredPairOf !== undefined,
      partIds: [part.id],
      buildStep: part.buildStep,
    });
  }
  return [...groups.values()];
}

function normalizeShape(outline: Polygon, holes: Polygon[]): { outline: Polygon; holes: Polygon[] } {
  const bounds = boundsOf(outline);
  const offset = { x: -bounds.minX, y: -bounds.minY };
  return { outline: translatePolygon(outline, offset), holes: holes.map((hole) => translatePolygon(hole, offset)) };
}

function shapeKey(part: Part, outline: Polygon, holes: Polygon[]): string {
  const round = (value: number) => Math.round(value / SHAPE_KEY_PRECISION_MM);
  const encode = (polygon: Polygon) => polygon.map((p) => `${round(p.x)},${round(p.y)}`).join(';');
  return [part.labelKey, round(part.thickness), part.mirroredPairOf ? 'm' : '', encode(outline), ...holes.map(encode)].join('|');
}
