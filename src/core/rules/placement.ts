import type { Design, Instance } from '../model/design';
import type { Domain } from '../model/domain';
import { addChildInstance, nextInstanceId, updateInstance } from '../model/instanceTree';
import { pickInheritedParams } from '../model/paramForm';
import { findObjectType, placeInstances } from '../pipeline/placeInstances';
import type { MaxCountPerSocketRule, RuleViolation } from './rule';
import { listViolations } from './evaluateDesign';
import { attachInFittingSockets, listAffectedInstanceIds, listAlternativeSockets } from './socketChoice';
import type { PlacedInstance } from '../pipeline/placeInstances';
import type { ObjectType, Socket } from '../model/objectType';
import { coreStrings } from '../text/strings.sv';
import { transformPoint } from '../geometry/matrix';
import { vec3 } from '../geometry/vector';
import { projectOntoFrame } from '../pipeline/frame';

/** Lägen längs en kopplingspunkt snäpper till jämna steg, så att mitten och symmetriska lägen är lätta att träffa. */
export const SNAP_STEP_MM = 5;

export interface ChildRequest {
  parentId: string;
  socketId: string;
  objectTypeId: string;
}

export interface ChildProposal {
  instance: Instance;
  /** Regelbrott för det nya objektet. Tom när det går att lägga till. */
  violations: RuleViolation[];
  /** Varför objektet inte går att lägga till alls, oavsett storlek och läge, t.ex. att väggen redan har en dörr. */
  blockingMessage?: string;
}

const ignoreLabel = (key: string) => key;

/** Steget när ett nytt objekt letar efter en plats längs kopplingspunkten. Två snäppsteg räcker och halverar arbetet. */
const SEARCH_STEP_MM = 2 * SNAP_STEP_MM;

/**
 * Ett nytt objekt som snäpper mitt i kopplingspunkten, i den största storlek
 * som klarar reglerna. Ryms ingen storlek i mitten, t.ex. för att en granne
 * eller huvudhusets tak är i vägen, prövas lägen längre ut åt båda hållen.
 * Klarar inget reglerna kommer det minsta förslaget i mitten med sina
 * regelbrott, så att panelen kan förklara varför det inte går. Har
 * objekttypen inga storlekar för kopplingspunkten går det inte alls.
 */
export function proposeChild(design: Design, domain: Domain, request: ChildRequest, resolveLabel = ignoreLabel): ChildProposal {
  const objectType = findObjectType(domain, request.objectTypeId);
  const parent = placeInstances(design, domain).find((entry) => entry.instance.id === request.parentId);
  const socket = parent?.sockets.find((candidate) => candidate.id === request.socketId);
  if (!parent || !socket) throw new Error(`Kopplingspunkten "${request.socketId}" finns inte på "${request.parentId}".`);
  // En vägg kan ha flera punkter, t.ex. för tillbyggnad och för sektion bredvid; den första som ger ett förslag som går används.
  const alternatives = listAlternativeSockets(parent.sockets, socket, objectType);
  const proposals = (alternatives.length > 0 ? alternatives : [socket]).map((alternative) =>
    proposeInSocket(design, domain, { parent, socket: alternative, objectType, resolveLabel }),
  );
  const first = proposals[0];
  if (!first) throw new Error(`Objekttypen "${objectType.id}" har inga förslag på parametrar.`);
  return proposals.find((proposal) => proposal.violations.length === 0) ?? first;
}

interface SocketProposalRequest {
  parent: PlacedInstance;
  socket: Socket;
  objectType: ObjectType<unknown>;
  resolveLabel: (key: string) => string;
}

function proposeInSocket(design: Design, domain: Domain, request: SocketProposalRequest): ChildProposal {
  const { parent, socket, objectType, resolveLabel } = request;
  // Fält som ärvs, t.ex. taket, tas från föräldern när den är av samma typ.
  const inherited = parent.instance.type === objectType.id ? pickInheritedParams(objectType.params, parent.instance.params) : {};
  // Objekttypen lägger själv de ärvda värdena på sina förslag, och får byta ut ett ärvt värde som inte går här.
  const candidates = objectType.paramCandidates?.(socket, { thickness: design.material.thickness, socket }, inherited) ?? [{ ...inherited }];
  const id = nextInstanceId(design.root, objectType.instanceIdPrefix);
  const full = findFullCountRule(domain, parent.instance, socket, objectType);
  if (full) {
    const message = resolveLabel(full.messageKey);
    const instance: Instance = { id, type: objectType.id, params: candidates[0] ?? {}, attachment: { socketId: socket.id, u: 0, v: 0, rotationDegrees: 0 }, children: [] };
    return { instance, violations: [{ level: full.level, instanceId: id, message }], blockingMessage: message };
  }
  const before = listErrorKeys(design, domain, resolveLabel);
  if (candidates.length === 0) {
    const instance: Instance = { id, type: objectType.id, params: {}, attachment: { socketId: socket.id, u: 0, v: 0, rotationDegrees: 0 }, children: [] };
    return { instance, violations: [{ level: 'error', instanceId: id, message: coreStrings.noSizeFits }] };
  }
  const propose = (params: Record<string, unknown>, u: number): ChildProposal => {
    const instance: Instance = { id, type: objectType.id, params, attachment: { socketId: socket.id, u, v: 0, rotationDegrees: 0 }, children: [] };
    const candidateDesign = { ...design, root: addChildInstance(design.root, parent.instance.id, instance) };
    return { instance, violations: findErrorsFor(candidateDesign, domain, { instanceId: id, before }, resolveLabel) };
  };
  const reach = Math.max(...socket.bounds.map((point) => Math.abs(point.x)));
  const offsets = [0, ...listSearchOffsets(reach)];
  let centered: ChildProposal | undefined;
  for (const [u, params] of listTrials(offsets, candidates, objectType.prefersSizeOverCenter ?? false)) {
    const proposal = propose(params, u);
    if (proposal.violations.length === 0) return proposal;
    if (u === 0) centered = proposal;
  }
  if (!centered) throw new Error(`Objekttypen "${objectType.id}" har inga förslag på parametrar.`);
  return centered;
}

