import type { Mm } from '../geometry/vector';

/** Höjs när formatet ändras. Varje höjning får en migrering i `migrateDesign`. */
export const DESIGN_SCHEMA_VERSION = 1;

/** Var ett objekt sitter på sin förälder, i kopplingspunktens eget koordinatsystem. */
export interface Attachment {
  socketId: string;
  u: Mm;
  v: Mm;
  /** Vridning runt kopplingspunktens normal, i grader moturs. */
  rotationDegrees: number;
}

export interface Instance {
  id: string;
  /** Objekttypens id, t.ex. "gb.section". */
  type: string;
  /** Valideras mot objekttypens parameterschema. */
  params: Record<string, unknown>;
  attachment?: Attachment;
  /** Egen materialtjocklek för detta objekts delar. Saknas den gäller designens. */
  thickness?: Mm;
  /** Monteringsträd: barnen sitter på detta objekt och följer med när det tas bort. */
  children: Instance[];
}

export interface Design {
  version: number;
  domain: string;
  domainVersion: number;
  material: { id: string; thickness: Mm };
  /** Det allt står på, t.ex. ett fat. */
  root: Instance;
}
