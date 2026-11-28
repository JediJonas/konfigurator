import { transformPoint } from '../../../../core/geometry/matrix';
import { boundsOf } from '../../../../core/geometry/polygon';
import type { Vec3 } from '../../../../core/geometry/vector';
import { subtract3, vec2, vec3 } from '../../../../core/geometry/vector';
import type { Instance } from '../../../../core/model/design';
import type { BuildContext, Socket } from '../../../../core/model/objectType';
import { ROOF_SURFACE } from '../../socketKinds';
import { isExtension, roofContext } from '../sectionGeometry';
import type { SectionParams } from '../sectionParams';
import { ROOF_GROUP_KEY, SLOPED_ROOFS } from '../sectionParams';
import type { WallSide } from '../sectionWalls';
import { listWallSides } from '../sectionWalls';
import type { PartDraft } from '../uprightPart';
import { uprightDirections } from '../uprightPart';
import { wallNumberOf } from '../wallNumbers';
import { buildRoofParts } from './roofParts';

/** Ett takfall räknas som vänt mot en vägg när det lutar ner mer mot den än så (cosinus för vinkeln sett uppifrån). */
const FACING_WALL_MIN_COSINE = 0.5;
/** Början på namnen, efter om takfallet är det nedre eller övre på ett mansardtak. */
const LABEL_BASES: Record<string, string> = {
  'part.roofLower': 'socket.lowerRoofToward',
  'part.roofUpper': 'socket.upperRoofToward',
};

/**
 * En kopplingspunkt per takfall med lutning, för takkupor. Platta tak och
 * tornspiror har inga (SPEC.md avsnitt 5, `excludes`).
 *
 * Punkten ligger på takfallets ovansida. Origo är mitt på takfoten, `u` går
 * vågrätt längs takfoten och u × normal uppför takfallet, så att punktens
 * (u, v) är läge längs taket och avstånd från takfoten mätt längs lutningen.
 * Som för väggarna går u åt vänster sett utifrån, och panelen vänder tecknet.
 * Ytan är takfallet som det ser ut på ritningen, med takutsprången.
 */
export function buildRoofSurfaceSockets(instance: Instance, params: SectionParams, context: BuildContext): Socket[] {
  if (!SLOPED_ROOFS.includes(params.roof)) return [];
  const sides = listWallSides(params, isExtension(context));
  return buildRoofParts(params, roofContext(context, false))
    .filter((draft) => draft.id.startsWith('roof') && draft.id !== 'roof-plate')
    .map((draft) => roofFaceSocket(instance, draft, context.thickness, sides));
}

/**
 * Väggen under takfoten på de takfall som går ner till väggarna, så att en
 * skorsten som flyttas ut förbi takfoten kan stå mot väggen i stället. Ett
 * övre takfall på ett mansardtak har ingen vägg under sig.
 */
function wallBelowPartIds(instance: Instance, draft: PartDraft, facing: WallSide | undefined): string[] | undefined {
  return facing && draft.labelKey !== 'part.roofUpper' ? [`${instance.id}/${facing.id}`] : undefined;
}

function roofFaceSocket(instance: Instance, draft: PartDraft, thickness: number, sides: readonly WallSide[]): Socket {
  const facing = findFacingWall(draft, sides);
  const bounds = boundsOf(draft.outline);
  const middle = (bounds.minX + bounds.maxX) / 2;
  const at = (x: number, y: number, z: number) => transformPoint(draft.transform, vec3(x, y, z));
  const origin = at(middle, bounds.minY, thickness);
  const along = subtract3(at(middle + 1, bounds.minY, thickness), origin);
  const normal = subtract3(at(middle, bounds.minY, thickness + 1), origin);
  return {
    id: draft.id,
    kind: ROOF_SURFACE,
    labelKey: faceLabelKey(draft, facing, sides),
    frame: { origin, u: vec3(-along.x, -along.y, -along.z), normal },
    bounds: draft.outline.map((point) => vec2(middle - point.x, point.y - bounds.minY)),
    ownerPartId: `${instance.id}/${draft.id}`,
    paramGroupKey: ROOF_GROUP_KEY,
    alternativePartIds: wallBelowPartIds(instance, draft, facing),
  };
}

/**
 * "Takfall mot Vägg 2" efter väggen som takfallet lutar ner mot, så att
 * namnen följer väggarnas nummer. Ett takfall som lutar mot värden på en tillbyggnad heter "mot huset".
 */
function faceLabelKey(draft: PartDraft, facing: WallSide | undefined, sides: readonly WallSide[]): string {
  const base = LABEL_BASES[draft.labelKey] ?? 'socket.roofToward';
  return facing ? `${base}${wallNumberOf(facing.id, sides)}` : `${base}Host`;
}

/** Väggen som takfallet lutar ner mot, om det lutar tydligt mot någon. */
export function findFacingWall(draft: PartDraft, sides: readonly WallSide[]): WallSide | undefined {
  const origin = transformPoint(draft.transform, vec3(0, 0, 0));
  const upHill = subtract3(transformPoint(draft.transform, vec3(0, 1, 0)), origin);
  const downhill = normalizePlan(vec3(-upHill.x, 0, -upHill.z));
  const facing = sides
    .map((side) => ({ side, cosine: downhillCosine(side, downhill) }))
    .reduce<{ side?: WallSide; cosine: number }>((best, entry) => (entry.cosine > best.cosine ? entry : best), { cosine: FACING_WALL_MIN_COSINE });
  return facing.side;
}

function downhillCosine(side: WallSide, downhill: Vec3): number {
  const { outward } = uprightDirections(side);
  return outward.x * downhill.x + outward.z * downhill.z;
}

function normalizePlan(vector: Vec3): Vec3 {
  const length = Math.hypot(vector.x, vector.z);
  return length > 0 ? vec3(vector.x / length, 0, vector.z / length) : vector;
}
