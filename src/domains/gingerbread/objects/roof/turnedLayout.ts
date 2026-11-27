import type { HeightPlane } from '../../../../core/geometry/heightPlanes';
import type { Polygon } from '../../../../core/geometry/polygon';
import { boundsOf } from '../../../../core/geometry/polygon';
import type { Mm, Vec2 } from '../../../../core/geometry/vector';
import { vec2 } from '../../../../core/geometry/vector';
import type { SectionParams } from '../sectionParams';
import type { RoofContext, RoofFace, RoofLayout } from './roofLayout';
import { extensionBackEdge } from './roofLayout';
import { measureTopLip } from './eaveFit';

/** En takyta räknas som fallande mot värden när den sjunker mer än så per mm bakåt. */
const FALLING_SLOPE = 1e-9;

/** Takytornas id efter vridningen: det som låg till höger ligger fram, osv. */
const TURNED_SIDES: Record<string, string> = { right: 'front', front: 'left', left: 'back', back: 'right' };

/**
 * Vridet tak (`isRoofTurned`): taket räknas för sektionen med bredd och längd
 * bytta och vrids sedan 90° runt mitten, så att t.ex. sadeltakets nock går
 * tvärs över huset. Alla taktyper med lutning vrids på samma sätt, och
 * väggarna följer takets undersida som förut.
 *
 * En tillbyggnad har då takytor mot värden. Faller en takyta ner mot värden
 * slutar taket med ovansidans kant mot värdens vägg, annars förlängs det in över värden så att
 * vinkelrännan kan klippa det som vanligt.
 */
export function buildTurnedLayout(params: SectionParams, context: RoofContext, buildUnturned: (params: SectionParams, context: RoofContext) => RoofLayout): RoofLayout {
  const swapped = { ...params, width: params.depth, depth: params.width };
  const unturned = buildUnturned(swapped, { ...context, isExtension: false, reachesIntoHost: false });
  const faces = unturned.faces.map(turnFace);
  const support = unturned.support.map(turnPlane);
  const plan = unturned.plan.map(turnPoint);
  if (!context.isExtension) return { ...unturned, faces, support, plan };
  const towardHost = Math.max(0, ...faces.map((face) => face.plane.slopeZ));
  // Skivans ände står vinkelrätt mot skivan, så ovansidans kant flyttas tillbaka till värdens vägg.
  const back = towardHost > FALLING_SLOPE ? -params.depth / 2 + measureTopLip(towardHost, context.thickness) : extensionBackEdge(params, context);
  return { ...unturned, faces, support, plan: withBackEdge(plan, back) };
}

/** Vrider en punkt sett uppifrån (y är z) 90°: x blir z och z blir −x. */
function turnPoint(point: Vec2): Vec2 {
  return vec2(-point.y, point.x);
}

/** Samma plan efter vridningen: höjden i (x, z) är den i (z, −x) före. */
function turnPlane(plane: HeightPlane): HeightPlane {
  return { slopeX: -plane.slopeZ, slopeZ: plane.slopeX, height: plane.height };
}

function turnFace(face: RoofFace): RoofFace {
  const id = face.id.replace(/(right|front|left|back)$/, (side) => TURNED_SIDES[side] ?? side);
  return { ...face, id, plane: turnPlane(face.plane) };
}

/** Takets rektangel sett uppifrån med den bakre kanten flyttad till `back`. */
function withBackEdge(plan: Polygon, back: Mm): Polygon {
  const bounds = boundsOf(plan);
  return [vec2(bounds.minX, back), vec2(bounds.maxX, back), vec2(bounds.maxX, bounds.maxY), vec2(bounds.minX, bounds.maxY)];
}
