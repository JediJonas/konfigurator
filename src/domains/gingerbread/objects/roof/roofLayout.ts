import type { HeightPlane } from '../../../../core/geometry/heightPlanes';
import type { Polygon } from '../../../../core/geometry/polygon';
import type { Mm } from '../../../../core/geometry/vector';
import type { SectionParams } from '../sectionParams';
import { buildFlatLayout, buildSpire4Layout, buildSpire8Layout } from './spireLayouts';
import { buildGableLayout, buildHipLayout, buildMansardLayout, buildShedLayout } from './slopedLayouts';

/**
 * Hur långt bakåt en tillbyggnads tak förlängs in över värden innan
 * vinkelrännan klipper det. Större än den största sektionen med takutsprång
 * (400 + 2 × 40 mm), så att taket alltid når förbi rännan.
 */
export const VALLEY_REACH_MM = 500;

/** En takyta: ett plan som blir en del där det är det lägsta av takets plan. */
export interface RoofFace {
  /** Delens id inom sektionen, t.ex. "roof-right". */
  id: string;
  labelKey: string;
  plane: HeightPlane;
}

/** En låg kant som står på takskivans ytterkant, t.ex. runt ett platt tak. */
export interface RimLayout {
  height: Mm;
}

/**
 * Takets form i sektionens koordinater (x tvärs över, y uppåt, z längs huset;
 * sett uppifrån är planets y lika med z). Allt räknas från undersidan.
 */
export interface RoofLayout {
  faces: RoofFace[];
  /** Takytornas yttre kant sett uppifrån, med takutsprång. */
  plan: Polygon;
  /** Planen som väggarna bär. Väggarnas överkant följer det lägsta av dem. */
  support: HeightPlane[];
  /** En plan takskiva på väggarnas överkant, sett uppifrån, för platt tak och 8-sidig spira. */
  plate?: Polygon;
  rim?: RimLayout;
}

export interface RoofContext {
  thickness: Mm;
  /** Tillbyggnader har ingen bakre takyta och inget takutsprång bakåt. */
  isExtension: boolean;
  /** Förläng tillbyggnadens tak bakåt in över värden, så att vinkelrännan kan klippa det. */
  reachesIntoHost: boolean;
}

/** Takets bakre kant för en tillbyggnad: mot värdens vägg, eller förlängt in över värden. */
export function extensionBackEdge(params: SectionParams, context: RoofContext): Mm {
  return -params.depth / 2 - (context.reachesIntoHost ? VALLEY_REACH_MM : 0);
}

export function buildRoofLayout(params: SectionParams, context: RoofContext): RoofLayout {
  switch (params.roof) {
    case 'gable':
      return buildGableLayout(params, context);
    case 'shed':
      return buildShedLayout(params, context);
    case 'hip':
      return buildHipLayout(params, context);
    case 'mansard':
      return buildMansardLayout(params, context);
    case 'flat':
      return buildFlatLayout(params, context);
    case 'spire4':
      return buildSpire4Layout(params, context);
    case 'spire8':
      return buildSpire8Layout(params, context);
  }
}
