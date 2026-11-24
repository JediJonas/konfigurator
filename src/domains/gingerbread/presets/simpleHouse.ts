import { DESIGN_SCHEMA_VERSION } from '../../../core/model/design';
import type { Design } from '../../../core/model/design';
import type { Preset } from '../../../core/model/domain';
import { GINGERBREAD_DOUGH } from '../materials';
import { GROUND_SOCKET_ID, PLATE_TYPE_ID } from '../objects/plate';
import { SECTION_TYPE_ID } from '../objects/section';
import { GINGERBREAD_DOMAIN_ID, GINGERBREAD_DOMAIN_VERSION } from '../identity';

export const simpleHousePreset: Preset = {
  id: 'gb.simple-house',
  labelKey: 'preset.simpleHouse',
  create: (): Design => ({
    version: DESIGN_SCHEMA_VERSION,
    domain: GINGERBREAD_DOMAIN_ID,
    domainVersion: GINGERBREAD_DOMAIN_VERSION,
    material: { id: GINGERBREAD_DOUGH.id, thickness: GINGERBREAD_DOUGH.thickness },
    root: {
      id: 'plate',
      type: PLATE_TYPE_ID,
      params: {},
      children: [
        {
          id: 'S1',
          type: SECTION_TYPE_ID,
          params: {},
          attachment: { socketId: GROUND_SOCKET_ID, u: 0, v: 0, rotationDegrees: 0 },
          children: [],
        },
      ],
    },
  }),
};
