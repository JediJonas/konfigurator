import { multiplyMatrices } from '../../../../core/geometry/matrix';
import type { Mm } from '../../../../core/geometry/vector';
import type { Instance } from '../../../../core/model/design';
import type { Modifier } from '../../../../core/model/modifier';
import type { BuildContext, ObjectType, Socket, SurfaceArea } from '../../../../core/model/objectType';
import type { Part } from '../../../../core/model/part';
import { BUILD_STEP } from '../../buildOrder';
import { ROOF_SURFACE } from '../../socketKinds';
import { roundToStep } from '../openings/wallOpening';
import { buildRoofParts } from '../roof/roofParts';
import { buildWallParts } from '../sectionWalls';
import type { PartDraft } from '../uprightPart';
import type { DormerParams } from './dormerParams';
import { dormerParams, MIN_DORMER_WALL_HEIGHT_MM, MIN_DORMER_WIDTH_MM } from './dormerParams';
import { describeDormer, DORMER_MARGIN_MM, dormerFootprintOnRoof, dormerHoleOnRoof, dormerMountMatrix } from './dormerShape';

export const DORMER_TYPE_ID = 'gb.dormer';

/** Kupans delar heter efter vad de är på kupan, inte efter sektionens väggar. */
const PART_LABEL_KEYS: Record<string, string> = {
  'gable-front': 'part.dormerFront',
  'side-right': 'part.dormerSide',
  'side-left': 'part.dormerSide',
  'roof-right': 'part.dormerRoof',
  'roof-left': 'part.dormerRoof',
  roof: 'part.dormerShedRoof',
};

/** Förslagens storlekar i förhållande till den största, från störst till minst. */
const PROPOSAL_SCALES = [1, 0.85, 0.7, 0.55, 0.45];
/** Den största kupan som föreslås är så bred i förhållande till takfallet, och aldrig bredare än `MAX_PROPOSED_WIDTH_MM`. */
const PROPOSED_WIDTH_SHARE = 0.3;
const MAX_PROPOSED_WIDTH_MM = 80;
const PROPOSED_HEIGHT_PER_WIDTH = 0.5;
/** Framväggen föreslås så långt upp på takfallet, i förhållande till takfallets längd, och minst `DORMER_MARGIN_MM`. */
const PROPOSED_EAVE_DISTANCE_SHARE = 0.15;
/** Fälten som ärvs även när förra kupans storlek inte ryms. */
const ROOF_KEYS = ['roofPitch', 'eaveOverhang', 'gableOverhang'] as const;

/**
 * Takkupa (SPEC.md avsnitt 8): en liten sektion med sadel- eller pulpettak som står på ett
 * takfall. Framväggen och sidorna står upprätt och kapas mot husets takyta,
 * kupans tak läggs ovanpå husets tak i vinkelrännor (`interactions/dormers.ts`)
 * och husets takfall får ett hål innanför kupans väggar.
 */
export const dormerType: ObjectType<DormerParams> = {
  id: DORMER_TYPE_ID,
  labelKey: 'object.dormer',
  params: dormerParams,
  instanceIdPrefix: 'K',
  attachesTo: [ROOF_SURFACE],
  sockets: () => [],
  parts: (instance, params, context) => buildDormerParts(instance, params, context),
  modifiers: (_instance, params, context) => buildDormerHole(params, context),
  mountMatrix: (params, context) => dormerMountMatrix(params, context),
  surfaceAreas: (params, context) => describeDormerSurface(params, context),
  prefersSizeOverCenter: true,
  paramCandidates: (socket, _context, inherited) => listDormerCandidates(socket, inherited),
};

function buildDormerParts(instance: Instance, params: DormerParams, context: BuildContext): Part[] {
  const shape = describeDormer(params, context, true);
  const drafts: PartDraft[] = [...buildWallParts(shape.section, shape.roofContext), ...buildRoofParts(shape.section, shape.roofContext)];
  return drafts.map((draft) => ({
    ...draft,
    id: `${instance.id}/${draft.id}`,
    sourceInstanceId: instance.id,
    labelKey: PART_LABEL_KEYS[draft.id] ?? draft.labelKey,
    transform: multiplyMatrices(shape.sectionToDormer, draft.transform),
    holes: [],
    thickness: context.thickness,
    buildStep: BUILD_STEP.details,
    hasInsideAtZero: true,
  }));
}

function buildDormerHole(params: DormerParams, context: BuildContext): Modifier[] {
  const targetPartId = context.socket?.ownerPartId;
  if (!targetPartId) return [];
  const region = dormerHoleOnRoof(params, describeDormer(params, context, false));
  return region.length > 0 ? [{ kind: 'removeRegion', targetPartId, region }] : [];
}

/** Kupan ska stå på helt tak med en kant runt sig, och två kupor får inte ta samma yta. */
function describeDormerSurface(params: DormerParams, context: BuildContext): SurfaceArea[] {
  const targetPartId = context.socket?.ownerPartId;
  if (!targetPartId) return [];
  const shape = describeDormer(params, context, false);
  return [{ targetPartId, solidRegion: dormerFootprintOnRoof(params, shape, DORMER_MARGIN_MM), coveredRegion: dormerFootprintOnRoof(params, shape, 0) }];
}

/**
 * Förslag från takfallets storlek: en kupa ungefär en tredjedel så bred som
 * takfallet, en bit upp från takfoten. Finns det redan en kupa på huset prövas
 * dess värden först, och de mindre förslagen får samma tak. Regeln om helt tak
 * runt kupan väljer bland dem.
 */
function listDormerCandidates(socket: Socket, inherited: Record<string, unknown>): Record<string, unknown>[] {
  const alongEave = Math.max(...socket.bounds.map((point) => point.x)) - Math.min(...socket.bounds.map((point) => point.x));
  const upSlope = Math.max(...socket.bounds.map((point) => point.y));
  const largest = Math.min(MAX_PROPOSED_WIDTH_MM, alongEave * PROPOSED_WIDTH_SHARE);
  const eaveDistance = Math.max(DORMER_MARGIN_MM, roundToStep(upSlope * PROPOSED_EAVE_DISTANCE_SHARE, 0));
  const scaled = PROPOSAL_SCALES.map((scale) => {
    const width = roundToStep(largest * scale, MIN_DORMER_WIDTH_MM);
    return { eaveDistance, width, wallHeight: proposedWallHeight(width) };
  });
  if (Object.keys(inherited).length === 0) return scaled;
  const roof = Object.fromEntries(ROOF_KEYS.filter((key) => key in inherited).map((key) => [key, inherited[key]]));
  return [{ ...scaled[0], ...inherited }, ...scaled.map((candidate) => ({ ...candidate, ...roof }))];
}

function proposedWallHeight(width: Mm): Mm {
  return roundToStep(width * PROPOSED_HEIGHT_PER_WIDTH, MIN_DORMER_WALL_HEIGHT_MM);
}
