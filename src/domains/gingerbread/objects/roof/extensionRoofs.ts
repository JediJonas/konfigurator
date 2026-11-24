import type { RoofType } from '../sectionParams';
import { ROOF_TYPES } from '../sectionParams';

/**
 * Taktyper som en tillbyggnad kan ha. En tornspira står fritt på fatet, för
 * den har takfall åt alla håll och kan inte stå mot en vägg.
 */
export const EXTENSION_ROOF_TYPES: readonly RoofType[] = ROOF_TYPES.filter((roof) => roof !== 'spire4' && roof !== 'spire8');
