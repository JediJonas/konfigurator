import type { Matrix4 } from '../geometry/matrix';
import type { Polygon } from '../geometry/polygon';
import type { Mm, Vec2 } from '../geometry/vector';

/** Markering som ritas på delen men inte skärs, t.ex. en vikmarkering. */
export interface Mark {
  kind: 'line' | 'outline';
  points: Vec2[];
  label?: string;
}

/**
 * En platt bit. Konturen ligger i delens eget plan (mm) och extruderas
 * längs lokal z från 0 till `thickness`. `transform` placerar den i världen.
 */
export interface Part {
  /** Stabilt id, t.ex. "S1/side-left". */
  id: string;
  sourceInstanceId: string;
  /** Nyckel i domänens texter. */
  labelKey: string;
  /** Moturs, mm. */
  outline: Polygon;
  holes: Polygon[];
  thickness: Mm;
  transform: Matrix4;
  /** Id på delen som denna är en spegelvänd kopia av. */
  mirroredPairOf?: string;
  marks?: Mark[];
  buildStep: number;
}

/**
 * En del som klipps i bitar, t.ex. en vägg som delas av en granne, får id:n
 * som "S1/side-right~2". Bitarna räknas fortfarande som samma del.
 */
export const PART_PIECE_SEPARATOR = '~';

/** Sant när delen är `partId` eller en bit av den. */
export function isPieceOf(part: Part, partId: string): boolean {
  return part.id === partId || part.id.startsWith(`${partId}${PART_PIECE_SEPARATOR}`);
}
