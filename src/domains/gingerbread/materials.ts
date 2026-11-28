import type { EdgeBead, Material } from '../../core/model/domain';
import { MULLION_WIDTH_MM } from './objects/openings/openingShape';

export const GINGERBREAD_DOUGH: Material = {
  id: 'gb.dough',
  labelKey: 'material.dough',
  thickness: 4,
  sheet: { width: 400, height: 300 },
  color: '#a8652f',
};

/** Mer än spröjsens bredd, så att hålen på var sin sida om en spröjs får en gemensam rand. */
const ICING_MERGE_DISTANCE_MM = MULLION_WIDTH_MM + 2;

/** Kristyr som spritsas längs ytterkanterna; visas bara i 3D-vyn. */
export const ICING: EdgeBead = {
  labelKey: 'setting.icing',
  color: '#fbfaf6',
  radius: 2.2,
  mergeDistance: ICING_MERGE_DISTANCE_MM,
};
