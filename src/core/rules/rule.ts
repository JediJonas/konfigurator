import type { Mm } from '../geometry/vector';
import type { SocketKind } from '../model/objectType';

/**
 * Fel: kombinationen kan inte tillverkas, och appen förhindrar den.
 * Varning: den går att tillverka men är riskabel; appen låter användaren fortsätta.
 */
export type RuleLevel = 'error' | 'warning';

interface RuleBase {
  level: RuleLevel;
  /** Objekttypen som regeln gäller. */
  objectType: string;
  /** Nyckel i domänens texter för förklaringen. */
  messageKey: string;
}

/** Bara vissa vridningar är tillåtna i en sorts kopplingspunkt. */
export interface AllowedRotationsRule extends RuleBase {
  kind: 'allowedRotations';
  socketKind: SocketKind;
  degrees: number[];
}

/** Objektet måste rymmas inom kopplingspunktens yta, sett vinkelrätt mot den. */
export interface WithinSocketBoundsRule extends RuleBase {
  kind: 'withinSocketBounds';
}

/** Objekt av typen får inte ta samma plats på marken. */
export interface NoOverlapRule extends RuleBase {
  kind: 'noOverlap';
}

/** Ett parametervärde över gränsen. Mest för varningar, eftersom schemat redan stoppar omöjliga värden. */
export interface ParamLimitRule extends RuleBase {
  kind: 'paramLimit';
  param: string;
  max: number;
}

/** En parameter får bara vissa värden när objektet sitter i en viss sorts kopplingspunkt. */
export interface AllowedParamValuesRule extends RuleBase {
  kind: 'allowedParamValues';
  socketKind: SocketKind;
  param: string;
  values: readonly string[];
}

/**
 * Objektets ytor på andra delar (`ObjectType.surfaceAreas`) ska ligga på hel
 * del, och får inte ta samma yta som ett annat objekts. Prövas på de färdiga
 * delarna, så att t.ex. ett hål där en granne står mot väggen räknas.
 */
export interface OnSolidPartRule extends RuleBase {
  kind: 'onSolidPart';
}

/** Högst så många objekt av typen i samma kopplingspunkt, t.ex. en dörr per vägg. */
export interface MaxCountPerSocketRule extends RuleBase {
  kind: 'maxCountPerSocket';
  max: number;
}

/** Objekttypens egen kontroll av sina parametrar (`ObjectType.isParamsValid`) ska gå igenom. */
export interface ValidParamsRule extends RuleBase {
  kind: 'validParams';
}

/**
 * Varje del av objektet ska rymmas på materialets skiva eller plåt, som den
 * ligger eller vriden 90°. Prövas på de färdiga delarna, efter samverkan.
 */
export interface FitsOnSheetRule extends RuleBase {
  kind: 'fitsOnSheet';
  sheet: { width: Mm; height: Mm };
}

/** Kopplingsregler som data i domänpaketet, SPEC.md avsnitt 5. */
export type Rule =
  | AllowedRotationsRule
  | WithinSocketBoundsRule
  | NoOverlapRule
  | ParamLimitRule
  | AllowedParamValuesRule
  | OnSolidPartRule
  | MaxCountPerSocketRule
  | ValidParamsRule
  | FitsOnSheetRule;

export interface RuleViolation {
  level: RuleLevel;
  instanceId: string;
  message: string;
}
