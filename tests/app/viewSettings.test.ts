import { describe, expect, it } from 'vitest';
import { readShowEdgeBead, rememberShowEdgeBead } from '../../src/app/state/viewSettings';
import type { ViewSettingsStorage } from '../../src/app/state/viewSettings';
import { createMemoryStorage } from './memoryStorage';
import { buildBeadGeometry } from '../../src/app/three/edgeBeadGeometry';
import { cross3, dot3, length3, subtract3, vec3 } from '../../src/core/geometry/vector';

const blockedStorage: ViewSettingsStorage = {
  getItem: () => {
    throw new Error('blockerad');
  },
  setItem: () => {
    throw new Error('blockerad');
  },
};

describe('kristyr som inställning i vyn', () => {
  it('är på från början och kommer ihåg valet, även när det är av', () => {
    const storage = createMemoryStorage();
    expect(readShowEdgeBead(storage)).toBe(true);
    rememberShowEdgeBead(storage, false);
    expect(readShowEdgeBead(storage)).toBe(false);
    rememberShowEdgeBead(storage, true);
    expect(readShowEdgeBead(storage)).toBe(true);
  });

  it('är på när lagringen saknas eller är blockerad', () => {
    expect(readShowEdgeBead(undefined)).toBe(true);
    expect(readShowEdgeBead(blockedStorage)).toBe(true);
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

  it('vänder kulornas trianglar utåt, så att de inte ser ihåliga ut', () => {
    const sphere = buildBeadGeometry([[vec3(0, 0, 0), vec3(10, 0, 0)]], radius);
    const at = (index: number) => vec3(sphere.positions[index * 3] ?? 0, sphere.positions[index * 3 + 1] ?? 0, sphere.positions[index * 3 + 2] ?? 0);
    for (let index = 0; index < sphere.indices.length; index += 3) {
      const [a, b, c] = [at(sphere.indices[index] ?? 0), at(sphere.indices[index + 1] ?? 0), at(sphere.indices[index + 2] ?? 0)];
      const normal = cross3(subtract3(b, a), subtract3(c, a));
      if (length3(normal) < 1e-9) continue;
      // Triangelns normal pekar bort från närmaste punkt på sträckan.
      const center = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3, z: (a.z + b.z + c.z) / 3 };
      const axis = vec3(Math.min(10, Math.max(0, center.x)), 0, 0);
      expect(dot3(normal, subtract3(center, axis))).toBeGreaterThan(0);
    }
  });

  it('gör en sluten slinga utan kulor', () => {
    const loop = buildBeadGeometry([[vec3(0, 0, 0), vec3(10, 0, 0), vec3(10, 10, 0), vec3(0, 10, 0), vec3(0, 0, 0)]], radius);
    const open = buildBeadGeometry([[vec3(0, 0, 0), vec3(10, 0, 0)]], radius);
    // Fyra ringar i hörnen och inga kulor, mot två ringar och två kulor för en öppen sträcka.
    expect(loop.positions.length).toBeLessThan(open.positions.length);
  });
});
