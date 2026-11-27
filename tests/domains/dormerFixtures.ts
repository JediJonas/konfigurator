import type { Instance } from '../../src/core/model/design';
import { DORMER_TYPE_ID } from '../../src/domains/gingerbread/objects/dormer/dormer';

export const DORMER_PARAMS = { eaveDistance: 20, width: 40, wallHeight: 20, roofPitch: 45, eaveOverhang: 5, gableOverhang: 5 };

export function dormerOn(socketId: string, params: Record<string, unknown> = {}, u = 0, id = 'K1'): Instance {
  return { id, type: DORMER_TYPE_ID, params: { ...DORMER_PARAMS, ...params }, attachment: { socketId, u, v: 0, rotationDegrees: 0 }, children: [] };
}
