import type { Design, Instance } from '../../src/core/model/design';
import { simpleHousePreset } from '../../src/domains/gingerbread/presets/simpleHouse';
import { SECTION_TYPE_ID } from '../../src/domains/gingerbread/objects/section';

export const HOST_PARAMS = { width: 140, depth: 180, wallHeight: 100, roofPitch: 45, eaveOverhang: 10, gableOverhang: 10 };
export const EXTENSION_PARAMS = { width: 80, depth: 80, wallHeight: 50, roofPitch: 45, eaveOverhang: 8, gableOverhang: 8 };

export function extension(socketId: string, params: Record<string, unknown> = EXTENSION_PARAMS, u = 0, id = 'S2'): Instance {
  return { id, type: SECTION_TYPE_ID, params, attachment: { socketId, u, v: 0, rotationDegrees: 0 }, children: [] };
}

/** Enkla huset med tillbyggnader på huvudhuset S1. */
export function designWithExtensions(...extensions: Instance[]): Design {
  const design = simpleHousePreset.create();
  const host = design.root.children[0];
  if (!host) throw new Error('Mallen saknar sektion');
  host.params = HOST_PARAMS;
  host.children = extensions;
  return design;
}
