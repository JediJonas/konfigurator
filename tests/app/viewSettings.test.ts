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
  const radius = 2;

  it('lägger röret på radiens avstånd från linjen', () => {
    const straight = buildBeadGeometry([[vec3(0, 0, 0), vec3(10, 0, 0), vec3(20, 0, 0)]], radius);
    for (let index = 0; index < straight.positions.length; index += 3) {
      const [x, y, z] = [straight.positions[index] ?? 0, straight.positions[index + 1] ?? 0, straight.positions[index + 2] ?? 0];
      // Röret och kulorna i ändarna ligger på radien från sträckan, kulornas insida närmare.
      const distance = Math.hypot(x - Math.min(20, Math.max(0, x)), y, z);
      expect(distance).toBeLessThanOrEqual(radius + 1e-9);
      if (x > 0 && x < 20) expect(Math.hypot(y, z)).toBeLessThanOrEqual(radius + 1e-9);
    }
    expect(Math.max(...straight.indices)).toBeLessThan(straight.positions.length / 3);
  });

  it('fogar ett rätt hörn i gering utan kula, men sätter en kula i ett spetsigt', () => {
    const square = buildBeadGeometry([[vec3(0, 0, 0), vec3(10, 0, 0), vec3(10, 10, 0)]], radius);
    const sharp = buildBeadGeometry([[vec3(0, 0, 0), vec3(10, 0, 0), vec3(0, 2, 0)]], radius);
    const straight = buildBeadGeometry([[vec3(0, 0, 0), vec3(10, 0, 0), vec3(20, 0, 0)]], radius);
    expect(square.positions.length).toBe(straight.positions.length);
    expect(sharp.positions.length).toBeGreaterThan(square.positions.length);
  });

  it('gör en sluten slinga utan kulor', () => {
    const loop = buildBeadGeometry([[vec3(0, 0, 0), vec3(10, 0, 0), vec3(10, 10, 0), vec3(0, 10, 0), vec3(0, 0, 0)]], radius);
    const open = buildBeadGeometry([[vec3(0, 0, 0), vec3(10, 0, 0)]], radius);
    // Fyra ringar i hörnen och inga kulor, mot två ringar och två kulor för en öppen sträcka.
    expect(loop.positions.length).toBeLessThan(open.positions.length);
  });
});
