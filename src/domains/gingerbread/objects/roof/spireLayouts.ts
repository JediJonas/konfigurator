import type { HeightPlane } from '../../../../core/geometry/heightPlanes';
import { heightPlaneThrough } from '../../../../core/geometry/heightPlanes';
import type { Mm, Vec2 } from '../../../../core/geometry/vector';
import { degreesToRadians, vec2, vec3 } from '../../../../core/geometry/vector';
import type { SectionParams } from '../sectionParams';
import type { RoofContext, RoofFace, RoofLayout } from './roofLayout';
import { extensionBackEdge } from './roofLayout';
import { fitEave, measureTopLip } from './eaveFit';

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
  const pitch = degreesToRadians(params.spirePitch);
  const slopeX = Math.tan(pitch);
  const eaveX = fitEave(params.eaveOverhang, slopeX, context.thickness);
  // Takfallen mot gavlarna lutar annorlunda; deras utsprång ger samma fall i höjd som långsidornas.
  const outerSlopeZ = ((params.width / 2) * slopeX) / (params.depth / 2);
  const overhangZ = (params.eaveOverhang * Math.sin(pitch)) / Math.sin(Math.atan(outerSlopeZ));
  const eaveZ = fitEave(overhangZ, outerSlopeZ, context.thickness);
  const halfX = params.width / 2 - eaveX.inset;
  const halfZ = params.depth / 2 - eaveZ.inset;
  const planes = spire4Planes(halfX, halfZ, slopeX, params.wallHeight);
  const faces: RoofFace[] = [
    { id: 'roof-right', labelKey: 'part.spireFace', plane: planes.right },
    { id: 'roof-left', labelKey: 'part.spireFace', plane: planes.left },
    { id: 'roof-front', labelKey: 'part.spireFace', plane: planes.front },
  ];
  if (!context.isExtension) faces.push({ id: 'roof-back', labelKey: 'part.spireFace', plane: planes.back });
  // Takfoten ligger exakt lika högt runt om, så att takfallen förblir trekanter.
  const reachX = eaveX.reach;
  const eaveDrop = Math.max(0, params.width / 2 + reachX - halfX) * slopeX;
  const reachZ = halfZ + eaveDrop / planes.slopeZ - params.depth / 2;
  const back = context.isExtension ? extensionBackEdge(params, context) : -(params.depth / 2 + reachZ);
  const outerX = params.width / 2 + reachX;
  const outerZ = params.depth / 2 + reachZ;
  const plan = [vec2(-outerX, back), vec2(outerX, back), vec2(outerX, outerZ), vec2(-outerX, outerZ)];
  return { faces, plan, support: faces.map((face) => face.plane) };
}

/** Fyra plan som går genom `baseHeight` vid ±halfX och ±halfZ och möts i en spets mitt över. */
function spire4Planes(halfX: Mm, halfZ: Mm, slopeX: number, baseHeight: Mm) {
  const apexHeight = baseHeight + halfX * slopeX;
  const slopeZ = (halfX * slopeX) / halfZ;
  return {
    slopeZ,
    right: { slopeX: -slopeX, slopeZ: 0, height: apexHeight } satisfies HeightPlane,
    left: { slopeX, slopeZ: 0, height: apexHeight } satisfies HeightPlane,
    front: { slopeX: 0, slopeZ: -slopeZ, height: apexHeight } satisfies HeightPlane,
    back: { slopeX: 0, slopeZ, height: apexHeight } satisfies HeightPlane,
  };
}

/**
 * Åttasidig tornspira: en takskiva på väggarna som täcker hörnen, och åtta
 * trekanter som står på skivan och möts i en spets. Åttkanten ryms precis
 * inom väggarnas ytterkant och har avfasade hörn.
 */
export function buildSpire8Layout(params: SectionParams, context: RoofContext): RoofLayout {
  const plate = plateOver(params, context);
  const base = params.wallHeight + context.thickness;
  // Spirfallen står innanför skivans kant så att deras ovansida går jäms med den.
  const slopeX = Math.tan(degreesToRadians(params.spirePitch));
  const halfX = params.width / 2 - measureTopLip(slopeX, context.thickness);
  const apexHeight = halfX * slopeX;
  const halfZ = params.depth / 2 - measureTopLip(((params.width / 2) * slopeX) / (params.depth / 2), context.thickness);
  const octagon = buildOctagon(halfX, halfZ, 2 * Math.min(halfX, halfZ) * OCTAGON_CORNER_SHARE);
  const apex = vec3(0, base + apexHeight, 0);
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
