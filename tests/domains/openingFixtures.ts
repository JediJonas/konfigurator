import type { Instance } from '../../src/core/model/design';
import { DOOR_TYPE_ID } from '../../src/domains/gingerbread/objects/openings/door';
import { WINDOW_TYPE_ID } from '../../src/domains/gingerbread/objects/openings/window';

export const WINDOW_PARAMS = { width: 30, height: 40, sillHeight: 30, shape: 'rect', mullions: 'none', hasShutters: false };
export const DOOR_PARAMS = { width: 35, height: 60, shape: 'rect', kind: 'single' };

export function windowOn(socketId: string, params: Record<string, unknown> = {}, u = 0, id = 'F1'): Instance {
  return { id, type: WINDOW_TYPE_ID, params: { ...WINDOW_PARAMS, ...params }, attachment: { socketId, u, v: 0, rotationDegrees: 0 }, children: [] };
}

export function doorOn(socketId: string, params: Record<string, unknown> = {}, u = 0, id = 'D1'): Instance {
  return { id, type: DOOR_TYPE_ID, params: { ...DOOR_PARAMS, ...params }, attachment: { socketId, u, v: 0, rotationDegrees: 0 }, children: [] };
}
