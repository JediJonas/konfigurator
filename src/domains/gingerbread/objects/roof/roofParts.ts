import type { Matrix4 } from '../../../../core/geometry/matrix';
import { lowestPlaneRegion } from '../../../../core/geometry/heightPlanes';
import type { Polygon } from '../../../../core/geometry/polygon';
import { boundsOf, signedArea } from '../../../../core/geometry/polygon';
import type { Vec2, Vec3 } from '../../../../core/geometry/vector';
import { cross3, dot3, length3, subtract3, vec2, vec3 } from '../../../../core/geometry/vector';
import { BUILD_STEP } from '../../buildOrder';
import { buttJoint } from '../../joints';
import type { SectionParams } from '../sectionParams';
import type { PartDraft, UprightLine } from '../uprightPart';
import { planeMatrix, rectangle, uprightTransform } from '../uprightPart';
import type { RoofContext, RoofLayout } from './roofLayout';
import { buildRoofLayout } from './roofLayout';

/** Ytor mindre än så blir ingen del, t.ex. ett takfall som bara nuddar de andra. */
const MIN_FACE_AREA_MM2 = 1;

/** Alla takets delar: takytor, takskiva och kant. Varje del ligger med undersidan i lokalt z = 0. */
export function buildRoofParts(params: SectionParams, context: RoofContext): PartDraft[] {
  const layout = buildRoofLayout(params, context);
  return [...buildFaceParts(layout), ...buildPlatePart(params, layout), ...buildRimParts(params, layout, context)];
}

function buildFaceParts(layout: RoofLayout): PartDraft[] {
  const planes = layout.faces.map((face) => face.plane);
  return layout.faces.flatMap((face, index) => {
    const region = lowestPlaneRegion(planes, index, layout.plan);
    const placed = placePlanarPolygon(region);
    if (!placed) return [];
    return [{ id: face.id, labelKey: face.labelKey, buildStep: BUILD_STEP.roof, ...placed }];
  });
}

function buildPlatePart(params: SectionParams, layout: RoofLayout): PartDraft[] {
  if (!layout.plate) return [];
  const placed = placePlanarPolygon(layout.plate.map((point) => vec3(point.x, params.wallHeight, point.y)));
  return placed ? [{ id: 'roof-plate', labelKey: 'part.roofPlate', buildStep: BUILD_STEP.roof, ...placed }] : [];
}

/**
 * Kanten runt ett platt tak står på takskivans ytterkant. Hörnen följer
 * domänens fog: de längsta kanterna går ut och de andra står mellan.
 * En tillbyggnad har ingen kant mot värden, och sidornas kant slutar vid värdens vägg.
 */
function buildRimParts(params: SectionParams, layout: RoofLayout, context: RoofContext): PartDraft[] {
  if (!layout.rim || !layout.plate) return [];
  const plate = boundsOf(layout.plate);
  const back = context.isExtension ? -params.depth / 2 : plate.minY;
  const front = plate.maxY;
  const width = plate.maxX - plate.minX;
  const roles = buttJoint.assignCornerRoles([
    { id: 'ends', hasSlopedTop: false, length: width },
    { id: 'sides', hasSlopedTop: false, length: front - back },
  ]);
  const thickness = context.thickness;
  const endInset = roles.get('ends') === 'through' ? 0 : thickness;
  const sideInset = roles.get('sides') === 'through' ? 0 : thickness;
  const base = params.wallHeight + thickness;
  const height = layout.rim.height;
  const rim = (id: string, line: UprightLine): PartDraft => {
    const length = Math.hypot(line.outerEnd.x - line.outerStart.x, line.outerEnd.y - line.outerStart.y);
    return { id, labelKey: 'part.rim', outline: rectangle(length, height), transform: uprightTransform(line, thickness, base), buildStep: BUILD_STEP.roof };
  };
  const rims = [
    rim('rim-front', { outerStart: vec2(plate.minX + endInset, front), outerEnd: vec2(plate.maxX - endInset, front) }),
    rim('rim-right', { outerStart: vec2(plate.maxX, front - sideInset), outerEnd: vec2(plate.maxX, context.isExtension ? back : back + sideInset) }),
    rim('rim-left', { outerStart: vec2(plate.minX, context.isExtension ? back : back + sideInset), outerEnd: vec2(plate.minX, front - sideInset) }),
  ];
  if (!context.isExtension) rims.push(rim('rim-back', { outerStart: vec2(plate.maxX - endInset, back), outerEnd: vec2(plate.minX + endInset, back) }));
  return rims;
}

/**
 * Lägger en plan polygon i 3D som en del: lokalt x längs planets
 * nivålinjer, lokalt y uppför lutningen och tjockleken uppåt, ut ur taket.
 */
export function placePlanarPolygon(points: readonly Vec3[]): { outline: Polygon; transform: Matrix4 } | undefined {
  if (points.length < 3) return undefined;
  const normal = upwardNormal(points);
  if (!normal) return undefined;
  const isLevel = Math.abs(normal.y) > 1 - 1e-9;
  const upHill = isLevel ? vec3(0, 0, -1) : normalize(subtract3(vec3(0, 1, 0), scale(normal, normal.y)));
  const along = cross3(upHill, normal);
  const anchor = points[0] ?? vec3(0, 0, 0);
  const local = points.map((point) => vec2(dot3(subtract3(point, anchor), along), dot3(subtract3(point, anchor), upHill)));
  if (Math.abs(signedArea(local)) < MIN_FACE_AREA_MM2) return undefined;
  const bounds = boundsOf(local);
  const shifted = local.map((point) => vec2(point.x - bounds.minX, point.y - bounds.minY));
  const origin = vec3(
    anchor.x + along.x * bounds.minX + upHill.x * bounds.minY,
    anchor.y + along.y * bounds.minX + upHill.y * bounds.minY,
    anchor.z + along.z * bounds.minX + upHill.z * bounds.minY,
  );
  const counterClockwise: Vec2[] = signedArea(shifted) > 0 ? shifted : [...shifted].reverse();
  return { outline: startAtLowestCorner(counterClockwise), transform: planeMatrix(along, upHill, origin) };
}

/** Konturen börjar i hörnet längst ner till vänster, som väggarnas. */
function startAtLowestCorner(polygon: Vec2[]): Vec2[] {
  const start = polygon.reduce((best, point, index) => {
    const current = polygon[best] ?? point;
    return point.y < current.y - 1e-9 || (Math.abs(point.y - current.y) <= 1e-9 && point.x < current.x) ? index : best;
  }, 0);
  return [...polygon.slice(start), ...polygon.slice(0, start)];
}

/** Polygonens normal (Newells metod), vänd uppåt. Saknas för en polygon utan yta. */
function upwardNormal(points: readonly Vec3[]): Vec3 | undefined {
  const sum = points.reduce(
    (total, current, index) => {
      const next = points[(index + 1) % points.length] ?? current;
      return vec3(
        total.x + (current.y - next.y) * (current.z + next.z),
        total.y + (current.z - next.z) * (current.x + next.x),
        total.z + (current.x - next.x) * (current.y + next.y),
      );
    },
    vec3(0, 0, 0),
  );
  const length = length3(sum);
  if (length === 0) return undefined;
  const sign = sum.y < 0 ? -1 : 1;
  return scale(sum, sign / length);
}

function scale(vector: Vec3, factor: number): Vec3 {
  return vec3(vector.x * factor, vector.y * factor, vector.z * factor);
}

function normalize(vector: Vec3): Vec3 {
  return scale(vector, 1 / length3(vector));
}

