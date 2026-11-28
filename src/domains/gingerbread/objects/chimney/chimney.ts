import type { Mm } from '../../../../core/geometry/vector';
import type { Instance } from '../../../../core/model/design';
import type { BuildContext, ObjectType, Socket, SurfaceArea } from '../../../../core/model/objectType';
import type { Part } from '../../../../core/model/part';
import { BUILD_STEP } from '../../buildOrder';
import { ROOF_SURFACE, WALL_SURFACE } from '../../socketKinds';
import { measureHostPitch, pitchOfNormal, uprightOnRoofMatrix } from '../roofMount';
import type { ChimneyParams } from './chimneyParams';
import { chimneyParams } from './chimneyParams';
import { buildWallChimneyDrafts, describeWallChimneySurface, wallChimneyBase, wallChimneyMountMatrix, wallChimneyTop } from './chimneyOnWall';
import { buildChimneyDrafts, CHIMNEY_MARGIN_MM, chimneyFootprintOnRoof } from './chimneyShape';

export const CHIMNEY_TYPE_ID = 'gb.chimney';

/** Förslagens bredd och djup, från störst till minst. */
const PROPOSED_SIZES_MM = [25, 20, 15];
const PROPOSED_HEIGHT_MM = 30;
/** Förslagen står med baksidan så långt nedanför nocken, utöver kanten av helt tak; prövas i tur och ordning. */
const PROPOSED_RIDGE_GAPS_MM = [10, 30, 60];
const EAVE_DISTANCE_STEP_MM = 5;

/**
 * Skorsten (SPEC.md avsnitt 8): fyra upprätta sidor som står på ett takfall,
 * med nederkanten snedskuren mot takplanet. Den tar inget hål i taket.
 *
 * Den kan också stå på fatet mot en vägg och gå upp förbi takutsprånget
 * (`chimneyOnWall.ts`), t.ex. när avståndet från takfoten sätts till 0 och
 * den flyttas ut förbi takfoten till väggen under (ägarens val). Takfallet
 * prövas först (`attachesTo`), så den flyttar upp på taket igen när avståndet ökas.
 */
export const chimneyType: ObjectType<ChimneyParams> = {
  id: CHIMNEY_TYPE_ID,
  labelKey: 'object.chimney',
  params: chimneyParams,
  instanceIdPrefix: 'SK',
  attachesTo: [ROOF_SURFACE, WALL_SURFACE],
  sockets: () => [],
  parts: (instance, params, context) => buildChimneyParts(instance, params, context),
  socketOutline: (params, context) => (isOnWall(context) ? wallChimneyBase(params) : []),
  mountMatrix: (params, context) => (isOnWall(context) ? wallChimneyMountMatrix() : uprightOnRoofMatrix(params.eaveDistance, context)),
  surfaceAreas: (params, context) => describeChimneySurface(params, context),
  prefersSizeOverCenter: true,
  paramCandidates: (socket, _context, inherited) => listChimneyCandidates(socket, inherited),
};

/** Sant när skorstenen står på fatet mot en vägg i stället för på ett takfall. */
export function isOnWall(context: BuildContext): boolean {
  return context.socket?.kind === WALL_SURFACE;
}

function buildChimneyParts(instance: Instance, params: ChimneyParams, context: BuildContext): Part[] {
  const drafts = isOnWall(context)
    ? buildWallChimneyDrafts(params, context.thickness, wallChimneyTop(params, context))
    : buildChimneyDrafts(params, context.thickness, measureHostPitch(context));
  return drafts.map((draft) => ({
    ...draft,
    id: `${instance.id}/${draft.id}`,
    sourceInstanceId: instance.id,
    holes: [],
    thickness: context.thickness,
    buildStep: BUILD_STEP.details,
  }));
}

/** Skorstenen ska stå på helt tak med en kant runt sig, och den får inte ta samma yta som en kupa eller en annan skorsten. */
function describeChimneySurface(params: ChimneyParams, context: BuildContext): SurfaceArea[] {
  const targetPartId = context.socket?.ownerPartId;
  if (!targetPartId) return [];
  if (isOnWall(context)) return describeWallChimneySurface(params, context, wallChimneyTop(params, context));
  const pitch = measureHostPitch(context);
  return [{ targetPartId, solidRegion: chimneyFootprintOnRoof(params, pitch, CHIMNEY_MARGIN_MM), coveredRegion: chimneyFootprintOnRoof(params, pitch, 0) }];
}

/**
 * Förslag högt upp på takfallet, med baksidan strax nedanför nocken som på
 * de flesta hus. Finns det redan en skorsten på huset prövas dess mått först.
 * Regeln om helt tak runt skorstenen väljer bland dem.
 */
function listChimneyCandidates(socket: Socket, inherited: Record<string, unknown>): Record<string, unknown>[] {
  if (socket.kind === WALL_SURFACE) return listWallCandidates(inherited);
  const upSlope = Math.max(...socket.bounds.map((point) => point.y));
  const pitch = pitchOfNormal(socket.frame.normal);
  const candidates = PROPOSED_RIDGE_GAPS_MM.flatMap((gap) =>
    PROPOSED_SIZES_MM.map((size) => ({
      eaveDistance: eaveDistanceBelowRidge(upSlope, size / Math.cos(pitch) + CHIMNEY_MARGIN_MM + gap),
      width: size,
      depth: size,
      height: PROPOSED_HEIGHT_MM,
    })),
  );
  return Object.keys(inherited).length === 0 ? candidates : [{ ...candidates[0], ...inherited }, ...candidates];
}

function eaveDistanceBelowRidge(upSlope: Mm, belowRidge: Mm): Mm {
  return Math.max(CHIMNEY_MARGIN_MM, Math.floor((upSlope - belowRidge) / EAVE_DISTANCE_STEP_MM) * EAVE_DISTANCE_STEP_MM);
}

/** Mot en vägg är avståndet från takfoten alltid 0; storlekarna är desamma som på taket. */
function listWallCandidates(inherited: Record<string, unknown>): Record<string, unknown>[] {
  const candidates = PROPOSED_SIZES_MM.map((size) => ({ eaveDistance: 0, width: size, depth: size, height: PROPOSED_HEIGHT_MM }));
  return Object.keys(inherited).length === 0 ? candidates : [{ ...candidates[0], ...inherited, eaveDistance: 0 }, ...candidates];
}
