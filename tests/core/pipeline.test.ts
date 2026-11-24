import { describe, expect, it } from 'vitest';
import { transformPoint } from '../../src/core/geometry/matrix';
import { vec3 } from '../../src/core/geometry/vector';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { simpleHousePreset } from '../../src/domains/gingerbread/presets/simpleHouse';

describe('flödet Design → delar', () => {
  it('placerar ett objekt enligt kopplingen i förälderns kopplingspunkt', () => {
    const design = simpleHousePreset.create();
    const section = design.root.children[0];
    if (!section?.attachment) throw new Error('Mallen saknar sektion');
    const before = buildParts(design, gingerbreadDomain);
    section.attachment = { ...section.attachment, u: 50, v: -20, rotationDegrees: 90 };
    const after = buildParts(design, gingerbreadDomain);
    const origin = vec3(0, 0, 0);
    const original = before[0] && transformPoint(before[0].transform, origin);
    const moved = after[0] && transformPoint(after[0].transform, origin);
    if (!original || !moved) throw new Error('Inga delar');
    // Vridning 90° moturs runt y: (x, z) → (z, −x), sedan flytt (50, −20).
    expect(moved.x).toBeCloseTo(original.z + 50);
    expect(moved.z).toBeCloseTo(-original.x - 20);
  });

  it('säger tydligt till om en objekttyp saknas', () => {
    const design = simpleHousePreset.create();
    design.root.type = 'gb.unknown';
    expect(() => buildParts(design, gingerbreadDomain)).toThrow(/Okänd objekttyp/);
  });

  it('ger inga delar för fatet', () => {
    const design = simpleHousePreset.create();
    design.root.children = [];
    expect(buildParts(design, gingerbreadDomain)).toEqual([]);
  });
});
