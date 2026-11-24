import { describe, expect, it } from 'vitest';
import { signedArea } from '../../src/core/geometry/polygon';
import { degreesToRadians } from '../../src/core/geometry/vector';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { evaluateDesign } from '../../src/core/rules/evaluateDesign';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { ROOF_TYPES } from '../../src/domains/gingerbread/objects/sectionParams';
import { allCorners, countSharedEdges, houseWith, isRoofPart, partById, THICKNESS, worldCorners } from './roofFixtures';

const BASE = { width: 140, depth: 180, wallHeight: 100, roofPitch: 45, eaveOverhang: 10, gableOverhang: 10 };

function partsFor(params: Record<string, unknown>) {
  return buildParts(houseWith({ ...BASE, ...params }), gingerbreadDomain);
}

function topOf(parts: ReturnType<typeof partsFor>, id: string): number {
  return Math.max(...worldCorners(partById(parts, id)).map((corner) => corner.y));
}

function lengthAlongZ(parts: ReturnType<typeof partsFor>, id: string): number {
  const zs = allCorners(partById(parts, id)).map((corner) => corner.z);
  return Math.max(...zs) - Math.min(...zs);
}

function lengthAlongX(parts: ReturnType<typeof partsFor>, id: string): number {
  const xs = allCorners(partById(parts, id)).map((corner) => corner.x);
  return Math.max(...xs) - Math.min(...xs);
}

describe('alla taktyper', () => {
  it.each(ROOF_TYPES)('%s går att bygga och har delar med konturen moturs', (roof) => {
    const design = houseWith({ ...BASE, roof });
    const { parts, violations } = evaluateDesign(design, gingerbreadDomain, (key) => key);
    expect(violations).toEqual([]);
    expect(parts.length).toBeGreaterThanOrEqual(5);
    for (const part of parts) expect(signedArea(part.outline)).toBeGreaterThan(0);
  });

  it.each(ROOF_TYPES)('%s har inga väggar som går upp genom taket', (roof) => {
    const parts = partsFor({ roof });
    const roofTop = Math.max(...parts.filter(isRoofPart).flatMap(allCorners).map((corner) => corner.y));
    const walls = parts.filter((part) => !isRoofPart(part) && !part.id.includes('/rim-'));
    for (const wall of walls) expect(Math.max(...allCorners(wall).map((corner) => corner.y))).toBeLessThan(roofTop);
  });
});

describe('pulpettak', () => {
  const parts = partsFor({ roof: 'shed', roofPitch: 20 });
  const rise = BASE.depth * Math.tan(degreesToRadians(20));

  it('lutar längs huset och är högst bak', () => {
    expect(topOf(parts, 'S1/gable-front')).toBeCloseTo(BASE.wallHeight);
    // Bakgaveln har rak överkant där taket är lägst, vid innerkanten.
    expect(topOf(parts, 'S1/gable-back')).toBeCloseTo(BASE.wallHeight + rise - THICKNESS * Math.tan(degreesToRadians(20)));
  });

  it('låter sidorna med sned överkant gå ut och gavlarna stå mellan (hörnregeln)', () => {
    expect(lengthAlongZ(parts, 'S1/side-right')).toBeCloseTo(BASE.depth);
    expect(lengthAlongX(parts, 'S1/gable-front')).toBeCloseTo(BASE.width - 2 * THICKNESS);
  });
});

describe('valmat tak', () => {
  const parts = partsFor({ roof: 'hip' });

  it('har två takfall och två valmfall som möts i valmar och nock', () => {
    const roof = parts.filter(isRoofPart);
    expect(roof.map((part) => part.id).sort()).toEqual(['S1/roof-back', 'S1/roof-front', 'S1/roof-left', 'S1/roof-right']);
    // Fyra valmar och en nock, sedda från båda takytorna med samma längd.
    expect(countSharedEdges(roof)).toBe(5);
  });

  it('låter de längsta väggarna gå ut när alla överkanter är raka', () => {
    expect(lengthAlongZ(parts, 'S1/side-right')).toBeCloseTo(BASE.depth);
    expect(lengthAlongX(parts, 'S1/gable-front')).toBeCloseTo(BASE.width - 2 * THICKNESS);
  });
});

describe('mansardtak', () => {
  it('bryts vid brytpunkten och har gavlar som går ut', () => {
    const parts = partsFor({ roof: 'mansard', mansardLowerPitch: 70, mansardBreakHeight: 40, roofPitch: 30 });
    expect(topOf(parts, 'S1/roof-lower-right')).toBeCloseTo(BASE.wallHeight + 40);
    expect(countSharedEdges(parts.filter(isRoofPart))).toBe(3);
    expect(lengthAlongX(parts, 'S1/gable-front')).toBeCloseTo(BASE.width);
    // Gaveln följer båda lutningarna: fem hörn upptill och två nertill.
    expect(partById(parts, 'S1/gable-front').outline).toHaveLength(7);
  });

  it('sänker en för hög brytpunkt så att det övre takfallet finns kvar', () => {
    const parts = partsFor({ roof: 'mansard', mansardLowerPitch: 50, mansardBreakHeight: 150 });
    expect(parts.some((part) => part.id === 'S1/roof-upper-right')).toBe(true);
  });
});

