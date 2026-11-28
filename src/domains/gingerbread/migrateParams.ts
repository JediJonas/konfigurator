import type { Design, Instance } from '../../core/model/design';
import { GINGERBREAD_DOMAIN_VERSION } from './identity';

/** Dörrens id; skrivs ut här så att migreringen inte beror på dagens objekttyp. */
const DOOR_TYPE_ID = 'gb.door';
/** Dörrtyper från version 2 som blev enkeldörr i version 3. */
const SINGLE_DOOR_KINDS_V2 = ['left', 'right'];
/** Fönstrets id, av samma skäl som dörrens. */
const WINDOW_TYPE_ID = 'gb.window';

/**
 * Gör om en sparad pepparkaksdesign till dagens parametrar.
 * Version 2: dörrens gångjärn (`hinge`) blev dess typ (`kind`).
 * Version 3: vänster- och högerhängd blev enkeldörr, och dörren står alltid 30° öppen (`openAngle` togs bort).
 * Version 4: fönstrets spröjs `cross` blev `four` (Fyra rutor), när Två och Sex rutor kom till.
 */
export function migrateGingerbreadParams(design: Design): Design {
  if (design.domainVersion >= GINGERBREAD_DOMAIN_VERSION) return design;
  return { ...design, domainVersion: GINGERBREAD_DOMAIN_VERSION, root: migrateOpenings(design.root) };
}

function migrateOpenings(instance: Instance): Instance {
  const children = instance.children.map(migrateOpenings);
  if (instance.type === WINDOW_TYPE_ID) return { ...instance, params: migrateWindowParams(instance.params), children };
  if (instance.type !== DOOR_TYPE_ID) return { ...instance, children };
  const params = Object.fromEntries(Object.entries(instance.params).filter(([key]) => key !== 'hinge' && key !== 'openAngle'));
  const hinge = instance.params.hinge;
  const kind = params.kind ?? hinge;
  return { ...instance, params: { ...params, kind: SINGLE_DOOR_KINDS_V2.includes(String(kind)) ? 'single' : kind }, children };
}

function migrateWindowParams(params: Instance['params']): Instance['params'] {
  return params.mullions === 'cross' ? { ...params, mullions: 'four' } : params;
}
