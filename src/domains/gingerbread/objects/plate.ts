import { z } from 'zod';
import type { ObjectType, Socket } from '../../../core/model/objectType';
import { vec2, vec3 } from '../../../core/geometry/vector';

export const PLATE_TYPE_ID = 'gb.plate';
export const GROUND_SOCKET_ID = 'ground';

/** Hur långt ut från mitten man kan ställa sektioner, i mm. */
const PLATE_RADIUS_MM = 400;

const plateParams = z.object({});

/**
 * Fatet som huset står på. Ägaren har valt att bottenplattan inte är en del
 * på ritningen, så fatet ger bara en markyta och inga delar.
 */
export const plateType: ObjectType<z.infer<typeof plateParams>> = {
  id: PLATE_TYPE_ID,
  labelKey: 'object.plate',
  params: plateParams,
  attachesTo: [],
  sockets: () => [groundSocket()],
  parts: () => [],
};

function groundSocket(): Socket {
  return {
    id: GROUND_SOCKET_ID,
    kind: 'ground',
    frame: { origin: vec3(0, 0, 0), u: vec3(1, 0, 0), normal: vec3(0, 1, 0) },
    bounds: [
      vec2(-PLATE_RADIUS_MM, -PLATE_RADIUS_MM),
      vec2(PLATE_RADIUS_MM, -PLATE_RADIUS_MM),
      vec2(PLATE_RADIUS_MM, PLATE_RADIUS_MM),
      vec2(-PLATE_RADIUS_MM, PLATE_RADIUS_MM),
    ],
  };
}
