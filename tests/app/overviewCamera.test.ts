import { describe, expect, it } from 'vitest';
import { croppedVerticalFovDegrees, OVERVIEW_AZIMUTH_DEGREES, overviewCameraPose } from '../../src/app/three/overviewCamera';

const frame = { center: { x: 0, y: 80, z: 0 }, radius: 150, verticalFovDegrees: 40, aspectRatio: 4 / 3 };

describe('översiktsbildens kamera', () => {
  it('tittar snett från sidan och ovanifrån', () => {
    const { position } = overviewCameraPose(frame);
    const azimuth = (Math.atan2(position.x, position.z) * 180) / Math.PI;
    expect(azimuth).toBeCloseTo(OVERVIEW_AZIMUTH_DEGREES);
    expect(position.y).toBeGreaterThan(frame.center.y);
  });

  it('flyttar kameran längre bort för ett större hus', () => {
    const near = overviewCameraPose(frame).position;
    const far = overviewCameraPose({ ...frame, radius: 300 }).position;
    expect(far.z).toBeCloseTo(near.z * 2);
  });

  it('ger mindre synfält för en beskuren bild', () => {
    expect(croppedVerticalFovDegrees(40, 1)).toBeCloseTo(40);
    // 2 · atan(tan(20°) · 0,5) ≈ 20,63°, inte rakt hälften.
    expect(croppedVerticalFovDegrees(40, 0.5)).toBeCloseTo(20.63, 1);
  });
});
