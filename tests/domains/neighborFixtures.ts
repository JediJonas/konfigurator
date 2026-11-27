import type { Design, Instance } from '../../src/core/model/design';
import { SECTION_TYPE_ID } from '../../src/domains/gingerbread/objects/section';
import { designWithExtensions, HOST_PARAMS } from './extensionFixtures';

export const TOWER_PARAMS = { width: 80, depth: 80, wallHeight: 200, roof: 'spire4' };
export const BLOCK_PARAMS = { width: 60, depth: 120, wallHeight: 100, roof: 'gable', roofPitch: 45 };

/** En sektion som står bredvid en vägg på föräldern, t.ex. "beside-side-right". */
export function beside(id: string, socketId: string, params: Record<string, unknown>, children: Instance[] = []): Instance {
  return { id, type: SECTION_TYPE_ID, params, attachment: { socketId, u: 0, v: 0, rotationDegrees: 0 }, children };
}

/**
 * Borg med fyra torn och låga block emellan, runt en gård. Varje block står
 * mot ett torns vägg och nästa torn mot blockets framgavel; det sista blocket
 * når fram till det första tornet utan att sitta på det.
 */
export function castleDesign(): Design {
  const corner = (index: number): Instance[] => {
    if (index > 4) return [];
    const blockSocket = index === 1 ? 'beside-side-right' : 'beside-side-left';
    const tower = index < 4 ? [beside(`T${index + 1}`, 'beside-gable-front', TOWER_PARAMS, corner(index + 1))] : [];
    return [beside(`B${index}`, blockSocket, BLOCK_PARAMS, tower)];
  };
  const design = designWithExtensions(...corner(1));
  const firstTower = design.root.children[0];
  if (firstTower) firstTower.params = TOWER_PARAMS;
  return design;
}

/** Huset med ett torn mitt på högra långväggen. */
export function houseWithTower(towerParams: Record<string, unknown>): Design {
  const design = designWithExtensions(beside('S2', 'beside-side-right', towerParams));
  const host = design.root.children[0];
  if (host) host.params = HOST_PARAMS;
  return design;
}
