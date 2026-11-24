import { describe, expect, it } from 'vitest';
import { lightPositionForView } from '../../src/app/three/viewerLight';

const origin = { x: 0, y: 0, z: 0 };

describe('lampan följer betraktaren', () => {
  it('står på samma ställe sett från betraktaren när man vrider runt huset', () => {
    const front = lightPositionForView({ x: 0, y: 200, z: 400 }, origin);
    const side = lightPositionForView({ x: 400, y: 200, z: 0 }, origin);
    // Kvartsvarv runt y: (x, z) framifrån blir (z, −x) från sidan.
    expect(side.x).toBeCloseTo(front.z);
    expect(side.z).toBeCloseTo(-front.x);
    expect(side.y).toBeCloseTo(front.y);
  });

  it('lyser från betraktarens sida av huset', () => {
    const light = lightPositionForView({ x: 0, y: 200, z: 400 }, origin);
    expect(light.z).toBeGreaterThan(0);
  });

  it('räknar från vyns mittpunkt', () => {
    const centered = lightPositionForView({ x: 0, y: 200, z: 400 }, origin);
    const moved = lightPositionForView({ x: 50, y: 270, z: 400 }, { x: 50, y: 70, z: 0 });
    expect(moved.x - 50).toBeCloseTo(centered.x);
    expect(moved.y - 70).toBeCloseTo(centered.y);
  });
});