/** Regeln om högsta antal som redan är nådd i kopplingspunkten, t.ex. en dörr per vägg. */
function findFullCountRule(domain: Domain, parent: Instance, socket: Socket, objectType: ObjectType<unknown>): MaxCountPerSocketRule | undefined {
  const count = parent.children.filter((child) => child.type === objectType.id && child.attachment?.socketId === socket.id).length;
  return domain.rules.find((rule): rule is MaxCountPerSocketRule => rule.kind === 'maxCountPerSocket' && rule.objectType === objectType.id && count >= rule.max);
}

/** Lägen och storlekar i den ordning de prövas: alla storlekar i mitten först, eller varje storlek längs hela punkten först. */
function listTrials<T>(offsets: readonly number[], candidates: readonly T[], isSizeFirst: boolean): [number, T][] {
  return isSizeFirst
    ? candidates.flatMap((params) => offsets.map((u): [number, T] => [u, params]))
    : offsets.flatMap((u) => candidates.map((params): [number, T] => [u, params]));
}

/** Lägen från mitten och utåt, omväxlande åt båda hållen: 10, −10, 20, −20 … */
function listSearchOffsets(reach: number): number[] {
  const offsets: number[] = [];
  for (let distance = SEARCH_STEP_MM; distance <= reach; distance += SEARCH_STEP_MM) offsets.push(distance, -distance);
  return offsets;
}

/**
 * Flyttar ett objekt längs kopplingspunkten till närmaste snäppläge som klarar
 * reglerna, räknat från det önskade läget in mot mitten.
 */
export function snapAttachmentOffset(design: Design, domain: Domain, instanceId: string, desiredU: number): Design {
  const snapped = Math.round(desiredU / SNAP_STEP_MM) * SNAP_STEP_MM;
  const before = listErrorKeys(design, domain);
  const direction = -Math.sign(snapped);
  const stepCount = Math.abs(snapped) / SNAP_STEP_MM;
  for (let step = 0; step <= stepCount; step++) {
    const candidate = attachInFittingSockets(withOffset(design, instanceId, snapped + direction * step * SNAP_STEP_MM), domain, [instanceId]);
    if (findErrorsFor(candidate, domain, { instanceId, before }, ignoreLabel).length === 0) return candidate;
  }
  return attachInFittingSockets(withOffset(design, instanceId, snapped), domain, [instanceId]);
}

function withOffset(design: Design, instanceId: string, u: number): Design {
  return {
    ...design,
    root: updateInstance(design.root, instanceId, (instance) =>
      instance.attachment ? { ...instance, attachment: { ...instance.attachment, u } } : instance,
    ),
  };
}

/** Objektet som ändras, och felen som designen hade innan, som nycklar från `listErrorKeys`. */
interface ChangedInstance {
  instanceId: string;
  before: ReadonlySet<string>;
}

/**
 * Felen för objektet, och nya fel på andra objekt som ändringen ger, t.ex.
 * ett fönster som en ny tillbyggnad skulle täcka. Fel som fanns innan räknas inte.
 */
function findErrorsFor(design: Design, domain: Domain, changed: ChangedInstance, resolveLabel: (key: string) => string): RuleViolation[] {
  const { instanceId, before } = changed;
  try {
    return listViolations(design, domain, resolveLabel).filter(
      (violation) => violation.level === 'error' && (violation.instanceId === instanceId || !before.has(errorKey(violation))),
    );
  } catch (error) {
    return [{ level: 'error', instanceId, message: error instanceof Error ? error.message : String(error) }];
  }
}

