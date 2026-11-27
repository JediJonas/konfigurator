import type { Design, Instance } from '../../core/model/design';
import { GINGERBREAD_DOMAIN_VERSION } from './identity';

/** Dörrens id; skrivs ut här så att migreringen inte beror på dagens objekttyp. */
const DOOR_TYPE_ID = 'gb.door';

/**
 * Gör om en sparad pepparkaksdesign till dagens parametrar.
 * Version 2: dörrens gångjärn (`hinge`) blev dess typ (`kind`), med samma värden för vänster- och högerhängd.
 */
export function migrateGingerbreadParams(design: Design): Design {
  if (design.domainVersion >= GINGERBREAD_DOMAIN_VERSION) return design;
  return { ...design, domainVersion: GINGERBREAD_DOMAIN_VERSION, root: moveHingeToKind(design.root) };
}

function moveHingeToKind(instance: Instance): Instance {
  const children = instance.children.map(moveHingeToKind);
  if (instance.type !== DOOR_TYPE_ID || !('hinge' in instance.params)) return { ...instance, children };
  const { hinge, ...params } = instance.params;
  return { ...instance, params: { ...params, kind: params.kind ?? hinge }, children };
}