describe('platt tak med kant', () => {
  const parts = partsFor({ roof: 'flat', rimHeight: 15 });

  it('lägger takskivan på väggarna och kanten på takskivan', () => {
    const plate = worldCorners(partById(parts, 'S1/roof-plate'));
    for (const corner of plate) expect(corner.y).toBeCloseTo(BASE.wallHeight);
    const rims = parts.filter((part) => part.id.includes('/rim-'));
    expect(rims).toHaveLength(4);
    for (const rim of rims) {
      const ys = allCorners(rim).map((corner) => corner.y);
      expect(Math.min(...ys)).toBeCloseTo(BASE.wallHeight + THICKNESS);
      expect(Math.max(...ys)).toBeCloseTo(BASE.wallHeight + THICKNESS + 15);
    }
  });

  it('låter de längsta kanterna gå ut', () => {
    expect(lengthAlongZ(parts, 'S1/rim-right')).toBeCloseTo(BASE.depth + 2 * BASE.eaveOverhang);
    expect(lengthAlongX(parts, 'S1/rim-front')).toBeCloseTo(BASE.width + 2 * BASE.eaveOverhang - 2 * THICKNESS);
  });
});

describe('tornspira', () => {
  it('har fyra trekanter som möts i en spets', () => {
    const parts = partsFor({ roof: 'spire4', spirePitch: 70 });
    const roof = parts.filter(isRoofPart);
    expect(roof).toHaveLength(4);
    // Spirfallen står in så mycket som deras ovansida sticker ut förbi undersidan.
    const lip = THICKNESS * Math.sin(degreesToRadians(70));
    const apex = BASE.wallHeight + (BASE.width / 2 - lip) * Math.tan(degreesToRadians(70));
    for (const part of roof) {
      expect(part.outline).toHaveLength(3);
      expect(Math.max(...worldCorners(part).map((corner) => corner.y))).toBeCloseTo(apex);
    }
    expect(countSharedEdges(roof)).toBe(4);
  });

  it('har åtta lika trekanter på en takskiva när sektionen är kvadratisk', () => {
    const parts = partsFor({ roof: 'spire8', width: 120, depth: 120 });
    const faces = parts.filter((part) => part.id.includes('/spire-'));
    expect(faces).toHaveLength(8);
    expect(countSharedEdges(faces)).toBe(8);
    // Regelbunden åttkant: alla trekanter är lika och står på takskivan.
    const areas = faces.map((face) => signedArea(face.outline));
    for (const area of areas) expect(area).toBeCloseTo(areas[0] ?? 0, 3);
    for (const face of faces) expect(Math.min(...worldCorners(face).map((corner) => corner.y))).toBeCloseTo(BASE.wallHeight + THICKNESS);
  });

  it.each(['spire4', 'spire8'])('%s sticker inte ut förbi väggarna när takutsprånget är 0 mm', (roof) => {
    const parts = partsFor({ roof, eaveOverhang: 0, spirePitch: 70 });
    const corners = parts.filter(isRoofPart).flatMap(allCorners);
    expect(Math.max(...corners.map((corner) => Math.abs(corner.x)))).toBeCloseTo(BASE.width / 2, 1);
    expect(Math.max(...corners.map((corner) => Math.abs(corner.z)))).toBeCloseTo(BASE.depth / 2, 0);
    expect(Math.max(...corners.map((corner) => Math.abs(corner.z)))).toBeLessThanOrEqual(BASE.depth / 2 + 0.1);
    // Väggarna har full höjd och spiran vilar på dem utan glipa.
    expect(topOf(parts, 'S1/side-right')).toBeCloseTo(BASE.wallHeight);
    expect(Math.min(...parts.filter(isRoofPart).flatMap((part) => worldCorners(part)).map((corner) => corner.y))).toBeCloseTo(BASE.wallHeight);
  });

  it('låter gavlarna gå ut på ett kvadratiskt torn, så att bara ett par väggar går ut', () => {
    const parts = partsFor({ roof: 'spire4', width: 120, depth: 120 });
    expect(lengthAlongX(parts, 'S1/gable-front')).toBeCloseTo(120);
    expect(lengthAlongZ(parts, 'S1/side-right')).toBeCloseTo(120 - 2 * THICKNESS);
  });
});
