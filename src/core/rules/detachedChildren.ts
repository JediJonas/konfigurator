import type { Vec3 } from '../geometry/vector';
import { dot3, length3 } from '../geometry/vector';
import type { Design, Instance } from '../model/design';
import type { Domain } from '../model/domain';
import type { Socket } from '../model/objectType';
import type { PlacedInstance } from '../pipeline/placeInstances';
import { placeInstances } from '../pipeline/placeInstances';

/**
 * Flyttar objekt vars kopplingspunkt försvann vid en ändring av föräldern,
 * t.ex. en takkupa när taket vrids 90° eller byter taktyp, så att takfallen
 * får andra namn. Objektet flyttas till förälderns punkt av samma sort som
 * vetter mest åt samma håll som den gamla och behåller sitt läge i punkten.
 * Finns ingen sådan punkt, t.ex. på ett platt tak, tas objektet bort med allt
 * som sitter på det; ändringen går att ångra.
 */
export function reattachDetachedChildren(before: Design, after: Design, domain: Domain): Design {
  const placedAfter = placeInstances(after, domain, { isSkippingDetached: true });
  const placedIds = new Set(placedAfter.map((entry) => entry.instance.id));
  // Har inget lossnat är designen klar, och den gamla behöver inte räknas.
  if (!hasDetachedChild(after.root, placedIds)) return after;
  const socketsBefore = mapSocketsByInstance(placeInstances(before, domain, { isSkippingDetached: true }));
  const socketsAfter = mapSocketsByInstance(placedAfter);
  const findReplacement = (child: Instance, parentId: string) => findReplacementSocket(child, socketsBefore.get(parentId) ?? [], socketsAfter.get(parentId) ?? []);
  return { ...after, root: reattachChildren(after.root, placedIds, findReplacement) };
}

/** Skillnad i cosinus som räknas som lika riktning. */
const SAME_ALIGNMENT_TOLERANCE = 1e-6;

type FindReplacement = (child: Instance, parentId: string) => Socket | undefined;

/**
 * Går nedåt genom objekten som fortfarande sitter fast. Ett objekt som har
 * lossnat flyttas med allt som sitter på det, eftersom dess egna punkter inte har ändrats.
 */
function reattachChildren(instance: Instance, placedIds: ReadonlySet<string>, findReplacement: FindReplacement): Instance {
  const children = instance.children.flatMap((child): Instance[] => {
    const attachment = child.attachment;
    if (placedIds.has(child.id) || !attachment) return [reattachChildren(child, placedIds, findReplacement)];
    const replacement = findReplacement(child, instance.id);
    return replacement ? [{ ...child, attachment: { ...attachment, socketId: replacement.id } }] : [];
  });
  return { ...instance, children };
}

/** Förälderns punkt av samma sort som den gamla som vetter mest åt samma håll. */
function findReplacementSocket(child: Instance, socketsBefore: readonly Socket[], socketsAfter: readonly Socket[]): Socket | undefined {
  const socketId = child.attachment?.socketId;
  const old = socketsBefore.find((socket) => socket.id === socketId);
  if (!old) return undefined;
  const oldIndex = socketsBefore.filter((socket) => socket.kind === old.kind).indexOf(old);
  const candidates = socketsAfter.filter((socket) => socket.kind === old.kind);
  let best: Socket | undefined;
  let bestAlignment = -Infinity;
  candidates.forEach((candidate, index) => {
    const alignment = dot3(unit(old.frame.normal), unit(candidate.frame.normal));
    // Vetter två lika mycket åt samma håll, t.ex. båda takfallen när taket vrids 90°, väljs den på samma plats i ordningen.
    const isTie = Math.abs(alignment - bestAlignment) < SAME_ALIGNMENT_TOLERANCE;
    if ((isTie && index === oldIndex) || (!isTie && alignment > bestAlignment)) {
      best = candidate;
      bestAlignment = alignment;
    }
  });
  return best;
}

function hasDetachedChild(instance: Instance, placedIds: ReadonlySet<string>): boolean {
  return instance.children.some((child) => !placedIds.has(child.id) || hasDetachedChild(child, placedIds));
}

function mapSocketsByInstance(placed: readonly PlacedInstance[]): Map<string, Socket[]> {
  return new Map(placed.map((entry) => [entry.instance.id, entry.sockets]));
}

function unit(vector: Vec3): Vec3 {
  const length = length3(vector) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}
