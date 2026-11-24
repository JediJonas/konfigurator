import { describe, expect, it } from 'vitest';
import { MIN_PLATE_RADIUS_MM, plateRadius, shadowCameraBox, shadowLengthPerHeight } from '../../src/app/three/viewerFloor';

describe('skuggan får falla utanför fatet', () => {
  it('skuggkamerans ruta rymmer skuggans spets på golvet', () => {
    const extent = { reachMm: 150, heightMm: 300 };
    const box = shadowCameraBox(extent);
    const shadowTip = extent.reachMm + extent.heightMm * shadowLengthPerHeight();
    expect(box.halfSizeMm).toBeGreaterThan(shadowTip);
  });

  it('skuggan av ett högt hus når längre än fatet', () => {
    const extent = { reachMm: 150, heightMm: 300 };
    const shadowTip = extent.reachMm + extent.heightMm * shadowLengthPerHeight();
    expect(shadowTip).toBeGreaterThan(plateRadius(extent));
    expect(shadowCameraBox(extent).halfSizeMm).toBeGreaterThan(plateRadius(extent));
  });

  it('skuggkamerans ruta växer med huset', () => {
    const small = shadowCameraBox({ reachMm: 100, heightMm: 200 });
    const large = shadowCameraBox({ reachMm: 400, heightMm: 300 });
    expect(large.halfSizeMm).toBeGreaterThan(small.halfSizeMm);
    expect(large.farMm).toBeGreaterThan(small.farMm);
  });

  it('fatet har en minsta storlek', () => {
    expect(plateRadius({ reachMm: 10, heightMm: 10 })).toBe(MIN_PLATE_RADIUS_MM);
  });
});
