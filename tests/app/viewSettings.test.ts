import { describe, expect, it } from 'vitest';
import { readShowEdgeBead, rememberShowEdgeBead } from '../../src/app/state/viewSettings';
import type { ViewSettingsStorage } from '../../src/app/state/viewSettings';
import { createMemoryStorage } from './memoryStorage';
import { buildBeadGeometry } from '../../src/app/three/edgeBeadGeometry';
import { vec3 } from '../../src/core/geometry/vector';

const blockedStorage: ViewSettingsStorage = {
  getItem: () => {
    throw new Error('blockerad');
  },
  setItem: () => {
    throw new Error('blockerad');
  },
};

describe('kristyr som inställning i vyn', () => {
  it('är av från början och kommer ihåg valet', () => {
    const storage = createMemoryStorage();
    expect(readShowEdgeBead(storage)).toBe(false);
    rememberShowEdgeBead(storage, true);
    expect(readShowEdgeBead(storage)).toBe(true);
    rememberShowEdgeBead(storage, false);
    expect(readShowEdgeBead(storage)).toBe(false);
  });

  it('är av när lagringen saknas eller är blockerad', () => {
    expect(readShowEdgeBead(undefined)).toBe(false);
    expect(readShowEdgeBead(blockedStorage)).toBe(false);
    expect(() => rememberShowEdgeBead(blockedStorage, true)).not.toThrow();
  });
});

describe('randens geometri', () => {
  it('lägger randen på radiens avstånd runt linjen, med kulor bara i ändarna när linjen går rakt', () => {
    const radius = 2;
    const straight = buildBeadGeometry([[vec3(0, 0, 0), vec3(10, 0, 0), vec3(20, 0, 0)]], radius);
    const bent = buildBeadGeometry([[vec3(0, 0, 0), vec3(10, 0, 0), vec3(10, 10, 0)]], radius);
    expect(bent.positions.length).toBeGreaterThan(straight.positions.length);
    for (let index = 0; index < straight.positions.length; index += 3) {
      const [y, z] = [straight.positions[index + 1] ?? 0, straight.positions[index + 2] ?? 0];
      const x = straight.positions[index] ?? 0;
      // Röret ligger på radien från x-axeln; kulornas punkter på radien från ändarna.
      const distance = x >= 0 && x <= 20 ? Math.hypot(y, z) : Math.hypot(x < 0 ? x : x - 20, y, z);
      expect(distance).toBeLessThanOrEqual(radius + 1e-9);
    }
    expect(Math.max(...straight.indices)).toBeLessThan(straight.positions.length / 3);
  });
});
