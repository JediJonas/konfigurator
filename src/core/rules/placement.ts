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

/**
 * Ett nytt objekt som snäpper mitt i kopplingspunkten, i den största storlek
 * som klarar reglerna. Klarar ingen storlek reglerna kommer den minsta med
 * sina regelbrott, så att panelen kan förklara varför det inte går.
 */
export function proposeChild(design: Design, domain: Domain, request: ChildRequest, resolveLabel = ignoreLabel): ChildProposal {
  const objectType = findObjectType(domain, request.objectTypeId);
  const parent = placeInstances(design, domain).find((entry) => entry.instance.id === request.parentId);
  const socket = parent?.sockets.find((candidate) => candidate.id === request.socketId);
  if (!socket) throw new Error(`Kopplingspunkten "${request.socketId}" finns inte på "${request.parentId}".`);
  const candidates = objectType.paramCandidates?.(socket) ?? [{}];
  let proposal: ChildProposal | undefined;
  for (const params of candidates) {
    const instance: Instance = {
      id: nextInstanceId(design.root, objectType.instanceIdPrefix),
      type: objectType.id,
      params,
      attachment: { socketId: request.socketId, u: 0, v: 0, rotationDegrees: 0 },
      children: [],
    };
    const candidateDesign = { ...design, root: addChildInstance(design.root, request.parentId, instance) };
    proposal = { instance, violations: findErrorsFor(candidateDesign, domain, instance.id, resolveLabel) };
    if (proposal.violations.length === 0) return proposal;
  }
  if (!proposal) throw new Error(`Objekttypen "${objectType.id}" har inga förslag på parametrar.`);
  return proposal;
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
