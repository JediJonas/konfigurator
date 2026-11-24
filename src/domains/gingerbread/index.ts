import type { Domain } from '../../core/model/domain';
import { GINGERBREAD_DOMAIN_ID, GINGERBREAD_DOMAIN_VERSION } from './identity';
import { GINGERBREAD_DOUGH } from './materials';
import { plateType } from './objects/plate';
import { sectionType } from './objects/section';
import { simpleHousePreset } from './presets/simpleHouse';
import { gingerbreadStrings } from './strings.sv';

export const gingerbreadDomain: Domain = {
  id: GINGERBREAD_DOMAIN_ID,
  version: GINGERBREAD_DOMAIN_VERSION,
  objectTypes: [plateType, sectionType],
  materials: [GINGERBREAD_DOUGH],
  presets: [simpleHousePreset],
  strings: gingerbreadStrings,
};
