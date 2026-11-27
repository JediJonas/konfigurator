import type { Domain } from '../../core/model/domain';
import { GINGERBREAD_DOMAIN_ID, GINGERBREAD_DOMAIN_VERSION } from './identity';
import { GINGERBREAD_DOUGH } from './materials';
import { plateType } from './objects/plate';
import { doorType } from './objects/openings/door';
import { dormerType } from './objects/dormer/dormer';
import { windowType } from './objects/openings/window';
import { sectionType } from './objects/section';
import { simpleHousePreset } from './presets/simpleHouse';
import { neighborResolver } from './interactions/neighbors';
import { valleyResolver } from './interactions/valleys';
import { dormerResolver } from './interactions/dormers';
import { buttJoint } from './joints';
import { gingerbreadRules } from './rules';
import { gingerbreadStrings } from './strings.sv';
import { migrateGingerbreadParams } from './migrateParams';

export const gingerbreadDomain: Domain = {
  id: GINGERBREAD_DOMAIN_ID,
  version: GINGERBREAD_DOMAIN_VERSION,
  objectTypes: [plateType, sectionType, windowType, doorType, dormerType],
  rules: gingerbreadRules,
  interactions: [valleyResolver, dormerResolver, neighborResolver],
  materials: [GINGERBREAD_DOUGH],
  jointStyles: [buttJoint],
  presets: [simpleHousePreset],
  strings: gingerbreadStrings,
  migrateParams: migrateGingerbreadParams,
};
