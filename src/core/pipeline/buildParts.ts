import type { Design } from '../model/design';
import type { Domain } from '../model/domain';
import type { Part } from '../model/part';
import type { ModifiedParts } from './applyModifiers';
import type { InteractionResolver } from './interaction';
import { applyModifiers } from './applyModifiers';
import type { PlacedInstance } from './placeInstances';
import { placeInstances } from './placeInstances';

/**
 * Flödet Design → delar. Allt som 3D-vyn och exporten visar kommer härifrån,
 * så att det man ser är exakt det som går att tillverka.
 */
export function buildParts(design: Design, domain: Domain): Part[] {
  return collectParts(placeInstances(design, domain), domain.interactions).parts;
}

/** Alla delar med påverkan från andra objekt och samverkan pålagd, i flödets ordning (SPEC.md avsnitt 6). */
export function collectParts(placed: readonly PlacedInstance[], interactions: readonly InteractionResolver[]): ModifiedParts {
  const modified = applyModifiers(
    placed.flatMap((entry) => entry.parts),
    placed.flatMap((entry) => entry.modifiers.map((modifier) => ({ sourceInstanceId: entry.instance.id, modifier }))),
  );
  const parts = interactions.reduce<Part[]>((current, interaction) => interaction.resolve(placed, current), modified.parts);
  return { ...modified, parts };
}
