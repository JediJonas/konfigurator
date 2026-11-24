import type { Mm } from '../geometry/vector';
import type { Design } from './design';
import type { ObjectType } from './objectType';
import type { Rule } from '../rules/rule';
import type { InteractionResolver } from '../pipeline/interaction';
import type { JointStyle } from './joint';

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
  /** Kopplingsregler som gäller hela designen. */
  rules: Rule[];
  /** Samverkan mellan objekt som möts, t.ex. tak som bildar vinkelrännor. Körs i ordning efter påverkan. */
  interactions: InteractionResolver[];
  materials: Material[];
  /** Fogarna i domänen; den första används tills man kan välja. */
  jointStyles: JointStyle[];
  presets: Preset[];
  strings: Record<string, string>;
}
