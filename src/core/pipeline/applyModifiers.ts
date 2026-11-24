import { subtractRegion } from '../geometry/clipping';
import { invertRigidMatrix, transformPoint } from '../geometry/matrix';
import type { Modifier } from '../model/modifier';
import type { Part } from '../model/part';

/** Påverkan från ett visst objekt, så att ett misslyckande kan visas på rätt objekt. */
export interface SourcedModifier {
  sourceInstanceId: string;
  modifier: Modifier;
}

export interface ModifiedParts {
  parts: Part[];
  /** Objekt vars påverkan inte gick att lägga på, t.ex. en öppning som skulle dela väggen. */
  failedInstanceIds: string[];
}

/**
 * Lägger på andra objekts påverkan på delarna, t.ex. öppningen där en
 * tillbyggnad möter huset. Områdena ligger i världen och fälls ner i delens
 * eget plan. En öppning som skulle dela delen i flera bitar läggs inte på;
 * delen behålls hel och objektet rapporteras, så att regelkontrollen kan säga till.
 */
export function applyModifiers(parts: readonly Part[], modifiers: readonly SourcedModifier[]): ModifiedParts {
  const failedInstanceIds: string[] = [];
  const modified = parts.map((part) =>
    modifiers
      .filter((entry) => entry.modifier.targetPartId === part.id)
      .reduce((current, entry) => {
        const result = removeRegion(current, entry.modifier);
        if (!result) failedInstanceIds.push(entry.sourceInstanceId);
        return result ?? current;
      }, part),
  );
  return { parts: modified, failedInstanceIds };
}

function removeRegion(part: Part, modifier: Modifier): Part | undefined {
  const toPart = invertRigidMatrix(part.transform);
  const region = modifier.region.map((point) => {
    const local = transformPoint(toPart, point);
    return { x: local.x, y: local.y };
  });
  const pieces = subtractRegion(part, region);
  const [piece] = pieces;
  if (!piece || pieces.length > 1) return undefined;
  return { ...part, outline: piece.outline, holes: piece.holes };
}
