import type { Vec2 } from '../../../../core/geometry/vector';
import { vec2, vec3 } from '../../../../core/geometry/vector';
import type { Instance } from '../../../../core/model/design';
import type { BuildContext, Socket } from '../../../../core/model/objectType';
import { DORMER_WALL } from '../../socketKinds';
import { wallBounds } from '../sectionSockets';
import { listWallSides, wallTopProfile } from '../sectionWalls';
import type { DormerParams } from './dormerParams';
import { describeDormer, WALL_DROP_MM } from './dormerShape';

/** Kupans framvägg, där fönstret sitter. */
export const DORMER_FRONT_ID = 'gable-front';

/**
 * Framväggens utsida, för ett fönster. Origo mitt på väggen där den möter
 * husets takyta, så att (u, v) är läge längs väggen och höjd över taket, som
 * på en vanlig vägg. Kopplingspunktens u går mot kupans x, så att u × normal pekar uppåt.
 */
export function buildDormerSockets(instance: Instance, params: DormerParams, context: BuildContext): Socket[] {
  const shape = describeDormer(params, context, false);
  const front = listWallSides(shape.section, true).find((side) => side.id === DORMER_FRONT_ID);
  if (!front) return [];
  const sectionBounds = wallBounds(wallTopProfile(shape.section, shape.roofContext, front), shape.section.width);
  return [
    {
      id: DORMER_FRONT_ID,
      kind: DORMER_WALL,
      labelKey: 'socket.dormerFront',
      frame: { origin: vec3(0, 0, 0), u: vec3(-1, 0, 0), normal: vec3(0, 0, 1) },
      // Sektionens golv ligger `WALL_DROP_MM` under husets takyta, där framväggen börjar.
      bounds: sectionBounds.map((point): Vec2 => vec2(point.x, Math.max(0, point.y - WALL_DROP_MM))),
      ownerPartId: `${instance.id}/${DORMER_FRONT_ID}`,
    },
  ];
}
