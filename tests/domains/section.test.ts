import { describe, expect, it } from 'vitest';
import { transformPoint } from '../../src/core/geometry/matrix';
import type { Vec3 } from '../../src/core/geometry/vector';
import { degreesToRadians, vec3 } from '../../src/core/geometry/vector';
import type { Design } from '../../src/core/model/design';
import type { Part } from '../../src/core/model/part';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { simpleHousePreset } from '../../src/domains/gingerbread/presets/simpleHouse';

function designWith(params: Record<string, unknown>, thickness = 4): Design {
  const design = simpleHousePreset.create();
  const section = design.root.children[0];
  if (!section) throw new Error('Mallen saknar sektion');
  section.params = params;
  design.material.thickness = thickness;
  return design;
}

function partById(parts: Part[], suffix: string): Part {
  const part = parts.find((candidate) => candidate.id.endsWith(suffix));
  if (!part) throw new Error(`Saknar ${suffix}`);
  return part;
}

/** Hörnen på delens ena sida (z = 0) eller andra (z = tjockleken), i världen. */
function worldCorners(part: Part, onFarSide = false): Vec3[] {
  const z = onFarSide ? part.thickness : 0;
  return part.outline.map((p) => transformPoint(part.transform, vec3(p.x, p.y, z)));
}

describe('sektion med sadeltak', () => {
  const params = { width: 140, depth: 180, wallHeight: 100, roofPitch: 45, eaveOverhang: 10, gableOverhang: 10 };
  const parts = buildParts(designWith(params), gingerbreadDomain);

  it('ger två långväggar, två gavlar och två takhalvor', () => {
    expect(parts.map((part) => part.id).sort()).toEqual(
      ['S1/gable-back', 'S1/gable-front', 'S1/roof-left', 'S1/roof-right', 'S1/side-left', 'S1/side-right'].sort(),
    );
  });

  it('kortar gavlarna med 2 × tjockleken så att de står mellan långväggarna', () => {
    const gable = partById(parts, 'gable-front');
    const xs = worldCorners(gable).map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(140 - 2 * 4);
  });

  it('gör långväggen lika hög som vägghöjden', () => {
    const side = partById(parts, 'side-right');
    const sideHeight = Math.max(...worldCorners(side).map((p) => p.y));
    expect(sideHeight).toBeCloseTo(100);
  });

  it('låter långväggarna gå hela längden och stå utanför gavlarna', () => {
    const side = partById(parts, 'side-right');
    const corners = [...worldCorners(side), ...worldCorners(side, true)];
    const zs = corners.map((p) => p.z);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(180);
    expect(Math.max(...corners.map((p) => p.x))).toBeCloseTo(70);
    expect(Math.min(...corners.map((p) => p.x))).toBeCloseTo(66);
  });

  it('lägger gavelns snedkanter i takets undersida', () => {
    const slope = Math.tan(degreesToRadians(45));
    for (const corner of worldCorners(partById(parts, 'gable-front'))) {
      if (corner.y <= 1) continue;
      const roofUnderside = 100 + (70 - Math.abs(corner.x)) * slope;
      expect(corner.y).toBeCloseTo(roofUnderside);
    }
  });

  it('låter takhalvornas undersidor mötas i nocken', () => {
    const ridgeHeight = 100 + 70 * Math.tan(degreesToRadians(45));
    for (const suffix of ['roof-left', 'roof-right']) {
      const top = worldCorners(partById(parts, suffix)).filter((p) => Math.abs(p.x) < 0.01);
      expect(top).toHaveLength(2);
      for (const corner of top) expect(corner.y).toBeCloseTo(ridgeHeight);
    }
  });

  it('lägger takets undersida på långväggens yttre överkant', () => {
    const roof = partById(parts, 'roof-right');
    const [eaveA, , , ridgeA] = worldCorners(roof);
    if (!eaveA || !ridgeA) throw new Error('Taket saknar hörn');
    const t = (70 - eaveA.x) / (ridgeA.x - eaveA.x);
    expect(eaveA.y + t * (ridgeA.y - eaveA.y)).toBeCloseTo(100);
  });

  it('använder objektets egen tjocklek när den finns', () => {
    const design = designWith(params);
    const section = design.root.children[0];
    if (!section) throw new Error('Mallen saknar sektion');
    section.thickness = 6;
    expect(buildParts(design, gingerbreadDomain).every((part) => part.thickness === 6)).toBe(true);
  });

  it('fyller i standardvärden för parametrar som saknas', () => {
    expect(buildParts(designWith({}), gingerbreadDomain)).toHaveLength(6);
  });

  it('avvisar ogiltiga mått', () => {
    expect(() => buildParts(designWith({ width: 10 }), gingerbreadDomain)).toThrow();
  });
});
