import { describe, expect, it } from 'vitest';
import { cross3, dot3, vec3 } from '../../src/core/geometry/vector';
import { placeInstances } from '../../src/core/pipeline/placeInstances';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { fromShownOffset, toShownOffset, toShownOffsetRange } from '../../src/app/ui/shownOffset';
import { designWithExtensions } from '../domains/extensionFixtures';

const UP = vec3(0, 1, 0);

describe('läget längs väggen i panelen', () => {
  const house = placeInstances(designWithExtensions(), gingerbreadDomain).find((entry) => entry.instance.id === 'S1');

  it('plus flyttar åt höger sett utifrån mot väggen, på alla fyra väggar', () => {
    const walls = house?.sockets.filter((socket) => socket.kind === 'wall-surface') ?? [];
    expect(walls).toHaveLength(4);
    for (const wall of walls) {
      // Normalen pekar ut från huset, och höger för den som står utanför och tittar på väggen är (−normal) × upp.
      expect(dot3(wall.frame.normal, wall.frame.origin)).toBeGreaterThan(0);
      const right = cross3(vec3(-wall.frame.normal.x, -wall.frame.normal.y, -wall.frame.normal.z), UP);
      const uForPlus = fromShownOffset(10);
      expect(dot3(wall.frame.u, right) * uForPlus).toBeGreaterThan(0);
    }
  });

  it('vänder gränserna och värdet tillbaka', () => {
    expect(toShownOffsetRange({ min: -30, max: 50, gaps: [] })).toEqual({ min: -50, max: 30, gaps: [] });
    // Glappen vänds också och står kvar i stigande ordning.
    const gaps = [{ after: -20, before: -10 }, { after: 20, before: 35 }];
    expect(toShownOffsetRange({ min: -30, max: 50, gaps }).gaps).toEqual([{ after: -35, before: -20 }, { after: 10, before: 20 }]);
    expect(fromShownOffset(toShownOffset(25))).toBe(25);
    expect(Object.is(toShownOffset(0), 0)).toBe(true);
  });
});
