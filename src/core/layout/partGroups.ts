import type { Polygon } from '../geometry/polygon';
import { boundsOf, mirrorPolygonX, translatePolygon } from '../geometry/polygon';
import type { Mm, Vec2 } from '../geometry/vector';
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
  /** Hur många av delarna som skärs spegelvända, dvs. med mallen vänd. */
  mirroredCount: number;
  partIds: string[];
  /** Objekten som delarna kommer från, t.ex. ["S1", "S2"]. */
  sourceInstanceIds: string[];
  buildStep: number;
}

/** Avrundning när former jämförs, så att flyttalsbrus inte ger olika grupper. */
const SHAPE_KEY_PRECISION_MM = 0.01;

/**
 * Delar med samma form, oavsett var konturen börjar, ritas en gång. En del som
 * är spegelvänd mot en annan, t.ex. tillbyggnadens takhalvor efter
 * vinkelrännan, ritas också bara en gång och skärs med mallen vänd.
 */
export function groupIdenticalParts(parts: readonly Part[]): PartGroup[] {
  const groups = new Map<string, PartGroup>();
  for (const part of parts) {
    const { outline, holes } = normalizeShape(part.outline, part.holes);
    const key = shapeKey(part, outline, holes);
    const mirrored = normalizeShape(mirrorPolygonX(outline), holes.map(mirrorPolygonX));
    const existing = groups.get(key) ?? groups.get(shapeKey(part, mirrored.outline, mirrored.holes));
    if (existing) {
      existing.count += 1;
      if (!groups.has(key)) existing.mirroredCount += 1;
      existing.partIds.push(part.id);
      if (!existing.sourceInstanceIds.includes(part.sourceInstanceId)) existing.sourceInstanceIds.push(part.sourceInstanceId);
      continue;
    }
    groups.set(key, {
      number: groups.size + 1,
      labelKey: part.labelKey,
      outline,
      holes,
      thickness: part.thickness,
      count: 1,
      mirroredCount: 0,
      partIds: [part.id],
      sourceInstanceIds: [part.sourceInstanceId],
      buildStep: part.buildStep,
    });
  }
  return [...groups.values()];
}

/** Flyttar formen till origo och låter konturen börja i hörnet längst ner till vänster, så att samma form får samma nyckel. */
function normalizeShape(outline: Polygon, holes: Polygon[]): { outline: Polygon; holes: Polygon[] } {
  const bounds = boundsOf(outline);
  const offset = { x: -bounds.minX, y: -bounds.minY };
  return { outline: startAtLowestCorner(translatePolygon(outline, offset)), holes: holes.map((hole) => startAtLowestCorner(translatePolygon(hole, offset))) };
}

function startAtLowestCorner(polygon: Vec2[]): Vec2[] {
  const round = (value: number) => Math.round(value / SHAPE_KEY_PRECISION_MM);
  const start = polygon.reduce((best, point, index) => {
    const current = polygon[best] ?? point;
    return round(point.y) < round(current.y) || (round(point.y) === round(current.y) && round(point.x) < round(current.x)) ? index : best;
  }, 0);
  return [...polygon.slice(start), ...polygon.slice(0, start)];
}

function shapeKey(part: Part, outline: Polygon, holes: Polygon[]): string {
  const round = (value: number) => Math.round(value / SHAPE_KEY_PRECISION_MM);
  const encode = (polygon: Polygon) => polygon.map((p) => `${round(p.x)},${round(p.y)}`).join(';');
  return [part.labelKey, round(part.thickness), encode(outline), ...holes.map(encode)].join('|');
}

/**
 * Delens namn på ritningen. När huset har flera objekt, t.ex. en tillbyggnad,
 * står objektens id med så att man vet vilken långvägg som hör till vilken del av huset.
 */
export function describeGroup(group: PartGroup, groups: readonly PartGroup[], label: string): string {
  const hasManySources = new Set(groups.flatMap((candidate) => candidate.sourceInstanceIds)).size > 1;
  return hasManySources ? `${label} (${group.sourceInstanceIds.join(', ')})` : label;
}
