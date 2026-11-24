import type { CornerRole, CornerWall, JointStyle } from '../../core/model/joint';

/** Hur långt utanför en vägg ska räknas som lika lång när de längsta väljs. */
const EQUAL_LENGTH_TOLERANCE_MM = 0.5;

/**
 * Stumfog med hörnregeln (ägarens val, se CLAUDE.md): en vägg med sned
 * överkant går hela vägen ut, och väggar med rak överkant står mellan. Då
 * följer den sneda väggen takets undersida ut till hörnet och inget hål syns
 * under taket. Har alla väggar rak överkant går de längsta ut. Är väggarna
 * lika långa, som på ett kvadratiskt torn, går den första i listan ut.
 *
 * Regeln gäller de yttre hörnen, för väggar och för kanten runt ett platt
 * tak. En tillbyggnads väggar går stumt mot värdens vägg, och det hörnet har
 * ingen vägg som går ut.
 */
export const buttJoint: JointStyle = {
  id: 'gb.butt',
  labelKey: 'joint.butt',
  assignCornerRoles,
};

export function assignCornerRoles(walls: readonly CornerWall[]): Map<string, CornerRole> {
  const sloped = walls.filter((wall) => wall.hasSlopedTop);
  if (sloped.length > 0 && sloped.length < walls.length) {
    return new Map(walls.map((wall) => [wall.id, wall.hasSlopedTop ? 'through' : 'between']));
  }
  const longest = Math.max(...walls.map((wall) => wall.length));
  const first = walls.find((wall) => wall.length >= longest - EQUAL_LENGTH_TOLERANCE_MM);
  return new Map(walls.map((wall) => [wall.id, wall === first ? 'through' : 'between']));
}
