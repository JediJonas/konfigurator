import type { Design, Instance } from '../../core/model/design';
import { GINGERBREAD_DOMAIN_VERSION } from './identity';

/** Dörrens id; skrivs ut här så att migreringen inte beror på dagens objekttyp. */
const DOOR_TYPE_ID = 'gb.door';
/** Dörrtyper från version 2 som blev enkeldörr i version 3. */
const SINGLE_DOOR_KINDS_V2 = ['left', 'right'];

/**
 * Gör om en sparad pepparkaksdesign till dagens parametrar.
 * Version 2: dörrens gångjärn (`hinge`) blev dess typ (`kind`).
 * Version 3: vänster- och högerhängd blev enkeldörr, och dörren står alltid 30° öppen (`openAngle` togs bort).
 */
export function migrateGingerbreadParams(design: Design): Design {
  if (design.domainVersion >= GINGERBREAD_DOMAIN_VERSION) return design;
  return { ...design, domainVersion: GINGERBREAD_DOMAIN_VERSION, root: migrateDoors(design.root) };
}

function migrateDoors(instance: Instance): Instance {
  const children = instance.children.map(migrateDoors);
  if (instance.type !== DOOR_TYPE_ID) return { ...instance, children };
  const params = Object.fromEntries(Object.entries(instance.params).filter(([key]) => key !== 'hinge' && key !== 'openAngle'));
  const hinge = instance.params.hinge;
  const kind = params.kind ?? hinge;
  return { ...instance, params: { ...params, kind: SINGLE_DOOR_KINDS_V2.includes(String(kind)) ? 'single' : kind }, children };
}
