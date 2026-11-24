import type { Mm } from '../geometry/vector';
import type { Design } from './design';
import type { ObjectType } from './objectType';

export interface Material {
  id: string;
  labelKey: string;
  thickness: Mm;
  sheet: { width: Mm; height: Mm };
  /** Färg i 3D-vyn, som CSS-färg. */
  color: string;
}

export interface Preset {
  id: string;
  labelKey: string;
  create(): Design;
}

export interface Domain {
  id: string;
  version: number;
  // Objekttyperna har olika parametertyper; flödet validerar params mot schemat innan anrop.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- se raden ovan
  objectTypes: ObjectType<any>[];
  materials: Material[];
  presets: Preset[];
  strings: Record<string, string>;
}
