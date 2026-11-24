import type { Instance } from '../../../core/model/design';
import type { BuildContext, ObjectType } from '../../../core/model/objectType';
import type { Part } from '../../../core/model/part';
import { GROUND, WALL_SURFACE } from '../socketKinds';
import { listExtensionCandidates } from './extensionProposal';
import { buildRoofParts } from './roof/roofParts';
import { roofContext } from './sectionGeometry';
import type { SectionParams } from './sectionParams';
import { sectionParams } from './sectionParams';
import {
  buildOpening,
  buildSectionSockets,
  extensionMountMatrix,
  sectionFootprint,
  sectionSocketOutline,
  sectionSocketTopOutline,
} from './sectionSockets';
import { buildWallParts } from './sectionWalls';
import type { PartDraft } from './uprightPart';

export const SECTION_TYPE_ID = 'gb.section';

/**
 * Sektion: fyra väggar och ett tak av vald taktyp. Koordinater: origo mitt på
 * golvytan, x tvärs över (gavelbredd), y uppåt och z längs huset. Gavlarna
 * står vid z = ±djup/2.
 *
 * Taket byggs av plana takytor som vilar på väggarnas yttre överkant (se
 * `roof/`). Väggarnas överkant följer takets undersida, och hörnen följer
 * hörnregeln i `joints.ts`: väggar med sned överkant går hela vägen ut.
 *
 * Som tillbyggnad står sektionen med bakre änden mot en vägg på en annan
 * sektion. Den har då ingen bakre gavel, tar upp en öppning i värdens vägg,
 * och taket förlängs in över värden så att vinkelrännan kan klippa det
 * (`interactions/valleys.ts`).
 */
export const sectionType: ObjectType<SectionParams> = {
  id: SECTION_TYPE_ID,
  labelKey: 'object.section',
  params: sectionParams,
  instanceIdPrefix: 'S',
  attachesTo: [GROUND, WALL_SURFACE],
  sockets: (instance, params, context) => buildSectionSockets(instance, params, context),
  parts: (instance, params, context) =>
    [...buildWallParts(params, roofContext(context, true)), ...buildRoofParts(params, roofContext(context, true))].map((draft) => sectionPart(instance, context, draft)),
  modifiers: (_instance, params, context) => buildOpening(params, context),
  mountMatrix: (params, context) => extensionMountMatrix(params, context),
  footprint: (params, context) => sectionFootprint(params, context),
  socketOutline: (params, context) => sectionSocketOutline(params, context),
  socketTopOutline: (params, context) => sectionSocketTopOutline(params, context),
  paramCandidates: (socket, context, inherited) => listExtensionCandidates(socket, context, inherited),
};

/** Gemensamma fält för alla delar i en sektion. */
function sectionPart(instance: Instance, context: BuildContext, draft: PartDraft): Part {
  return { ...draft, id: `${instance.id}/${draft.id}`, sourceInstanceId: instance.id, holes: [], thickness: context.thickness };
}
