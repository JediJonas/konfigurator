import { overlapArea } from '../geometry/clipping';
import { convexHull, isPointInPolygon } from '../geometry/hull';
import type { Polygon } from '../geometry/polygon';
import { transformPoint } from '../geometry/matrix';
import type { Vec2, Vec3 } from '../geometry/vector';
import { vec3 } from '../geometry/vector';
import type { Socket } from '../model/objectType';
import type { Part } from '../model/part';
import { findBeyondCount, findCoveringOthers, findOffSolidPart } from './surfaceRules';
import { projectOntoFrame } from '../pipeline/frame';
import type { PlacedInstance } from '../pipeline/placeInstances';
import { coreStrings } from '../text/strings.sv';
import type { AllowedParamValuesRule, AllowedRotationsRule, ParamLimitRule, Rule, RuleViolation } from './rule';

/** Hur långt utanför kopplingspunktens yta en punkt får ligga, för avrundning. */
const BOUNDS_TOLERANCE_MM = 0.05;
/** Överlapp under detta räknas som att objekten bara nuddar varandra. */
const OVERLAP_TOLERANCE_MM2 = 1;
const FULL_TURN_DEGREES = 360;

type ResolveLabel = (key: string) => string;

/**
 * Prövar designen mot domänens regler. Samma kontroll används för att visa
 * fel i panelen, gråa ut val och stoppa ritningen när huset inte går att bygga.
 */
export function validateDesign(placed: readonly PlacedInstance[], parts: readonly Part[], rules: readonly Rule[], resolveLabel: ResolveLabel): RuleViolation[] {
  const violations = placed.flatMap((entry) => checkAttachesTo(entry));
  for (const rule of rules) {
    const matching = placed.filter((entry) => entry.instance.type === rule.objectType);
    const failing = findFailingInstances(rule, matching, { placed, parts });
    violations.push(...failing.map((instanceId) => ({ level: rule.level, instanceId, message: resolveLabel(rule.messageKey) })));
  }
  return violations;
}

export function hasErrors(violations: readonly RuleViolation[]): boolean {
  return violations.some((violation) => violation.level === 'error');
}

function checkAttachesTo(entry: PlacedInstance): RuleViolation[] {
  const socket = entry.socket;
  if (!socket || entry.objectType.attachesTo.includes(socket.kind)) return [];
  return [{ level: 'error', instanceId: entry.instance.id, message: coreStrings.cannotAttachHere }];
}

/** Hela designen, för regler som prövar ett objekt mot andra objekt eller mot de färdiga delarna. */
interface DesignState {
  placed: readonly PlacedInstance[];
  parts: readonly Part[];
}

function findFailingInstances(rule: Rule, entries: PlacedInstance[], design: DesignState): string[] {
  switch (rule.kind) {
    case 'allowedRotations':
      return entries.filter((entry) => !hasAllowedRotation(rule, entry)).map((entry) => entry.instance.id);
    case 'withinSocketBounds':
      return entries.filter((entry) => entry.socket && !isWithinSocket(entry, entry.socket)).map((entry) => entry.instance.id);
    case 'noOverlap':
      return findOverlapping(entries);
    case 'paramLimit':
      return entries.filter((entry) => exceedsLimit(rule, entry)).map((entry) => entry.instance.id);
    case 'allowedParamValues':
      return entries.filter((entry) => !hasAllowedValue(rule, entry)).map((entry) => entry.instance.id);
    case 'onSolidPart':
      return [...new Set([...findOffSolidPart(entries, design.parts), ...findCoveringOthers(entries, design.placed, design.parts)])];
    case 'maxCountPerSocket':
      return findBeyondCount(entries, rule.max);
  }
}

function hasAllowedRotation(rule: AllowedRotationsRule, entry: PlacedInstance): boolean {
  const attachment = entry.instance.attachment;
  if (!attachment || entry.socket?.kind !== rule.socketKind) return true;
  const rotation = ((attachment.rotationDegrees % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
  return rule.degrees.includes(rotation);
}

function exceedsLimit(rule: ParamLimitRule, entry: PlacedInstance): boolean {
  const value = entry.params[rule.param];
  return typeof value === 'number' && value > rule.max;
}

function hasAllowedValue(rule: AllowedParamValuesRule, entry: PlacedInstance): boolean {
  if (entry.socket?.kind !== rule.socketKind) return true;
  return rule.values.includes(String(entry.params[rule.param]));
}

/** Ytan objektet tar i kopplingspunktens plan, som konvext hölje. */
export function silhouetteInSocket(entry: PlacedInstance, socket: Socket): Vec2[] {
  const outline = entry.objectType.socketOutline?.(entry.params, entry.context);
  const worldPoints = outline
    ? outline.map((point) => transformPoint(entry.matrix, point))
    : entry.parts.flatMap((part) => [0, part.thickness].flatMap((z) => part.outline.map((point) => transformPoint(part.transform, vec3(point.x, point.y, z)))));
  return projectHull(worldPoints, socket);
}

/** Objektets topp i kopplingspunktens plan, som konvext hölje. Tom när objekttypen inte anger någon topp. */
export function topSilhouetteInSocket(entry: PlacedInstance, socket: Socket): Vec2[] {
  const outline = entry.objectType.socketTopOutline?.(entry.params, entry.context) ?? [];
  return projectHull(outline.map((point) => transformPoint(entry.matrix, point)), socket);
}

function projectHull(worldPoints: readonly Vec3[], socket: Socket): Vec2[] {
  return convexHull(worldPoints.map((point) => projectOntoFrame(socket.frame, point)));
}

function isWithinSocket(entry: PlacedInstance, socket: Socket): boolean {
  // Ytorna i kopplingspunkterna är konvexa, så det räcker att höljenas hörn ligger i dem.
  const isInside = (polygon: Vec2[], bounds: Vec2[]) => polygon.every((point) => isPointInPolygon(point, bounds, BOUNDS_TOLERANCE_MM));
  return isInside(silhouetteInSocket(entry, socket), socket.bounds) && isInside(topSilhouetteInSocket(entry, socket), socket.topBounds ?? socket.bounds);
}

/** Objektets yta på marken i världen, med x och z som planets koordinater. */
export function footprintInWorld(entry: PlacedInstance): Polygon | undefined {
  const footprint = entry.objectType.footprint?.(entry.params, entry.context);
  return footprint?.map((point) => {
    const world = transformPoint(entry.matrix, vec3(point.x, 0, point.y));
    return { x: world.x, y: world.z };
  });
}

/** Det senare av två överlappande objekt får felet, eftersom det är det som lades till sist. */
function findOverlapping(entries: PlacedInstance[]): string[] {
  const footprints = entries.map(footprintInWorld);
  return entries
    .filter((_, index) => {
      const own = footprints[index];
      return (
        own !== undefined &&
        footprints.slice(0, index).some((other, otherIndex) => {
          // En tillbyggnad möter sin värd med flit; där gäller kopplingspunktens yta i stället.
          const isJoinedToOther = entries[otherIndex]?.instance.id === entries[index]?.parentId;
          return other !== undefined && !isJoinedToOther && overlapArea(own, other) > OVERLAP_TOLERANCE_MM2;
        })
      );
    })
    .map((entry) => entry.instance.id);
}
