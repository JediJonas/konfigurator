/** Kopplingstyperna i pepparkaksdomänen, SPEC.md avsnitt 3. */
export const GROUND = 'ground';
export const WALL_SURFACE = 'wall-surface';
/**
 * Utsidan av en vägg, för en sektion som står på fatet bredvid och delar
 * väggen. Den får vara högre och bredare än väggen, till skillnad från en tillbyggnad.
 */
export const WALL_BESIDE = 'wall-beside';
/** Ovansidan av ett takfall med lutning, t.ex. för en takkupa. */
export const ROOF_SURFACE = 'roof-surface';
/** Utsidan av en takkupas framvägg, för fönster. Bara fönster fäster där. */
export const DORMER_WALL = 'dormer-wall';
