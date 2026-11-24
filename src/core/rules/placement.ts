import type { Design, Instance } from '../model/design';
import type { Domain } from '../model/domain';
import { addChildInstance, nextInstanceId, updateInstance } from '../model/instanceTree';
import { findObjectType, placeInstances } from '../pipeline/placeInstances';
import type { RuleViolation } from './rule';
import { evaluateDesign } from './evaluateDesign';

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
}

const ignoreLabel = (key: string) => key;

/** Steget när ett nytt objekt letar efter en plats längs kopplingspunkten. Två snäppsteg räcker och halverar arbetet. */
const SEARCH_STEP_MM = 2 * SNAP_STEP_MM;

/**
 * Ett nytt objekt som snäpper mitt i kopplingspunkten, i den största storlek
 * som klarar reglerna. Ryms ingen storlek i mitten, t.ex. för att en granne
 * eller huvudhusets tak är i vägen, prövas lägen längre ut åt båda hållen.
 * Klarar inget reglerna kommer det minsta förslaget i mitten med sina
 * regelbrott, så att panelen kan förklara varför det inte går.
 */
export function proposeChild(design: Design, domain: Domain, request: ChildRequest, resolveLabel = ignoreLabel): ChildProposal {
  const objectType = findObjectType(domain, request.objectTypeId);
  const parent = placeInstances(design, domain).find((entry) => entry.instance.id === request.parentId);
  const socket = parent?.sockets.find((candidate) => candidate.id === request.socketId);
  if (!socket) throw new Error(`Kopplingspunkten "${request.socketId}" finns inte på "${request.parentId}".`);
  const candidates = objectType.paramCandidates?.(socket) ?? [{}];
  const id = nextInstanceId(design.root, objectType.instanceIdPrefix);
  const propose = (params: Record<string, unknown>, u: number): ChildProposal => {
    const instance: Instance = { id, type: objectType.id, params, attachment: { socketId: request.socketId, u, v: 0, rotationDegrees: 0 }, children: [] };
    const candidateDesign = { ...design, root: addChildInstance(design.root, request.parentId, instance) };
    return { instance, violations: findErrorsFor(candidateDesign, domain, id, resolveLabel) };
  };
  const reach = Math.max(...socket.bounds.map((point) => Math.abs(point.x)));
  const offsets = [0, ...listSearchOffsets(reach)];
  let centered: ChildProposal | undefined;
  for (const u of offsets) {
    for (const params of candidates) {
      const proposal = propose(params, u);
      if (proposal.violations.length === 0) return proposal;
      if (u === 0) centered = proposal;
    }
  }
  if (!centered) throw new Error(`Objekttypen "${objectType.id}" har inga förslag på parametrar.`);
  return centered;
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
  const direction = -Math.sign(snapped);
  const stepCount = Math.abs(snapped) / SNAP_STEP_MM;
  for (let step = 0; step <= stepCount; step++) {
    const candidate = withOffset(design, instanceId, snapped + direction * step * SNAP_STEP_MM);
    if (findErrorsFor(candidate, domain, instanceId, ignoreLabel).length === 0) return candidate;
  }
  return withOffset(design, instanceId, snapped);
}

function withOffset(design: Design, instanceId: string, u: number): Design {
  return {
    ...design,
    root: updateInstance(design.root, instanceId, (instance) =>
      instance.attachment ? { ...instance, attachment: { ...instance.attachment, u } } : instance,
    ),
  };
}

function findErrorsFor(design: Design, domain: Domain, instanceId: string, resolveLabel: (key: string) => string): RuleViolation[] {
  try {
    const { violations } = evaluateDesign(design, domain, resolveLabel);
    return violations.filter((violation) => violation.instanceId === instanceId && violation.level === 'error');
  } catch (error) {
    return [{ level: 'error', instanceId, message: error instanceof Error ? error.message : String(error) }];
  }
}

export interface OffsetRange {
  min: number;
  max: number;
}

/**
 * Hur långt ett objekt kan flyttas längs sin kopplingspunkt och fortfarande
 * klara reglerna, i snäppsteg från där det sitter nu. Visas i panelen, så att
 * man ser varför ett läge inte går.
 */
export function findAllowedOffsetRange(design: Design, domain: Domain, request: { instanceId: string; currentU: number; maxReachMm: number }): OffsetRange {
  const { instanceId, currentU, maxReachMm } = request;
  const fits = (u: number) => findErrorsFor(withOffset(design, instanceId, u), domain, instanceId, ignoreLabel).length === 0;
  const reach = (direction: 1 | -1) => {
    let last = currentU;
    for (let u = currentU + direction * SNAP_STEP_MM; Math.abs(u) <= maxReachMm && fits(u); u += direction * SNAP_STEP_MM) last = u;
    return last;
  };
  return { min: reach(-1), max: reach(1) };
}
