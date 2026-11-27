import { convexHull } from '../../../core/geometry/hull';
import { transformPoint } from '../../../core/geometry/matrix';
import type { Polygon } from '../../../core/geometry/polygon';
import { boundsOf, signedArea } from '../../../core/geometry/polygon';
import { subtractRegions } from '../../../core/geometry/clipping';
import type { Mm, Vec2, Vec3 } from '../../../core/geometry/vector';
import { dot3, length3, subtract3, vec2, vec3 } from '../../../core/geometry/vector';
import type { Part } from '../../../core/model/part';
import type { WorldHalfSpace } from '../../../core/pipeline/partRegions';
import { regionOnPart } from '../../../core/pipeline/partRegions';

/** Antal djup genom värdens takskiva där tillbyggnadens tak prövas. */
const DEPTH_SAMPLE_COUNT = 5;
/** Tak som bara ligger an mot varandra, t.ex. i rännan, räknas inte som att de går in i varandra. */
const TOUCH_TOLERANCE_MM = 0.01;
/** Urtaget går så här långt förbi värdens takkant, så att ingen tunn remsa blir kvar. */
const NOTCH_MARGIN_MM = 1;
/** Områden mindre än så räknas inte som att taken går in i varandra. */
const MIN_OVERLAP_AREA_MM2 = 0.01;
/** Konturens hörn så nära kanten räknas som hörn på kanten. */
const EDGE_TOLERANCE_MM = 0.01;

interface PartAxes {
  origin: Vec3;
  alongX: Vec3;
  alongY: Vec3;
  normal: Vec3;
}

/** Hur det gick med urtaget i en takskiva på värden. */
export type HostRoofNotch =
  | { kind: 'unchanged' }
  | { kind: 'notched'; part: Part }
  /** Urtaget skulle dela skivan eller öppna sig mot en annan takskiva; då kapas tillbyggnadens tak i stället. */
  | { kind: 'blocked' };

/**
 * Urtag i en takskiva på värden där tillbyggnadens tak går igenom den, t.ex.
 * där tillbyggnadens tak går in under värdens takutsprång till väggen
 * (ägarens val: hellre ta bort från förälderns tak än från barnets). Urtaget
 * följer det tillbyggnadens tak tar av skivan, med sneda kanter där taket
 * lutar, och går ut till skivans kant mot tillbyggnaden, t.ex. takfoten.
 * `isSharedCorner` säger om ett hörn på värdens takskivor delas med en
 * annan skiva, t.ex. mansardtakets brytlinje, som urtaget inte får öppna sig mot.
 */
export function notchHostRoof(hostRoof: Part, extensionRoofs: readonly Part[], outward: Vec3, isSharedCorner: (point: Vec3) => boolean): HostRoofNotch {
  const overlap = extensionRoofs.flatMap((roof) => listOverlapRegions(hostRoof, roof)).flat();
  if (overlap.length === 0) return { kind: 'unchanged' };
  const { notch, edge } = extendToEdgeFacing(hostRoof, overlap, outward);
  const sharedOnEdge = edge.filter((point) => isSharedCorner(transformPoint(hostRoof.transform, vec3(point.x, point.y, 0))));
  if (sharedOnEdge.length >= 2) return { kind: 'blocked' };
  const pieces = subtractRegions(hostRoof, [notch]);
  const [piece] = pieces;
  if (pieces.length !== 1 || !piece) return { kind: 'blocked' };
  return { kind: 'notched', part: { ...hostRoof, outline: piece.outline, holes: piece.holes } };
}

/** Där tillbyggnadens tak går in i värdens skiva, i skivans plan, prövat på flera djup genom skivan. */
function listOverlapRegions(hostRoof: Part, extensionRoof: Part): Vec2[][] {
  const depths = Array.from({ length: DEPTH_SAMPLE_COUNT }, (_, index) => (hostRoof.thickness * index) / (DEPTH_SAMPLE_COUNT - 1));
  return depths
    .map((depth) => regionOnPart(hostRoof, describeBody(extensionRoof, depth)))
    .filter((region) => region.length >= 3 && Math.abs(signedArea(region)) > MIN_OVERLAP_AREA_MM2);
}

/** Taket som ett konvext block: mellan under- och ovansidan och innanför konturens kanter, lite krympt. */
function describeBody(roof: Part, depth: Mm): WorldHalfSpace[] {
  const axes = describeAxes(roof);
  const base = dot3(axes.normal, axes.origin);
  const faces: WorldHalfSpace[] = [
    { normal: scale(axes.normal, -1), offset: -base - TOUCH_TOLERANCE_MM, depth },
    { normal: axes.normal, offset: base + roof.thickness - TOUCH_TOLERANCE_MM, depth },
  ];
  const outline: Polygon = convexHull(roof.outline);
  const sides = outline.map((start, index): WorldHalfSpace => {
    const end = outline[(index + 1) % outline.length] ?? start;
    // Konturen går moturs, så kantens utåtriktade normal i planet är (dy, −dx).
    const normal = add(scale(axes.alongX, end.y - start.y), scale(axes.alongY, -(end.x - start.x)));
    const worldStart = transformPoint(roof.transform, vec3(start.x, start.y, 0));
    return { normal, offset: dot3(normal, worldStart) - TOUCH_TOLERANCE_MM * length3(normal), depth };
  });
  return [...faces, ...sides];
}

/**
 * Överlappet förlängt rakt ut över skivans kant åt det håll tillbyggnaden
 * sitter, som ett konvext område, och konturens hörn på den kanten. Sidorna
 * följer tillbyggnadens takfall, så urtaget ligger kloss an mot taket och
 * blir snett där taket lutar.
 */
function extendToEdgeFacing(hostRoof: Part, overlap: readonly Vec2[], outward: Vec3): { notch: Vec2[]; edge: Vec2[] } {
  const axes = describeAxes(hostRoof);
  const outline = boundsOf(hostRoof.outline);
  const towardX = dot3(outward, axes.alongX);
  const towardY = dot3(outward, axes.alongY);
  const isAlongY = Math.abs(towardY) >= Math.abs(towardX);
  const isTowardMin = (isAlongY ? towardY : towardX) < 0;
  const edgeValue = isAlongY ? (isTowardMin ? outline.minY : outline.maxY) : isTowardMin ? outline.minX : outline.maxX;
  const beyondEdge = edgeValue + (isTowardMin ? -NOTCH_MARGIN_MM : NOTCH_MARGIN_MM);
  const atEdge = overlap.map((point) => (isAlongY ? vec2(point.x, beyondEdge) : vec2(beyondEdge, point.y)));
  const edge = hostRoof.outline.filter((point) => Math.abs((isAlongY ? point.y : point.x) - edgeValue) < EDGE_TOLERANCE_MM);
  return { notch: [...convexHull([...overlap, ...atEdge])], edge };
}

function describeAxes(part: Part): PartAxes {
  const origin = transformPoint(part.transform, vec3(0, 0, 0));
  const axis = (x: number, y: number, z: number) => subtract3(transformPoint(part.transform, vec3(x, y, z)), origin);
  return { origin, alongX: axis(1, 0, 0), alongY: axis(0, 1, 0), normal: axis(0, 0, 1) };
}

function scale(vector: Vec3, factor: number): Vec3 {
  return vec3(vector.x * factor, vector.y * factor, vector.z * factor);
}

function add(a: Vec3, b: Vec3): Vec3 {
  return vec3(a.x + b.x, a.y + b.y, a.z + b.z);
}
