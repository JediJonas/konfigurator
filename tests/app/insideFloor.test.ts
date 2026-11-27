import { describe, expect, it } from 'vitest';
import { listInsideFloors } from '../../src/app/three/insideFloor';
import { boundsOf } from '../../src/core/geometry/polygon';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { designWithExtensions, extension, EXTENSION_PARAMS, HOST_PARAMS } from '../domains/extensionFixtures';
import { doorOn } from '../domains/openingFixtures';

describe('golvet inne i huset', () => {
  it('täcker varje sektion innanför väggarnas ytterkant, även tillbyggnaden utan vägg mot huset', () => {
    const floors = listInsideFloors(buildParts(designWithExtensions(extension('side-right'), doorOn('gable-front')), gingerbreadDomain));
    expect(floors).toHaveLength(2);
    const [house, wing] = floors.map(boundsOf);
    expect([house?.minX, house?.maxX, house?.minY, house?.maxY].map((value) => Math.round(value ?? 0))).toEqual([
      -HOST_PARAMS.width / 2,
      HOST_PARAMS.width / 2,
      -HOST_PARAMS.depth / 2,
      HOST_PARAMS.depth / 2,
    ]);
    expect(Math.round((wing?.maxX ?? 0) - (wing?.minX ?? 0))).toBe(EXTENSION_PARAMS.depth);
  });
});
