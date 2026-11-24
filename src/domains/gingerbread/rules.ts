import type { Rule } from '../../core/rules/rule';
import { SECTION_TYPE_ID } from './objects/section';
import { GROUND, WALL_SURFACE } from './socketKinds';

/** Väggar högre än så här bågnar lätt i ugnen eller viker sig när taket läggs på. */
const TALL_WALL_WARNING_MM = 160;

/** Kopplingsreglerna för pepparkakshus, SPEC.md avsnitt 5. */
export const gingerbreadRules: Rule[] = [
  // Ägarens beslut: fri vinkel i modellen, men bara räta vinklar tills vidare.
  { kind: 'allowedRotations', level: 'error', objectType: SECTION_TYPE_ID, socketKind: GROUND, degrees: [0, 90, 180, 270], messageKey: 'rule.rightAnglesOnly' },
  { kind: 'allowedRotations', level: 'error', objectType: SECTION_TYPE_ID, socketKind: WALL_SURFACE, degrees: [0], messageKey: 'rule.extensionUpright' },
  { kind: 'withinSocketBounds', level: 'error', objectType: SECTION_TYPE_ID, messageKey: 'rule.extensionFitsWall' },
  { kind: 'noOverlap', level: 'error', objectType: SECTION_TYPE_ID, messageKey: 'rule.sectionsOverlap' },
  { kind: 'paramLimit', level: 'warning', objectType: SECTION_TYPE_ID, param: 'wallHeight', max: TALL_WALL_WARNING_MM, messageKey: 'rule.tallWall' },
];
