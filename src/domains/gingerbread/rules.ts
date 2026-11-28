import type { Rule } from '../../core/rules/rule';
import { EXTENSION_ROOF_TYPES } from './objects/roof/extensionRoofs';
import { DOOR_TYPE_ID } from './objects/openings/door';
import { DORMER_TYPE_ID } from './objects/dormer/dormer';
import { CHIMNEY_TYPE_ID } from './objects/chimney/chimney';
import { WINDOW_TYPE_ID } from './objects/openings/window';
import { SECTION_TYPE_ID } from './objects/section';
import { DORMER_WALL, GROUND, ROOF_SURFACE, WALL_BESIDE, WALL_SURFACE } from './socketKinds';

/** Kopplingsreglerna för pepparkakshus, SPEC.md avsnitt 5. */
export const gingerbreadRules: Rule[] = [
  // Ägarens beslut: fri vinkel i modellen, men bara räta vinklar tills vidare.
  { kind: 'allowedRotations', level: 'error', objectType: SECTION_TYPE_ID, socketKind: GROUND, degrees: [0, 90, 180, 270], messageKey: 'rule.rightAnglesOnly' },
  { kind: 'allowedRotations', level: 'error', objectType: SECTION_TYPE_ID, socketKind: WALL_SURFACE, degrees: [0], messageKey: 'rule.extensionUpright' },
  { kind: 'allowedRotations', level: 'error', objectType: SECTION_TYPE_ID, socketKind: WALL_BESIDE, degrees: [0], messageKey: 'rule.neighborUpright' },
  { kind: 'withinSocketBounds', level: 'error', objectType: SECTION_TYPE_ID, messageKey: 'rule.extensionFitsWall' },
  { kind: 'allowedParamValues', level: 'error', objectType: SECTION_TYPE_ID, socketKind: WALL_SURFACE, param: 'roof', values: EXTENSION_ROOF_TYPES, messageKey: 'rule.noSpireOnExtension' },
  { kind: 'noOverlap', level: 'error', objectType: SECTION_TYPE_ID, messageKey: 'rule.sectionsOverlap' },
  { kind: 'allowedRotations', level: 'error', objectType: WINDOW_TYPE_ID, socketKind: WALL_SURFACE, degrees: [0], messageKey: 'rule.openingUpright' },
  { kind: 'allowedRotations', level: 'error', objectType: WINDOW_TYPE_ID, socketKind: DORMER_WALL, degrees: [0], messageKey: 'rule.openingUpright' },
  { kind: 'allowedRotations', level: 'error', objectType: DOOR_TYPE_ID, socketKind: WALL_SURFACE, degrees: [0], messageKey: 'rule.openingUpright' },
  { kind: 'onSolidPart', level: 'error', objectType: WINDOW_TYPE_ID, messageKey: 'rule.windowOnWall' },
  { kind: 'onSolidPart', level: 'error', objectType: DOOR_TYPE_ID, messageKey: 'rule.doorOnWall' },
  { kind: 'maxCountPerSocket', level: 'error', objectType: DOOR_TYPE_ID, max: 1, messageKey: 'rule.oneDoorPerWall' },
  { kind: 'allowedRotations', level: 'error', objectType: DORMER_TYPE_ID, socketKind: ROOF_SURFACE, degrees: [0], messageKey: 'rule.dormerUpright' },
  { kind: 'onSolidPart', level: 'error', objectType: DORMER_TYPE_ID, messageKey: 'rule.dormerOnRoof' },
  { kind: 'allowedRotations', level: 'error', objectType: CHIMNEY_TYPE_ID, socketKind: ROOF_SURFACE, degrees: [0], messageKey: 'rule.chimneyUpright' },
  { kind: 'onSolidPart', level: 'error', objectType: CHIMNEY_TYPE_ID, messageKey: 'rule.chimneyOnRoof' },
];