function listErrorKeys(design: Design, domain: Domain, resolveLabel = ignoreLabel): Set<string> {
  try {
    return new Set(listViolations(design, domain, resolveLabel).filter((violation) => violation.level === 'error').map(errorKey));
  } catch {
    return new Set();
  }
}

function errorKey(violation: RuleViolation): string {
  return `${violation.instanceId}|${violation.message}`;
}

export interface OffsetRange {
  min: number;
  max: number;
}

/**
 * Hur långt ett objekt kan flyttas längs sin kopplingspunkt och fortfarande
 * klara reglerna, i snäppsteg från där det sitter nu. Visas i panelen, så att
 * man ser varför ett läge inte går. Objektet får byta kopplingspunkt på vägen,
 * t.ex. från tillbyggnad till sektion bredvid förbi väggens hörn, och korta
 * glapp där inget av sätten går hoppas över (`MAX_GAP_STEPS`).
 */
export function findAllowedOffsetRange(design: Design, domain: Domain, request: { instanceId: string; currentU: number; maxReachMm: number }): OffsetRange {
  const { instanceId, currentU, maxReachMm } = request;
  const before = listErrorKeys(design, domain);
  const fits = (u: number) =>
    findErrorsFor(attachInFittingSockets(withOffset(design, instanceId, u), domain, [instanceId]), domain, { instanceId, before }, ignoreLabel).length === 0;
  const reach = (direction: 1 | -1) => {
    let last = currentU;
    let misses = 0;
    for (let u = currentU + direction * SNAP_STEP_MM; Math.abs(u) <= maxReachMm && misses <= MAX_GAP_STEPS; u += direction * SNAP_STEP_MM) {
      if (!fits(u)) {
        misses += 1;
        continue;
      }
      last = u;
      misses = 0;
    }
    return last;
  };
  return { min: reach(-1), max: reach(1) };
}

/**
 * Längsta läget längs kopplingspunkten som kan vara värt att pröva: halva
 * punktens längd plus halva objektets bredd längs den, så att ett objekt som
 * får stå bredvid kan flyttas tills det bara nuddar punktens ände.
 */
export function measureOffsetReach(entry: PlacedInstance): number {
  const socket = entry.socket;
  if (!socket) return 0;
  const halfLength = Math.max(...socket.bounds.map((point) => Math.abs(point.x)));
  const along = entry.parts.flatMap((part) => part.outline.map((point) => projectOntoFrame(socket.frame, transformPoint(part.transform, vec3(point.x, point.y, 0))).x));
  const halfWidth = along.length > 0 ? (Math.max(...along) - Math.min(...along)) / 2 : 0;
  return halfLength + halfWidth;
}

/**
 * Så många steg i rad som får bryta mot reglerna innan sökningen efter ett
 * måtts gräns ger upp. En sektion som blir högre än väggen går t.ex. från
 * tillbyggnad till sektion bredvid, och emellan kan taken gå in i varandra en
 * bit; fältet ska ändå nå de höjder som går bortom glappet.
 */
const MAX_GAP_STEPS = 8;

export interface ParamRangeRequest {
  instanceId: string;
  param: string;
  current: number;
  step: number;
  /** Schemats gränser, som sökningen aldrig går förbi. */
  min: number;
  max: number;
}

/**
 * Hur långt ett mått kan ändras från sitt nuvarande värde och fortfarande
 * klara reglerna, t.ex. att huset inte blir kortare än tillbyggnaden på dess
 * vägg. Korta glapp där det inte går hoppas över (`MAX_GAP_STEPS`). Har designen redan fel används schemats
 * gränser, så att man kan ändra sig ur felet.
 */
export function findAllowedParamRange(design: Design, domain: Domain, request: ParamRangeRequest): OffsetRange {
  const schemaRange = { min: request.min, max: request.max };
  if (hasAnyError(design, domain)) return schemaRange;
  // Sektionen får byta mellan t.ex. tillbyggnad och sektion bredvid, så att måttet bara stoppas där inget av sätten går.
  const withValue = (value: number): Design =>
    attachInFittingSockets(
      { ...design, root: updateInstance(design.root, request.instanceId, (instance) => ({ ...instance, params: { ...instance.params, [request.param]: value } })) },
      domain,
      listAffectedInstanceIds(design, request.instanceId),
    );
  const reach = (direction: 1 | -1, limit: number) => {
    let last = request.current;
    let misses = 0;
    for (let value = request.current + direction * request.step; direction * (limit - value) >= 0 && misses <= MAX_GAP_STEPS; value += direction * request.step) {
      if (hasAnyError(withValue(value), domain)) {
        misses += 1;
        continue;
      }
      last = value;
      misses = 0;
    }
    return last;
  };
  return { min: reach(-1, request.min), max: reach(1, request.max) };
}

function hasAnyError(design: Design, domain: Domain): boolean {
  try {
    return listViolations(design, domain, ignoreLabel).some((violation) => violation.level === 'error');
  } catch {
    return true;
  }
}
