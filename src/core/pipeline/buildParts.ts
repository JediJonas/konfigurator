import type { Design } from '../model/design';
import type { Domain } from '../model/domain';
import type { Part } from '../model/part';
import type { ModifiedParts } from './applyModifiers';
import { applyModifiers } from './applyModifiers';
import type { PlacedInstance } from './placeInstances';
import { placeInstances } from './placeInstances';

/**
 * Flödet Design → delar. Allt som 3D-vyn och exporten visar kommer härifrån,
 * så att det man ser är exakt det som går att tillverka.
 */
export function buildParts(design: Design, domain: Domain): Part[] {
  return collectParts(placeInstances(design, domain)).parts;
}

/** Alla delar med påverkan från andra objekt pålagd. */
export function collectParts(placed: readonly PlacedInstance[]): ModifiedParts {
  return applyModifiers(
    placed.flatMap((entry) => entry.parts),
    placed.flatMap((entry) => entry.modifiers.map((modifier) => ({ sourceInstanceId: entry.instance.id, modifier }))),
  );
}
