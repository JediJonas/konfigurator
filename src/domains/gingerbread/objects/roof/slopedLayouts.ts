import type { HeightPlane } from '../../../../core/geometry/heightPlanes';
import type { Mm } from '../../../../core/geometry/vector';
import { degreesToRadians, vec2 } from '../../../../core/geometry/vector';
import type { SectionParams } from '../sectionParams';
import type { RoofContext, RoofFace, RoofLayout } from './roofLayout';
import { extensionBackEdge } from './roofLayout';
import type { EaveFit } from './eaveFit';
import { fitEave } from './eaveFit';

/**
 * Mansardtakets nedre takfall får ta högst så stor del av halva bredden, så
 * att det övre takfallet alltid finns kvar. En högre brytpunkt sänks till gränsen.
 */
const MANSARD_MAX_LOWER_SHARE = 0.8;

/** Plan som lutar ner mot +x (höger) och går genom väggens överkant vid x = `edgeX`. */
function planeFallingRight(edgeX: Mm, heightAtEdge: Mm, pitchDegrees: number): HeightPlane {
  const slope = Math.tan(degreesToRadians(pitchDegrees));
  return { slopeX: -slope, slopeZ: 0, height: heightAtEdge + edgeX * slope };
}

function mirrorX(plane: HeightPlane): HeightPlane {
  return { ...plane, slopeX: -plane.slopeX };
}

/** Plan som lutar ner mot +z (fram) och går genom väggens överkant vid z = `edgeZ`. */
function planeFallingFront(edgeZ: Mm, heightAtEdge: Mm, pitchDegrees: number): HeightPlane {
  const slope = Math.tan(degreesToRadians(pitchDegrees));
  return { slopeX: 0, slopeZ: -slope, height: heightAtEdge + edgeZ * slope };
}

function mirrorZ(plane: HeightPlane): HeightPlane {
  return { ...plane, slopeZ: -plane.slopeZ };
}

/** Rektangel sett uppifrån, med punkternas y som z. */
function planRectangle(halfX: Mm, back: Mm, front: Mm) {
  return [vec2(-halfX, back), vec2(halfX, back), vec2(halfX, front), vec2(-halfX, front)];
}

/** Hur takfallet med lutningen `pitchDegrees` möter väggen vid takfoten. */
function fitEaveAt(params: SectionParams, context: RoofContext, pitchDegrees: number): EaveFit {
  return fitEave(params.eaveOverhang, Math.tan(degreesToRadians(pitchDegrees)), context.thickness);
}

/** Hur långt ut den höga änden av ett takfall når: där är undersidans kant ytterst. */
function highEndReach(overhang: Mm, pitchDegrees: number): Mm {
  return overhang * Math.cos(degreesToRadians(pitchDegrees));
}

function backEdge(params: SectionParams, context: RoofContext, overhang: Mm): Mm {
  return context.isExtension ? extensionBackEdge(params, context) : -params.depth / 2 - overhang;
}

/** Sadeltak: två takhalvor som möts i nocken, gavlarna under. */
export function buildGableLayout(params: SectionParams, context: RoofContext): RoofLayout {
  const eave = fitEaveAt(params, context, params.roofPitch);
  const right = planeFallingRight(params.width / 2 - eave.inset, params.wallHeight, params.roofPitch);
  const faces: RoofFace[] = [
    { id: 'roof-right', labelKey: 'part.roof', plane: right },
    { id: 'roof-left', labelKey: 'part.roof', plane: mirrorX(right) },
  ];
  const halfX = params.width / 2 + eave.reach;
  const plan = planRectangle(halfX, backEdge(params, context, params.gableOverhang), params.depth / 2 + params.gableOverhang);
  return { faces, plan, support: faces.map((face) => face.plane) };
}

/**
 * Pulpettak: ett takfall som lutar längs huset, högst bak. Som tillbyggnad
 * blir det ett skjul med den höga sidan mot värden. Takutsprånget vid
 * takfoten gäller fram och bak, och vid gaveln gäller det på sidorna.
 */
export function buildShedLayout(params: SectionParams, context: RoofContext): RoofLayout {
  const eave = fitEaveAt(params, context, params.roofPitch);
  const plane = planeFallingFront(params.depth / 2 - eave.inset, params.wallHeight, params.roofPitch);
  const back = backEdge(params, context, highEndReach(params.eaveOverhang, params.roofPitch));
  const plan = planRectangle(params.width / 2 + params.gableOverhang, back, params.depth / 2 + eave.reach);
  return { faces: [{ id: 'roof', labelKey: 'part.roofSlope', plane }], plan, support: [plane] };
}

/**
 * Valmat tak: fyra takfall med samma lutning. Takfallen mot gavlarna kallas
 * valmfall. En tillbyggnad har inget valmfall mot värden.
 */
export function buildHipLayout(params: SectionParams, context: RoofContext): RoofLayout {
  const eave = fitEaveAt(params, context, params.roofPitch);
  const right = planeFallingRight(params.width / 2 - eave.inset, params.wallHeight, params.roofPitch);
  const front = planeFallingFront(params.depth / 2 - eave.inset, params.wallHeight, params.roofPitch);
  const faces: RoofFace[] = [
    { id: 'roof-right', labelKey: 'part.roofSlope', plane: right },
    { id: 'roof-left', labelKey: 'part.roofSlope', plane: mirrorX(right) },
    { id: 'roof-front', labelKey: 'part.roofHip', plane: front },
  ];
  if (!context.isExtension) faces.push({ id: 'roof-back', labelKey: 'part.roofHip', plane: mirrorZ(front) });
  const plan = planRectangle(params.width / 2 + eave.reach, backEdge(params, context, eave.reach), params.depth / 2 + eave.reach);
  return { faces, plan, support: faces.map((face) => face.plane) };
}

/**
 * Mansardtak med gavlar (brutet sadeltak): ett brant nedre takfall upp till
 * brytpunkten och ett flackare övre takfall till nocken på var sida.
 */
export function buildMansardLayout(params: SectionParams, context: RoofContext): RoofLayout {
  const eave = fitEaveAt(params, context, params.mansardLowerPitch);
  // Brytpunkten räknas från där det nedre takfallets undersida möter väggens höjd.
  const halfWidth = params.width / 2 - eave.inset;
  const lowerSlope = Math.tan(degreesToRadians(params.mansardLowerPitch));
  const breakHeight = Math.min(params.mansardBreakHeight, MANSARD_MAX_LOWER_SHARE * halfWidth * lowerSlope);
  const breakX = halfWidth - breakHeight / lowerSlope;
  const lower = planeFallingRight(halfWidth, params.wallHeight, params.mansardLowerPitch);
  const upper = planeFallingRight(breakX, params.wallHeight + breakHeight, params.roofPitch);
  const faces: RoofFace[] = [
    { id: 'roof-lower-right', labelKey: 'part.roofLower', plane: lower },
    { id: 'roof-lower-left', labelKey: 'part.roofLower', plane: mirrorX(lower) },
    { id: 'roof-upper-right', labelKey: 'part.roofUpper', plane: upper },
    { id: 'roof-upper-left', labelKey: 'part.roofUpper', plane: mirrorX(upper) },
  ];
  const halfX = params.width / 2 + eave.reach;
  const plan = planRectangle(halfX, backEdge(params, context, params.gableOverhang), params.depth / 2 + params.gableOverhang);
  return { faces, plan, support: faces.map((face) => face.plane) };
}
