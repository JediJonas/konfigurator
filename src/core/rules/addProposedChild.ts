import type { Design } from '../model/design';
import type { Domain } from '../model/domain';
import { addChildInstance } from '../model/instanceTree';
import { findObjectType } from '../pipeline/placeInstances';
import type { ChildRequest } from './placement';
import { proposeChild } from './placement';

/**
 * Lägger till förslaget när det klarar reglerna, och sedan de objekt som
 * objekttypen får direkt (`startsWith`), var och en bara om den också klarar
 * reglerna. Ett fönster som inte ryms i en ny takkupa hindrar alltså inte kupan.
 * Designen är oförändrad när förslaget självt inte går.
 */
export function addProposedChild(design: Design, domain: Domain, request: ChildRequest): Design {
  const proposal = proposeChild(design, domain, request);
  if (proposal.violations.length > 0) return design;
  const withChild = { ...design, root: addChildInstance(design.root, request.parentId, proposal.instance) };
  const startingChildren = findObjectType(domain, request.objectTypeId).startsWith ?? [];
  return startingChildren.reduce((current, starting) => {
    const child = proposeChild(current, domain, { parentId: proposal.instance.id, socketId: starting.socketId, objectTypeId: starting.objectTypeId });
    return child.violations.length > 0 ? current : { ...current, root: addChildInstance(current.root, proposal.instance.id, child.instance) };
  }, withChild);
}
