import type { HeightPlane } from '../../../../core/geometry/heightPlanes';
import { heightPlaneThrough } from '../../../../core/geometry/heightPlanes';
import type { Mm, Vec2 } from '../../../../core/geometry/vector';
import { degreesToRadians, vec2, vec3 } from '../../../../core/geometry/vector';
import type { SectionParams } from '../sectionParams';
import type { RoofContext, RoofFace, RoofLayout } from './roofLayout';
import { extensionBackEdge } from './roofLayout';

/**
 * Åttkantens avfasning i hörnen som andel av den kortaste sidan. Med
 * 1 / (2 + √2) blir åttkanten regelbunden på en kvadratisk sektion.
 */
const OCTAGON_CORNER_SHARE = 1 / (2 + Math.SQRT2);

/** En plan skiva rakt ovanpå väggarna, med takutsprånget runt om. */
function plateOver(params: SectionParams, context: RoofContext): Vec2[] {
  const halfX = params.width / 2 + params.eaveOverhang;
  const front = params.depth / 2 + params.eaveOverhang;
  const back = context.isExtension ? extensionBackEdge(params, context) : -front;
  return [vec2(-halfX, back), vec2(halfX, back), vec2(halfX, front), vec2(-halfX, front)];
}

function levelPlane(height: Mm): HeightPlane {
  return { slopeX: 0, slopeZ: 0, height };
}

/** Platt tak: en takskiva på väggarna och en kant runt om som står på skivan. */
export function buildFlatLayout(params: SectionParams, context: RoofContext): RoofLayout {
  const plate = plateOver(params, context);
  return { faces: [], plan: plate, support: [levelPlane(params.wallHeight)], plate, rim: { height: params.rimHeight } };
}

/**
 * Fyrsidig tornspira: fyra trekanter som möts i en spets mitt över huset och
 * vilar direkt på väggarna. Lutningen gäller takfallen mot långväggarna;
 * takfallen mot gavlarna lutar så att alla möts i spetsen.
 */
export function buildSpire4Layout(params: SectionParams, context: RoofContext): RoofLayout {
  const halfX = params.width / 2;
  const halfZ = params.depth / 2;
  const pitch = degreesToRadians(params.spirePitch);
  const apexHeight = params.wallHeight + halfX * Math.tan(pitch);
  const slopeX = Math.tan(pitch);
  const slopeZ = (apexHeight - params.wallHeight) / halfZ;
  const right: HeightPlane = { slopeX: -slopeX, slopeZ: 0, height: apexHeight };
  const front: HeightPlane = { slopeX: 0, slopeZ: -slopeZ, height: apexHeight };
  const faces: RoofFace[] = [
    { id: 'roof-right', labelKey: 'part.spireFace', plane: right },
    { id: 'roof-left', labelKey: 'part.spireFace', plane: { ...right, slopeX } },
    { id: 'roof-front', labelKey: 'part.spireFace', plane: front },
  ];
  if (!context.isExtension) faces.push({ id: 'roof-back', labelKey: 'part.spireFace', plane: { ...front, slopeZ } });
  // Takfoten ligger lika högt runt om: utsprånget mäts längs takfallen mot långväggarna.
  const drop = params.eaveOverhang * Math.sin(pitch);
  const reachX = params.eaveOverhang * Math.cos(pitch);
  const reachZ = drop / slopeZ;
  const back = context.isExtension ? extensionBackEdge(params, context) : -(halfZ + reachZ);
  const plan = [vec2(-(halfX + reachX), back), vec2(halfX + reachX, back), vec2(halfX + reachX, halfZ + reachZ), vec2(-(halfX + reachX), halfZ + reachZ)];
  return { faces, plan, support: faces.map((face) => face.plane) };
}

/**
 * Åttasidig tornspira: en takskiva på väggarna som täcker hörnen, och åtta
 * trekanter som står på skivan och möts i en spets. Åttkanten ryms precis
 * inom väggarnas ytterkant och har avfasade hörn.
 */
export function buildSpire8Layout(params: SectionParams, context: RoofContext): RoofLayout {
  const plate = plateOver(params, context);
  const base = params.wallHeight + context.thickness;
  const octagon = buildOctagon(params.width / 2, params.depth / 2, Math.min(params.width, params.depth) * OCTAGON_CORNER_SHARE);
  const apex = vec3(0, base + (params.width / 2) * Math.tan(degreesToRadians(params.spirePitch)), 0);
  const faces: RoofFace[] = octagon.map((start, index) => {
    const end = octagon[(index + 1) % octagon.length] ?? start;
    return { id: `spire-${index + 1}`, labelKey: 'part.spireFace', plane: heightPlaneThrough(vec3(start.x, base, start.y), vec3(end.x, base, end.y), apex) };
  });
  return { faces, plan: octagon, support: [levelPlane(params.wallHeight)], plate };
}

/** Åttkant moturs sett uppifrån (y är z), med raka sidor mot väggarna och hörnen avfasade med `corner`. */
function buildOctagon(halfX: Mm, halfZ: Mm, corner: Mm): Vec2[] {
  return [
    vec2(halfX, -(halfZ - corner)),
    vec2(halfX, halfZ - corner),
    vec2(halfX - corner, halfZ),
    vec2(-(halfX - corner), halfZ),
    vec2(-halfX, halfZ - corner),
    vec2(-halfX, -(halfZ - corner)),
    vec2(-(halfX - corner), -halfZ),
    vec2(halfX - corner, -halfZ),
  ];
}
