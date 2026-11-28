import type { Instance } from '../../src/core/model/design';
import { CHIMNEY_TYPE_ID } from '../../src/domains/gingerbread/objects/chimney/chimney';

export const CHIMNEY_PARAMS = { eaveDistance: 60, width: 25, depth: 20, height: 30 };

export function chimneyOn(socketId: string, params: Record<string, unknown> = {}, u = 0, id = 'SK1'): Instance {
  return { id, type: CHIMNEY_TYPE_ID, params: { ...CHIMNEY_PARAMS, ...params }, attachment: { socketId, u, v: 0, rotationDegrees: 0 }, children: [] };
}
