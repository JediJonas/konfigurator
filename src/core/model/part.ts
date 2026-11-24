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
