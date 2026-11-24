import type { Mm } from '../../../../core/geometry/vector';

/**
 * Hur ett lutande takfall möter väggen vid takfoten, sett vinkelrätt mot väggen.
 *
 * Takfallet är en skiva som står vinkelrätt mot sin yta, så ovansidans kant
 * ligger tjockleken · sin(lutning) längre ut än undersidans. Takutsprånget
 * mäts till ovansidans kant, så 0 mm går jäms med väggens utsida.
 */
export interface EaveFit {
  /**
   * Hur långt innanför väggens utsida undersidans plan når väggens höjd. 0 när
   * taket vilar på väggens ytterkant; större när takfoten slutar ovanpå väggen.
   */
  inset: Mm;
  /** Undersidans kant vid takfoten, vågrätt från väggens utsida (negativ innanför). */
  reach: Mm;
}

/** Hur långt ovansidans kant sticker ut vågrätt förbi undersidans på en takyta med lutningen `slope`. */
export function measureTopLip(slope: number, thickness: Mm): Mm {
  return thickness * Math.sin(Math.atan(slope));
}

/** Var takfallet ska vila för att ovansidans kant ska nå `overhang` utanför väggen, mätt längs lutningen. */
export function fitEave(overhang: Mm, slope: number, thickness: Mm): EaveFit {
  const topReach = overhang * Math.cos(Math.atan(slope));
  const lip = measureTopLip(slope, thickness);
  return { inset: Math.max(0, lip - topReach), reach: topReach - lip };
}
