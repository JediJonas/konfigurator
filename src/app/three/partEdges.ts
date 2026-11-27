import type { Polygon } from '../../core/geometry/polygon';
import type { Part } from '../../core/model/part';

/** Ett hörn räknas som hörn, och får en kantlinje genom tjockleken, när konturen viker mer än så. */
const CORNER_ANGLE_DEGREES = 20;

/**
 * Kantlinjerna på en del, som par av punkter (x, y, z) i delens egna
 * koordinater: konturen och hålen på båda sidor, och en linje genom
 * tjockleken i varje hörn. Räknas direkt från konturen i stället för från
 * trianglarna, eftersom trianguleringen av en yta med hål på samma höjd, t.ex.
 * fönsterrutor bredvid varandra, ger smala trianglar som annars ritas som linjer över väggen.
 */
export function listPartEdges(part: Pick<Part, 'outline' | 'holes' | 'thickness'>): number[] {
  const positions: number[] = [];
  for (const ring of [part.outline, ...part.holes]) {
    ring.forEach((point, index) => {
      const next = ring[(index + 1) % ring.length] ?? point;
      for (const z of [0, part.thickness]) positions.push(point.x, point.y, z, next.x, next.y, z);
      if (isCorner(ring, index)) positions.push(point.x, point.y, 0, point.x, point.y, part.thickness);
    });
  }
  return positions;
}

function isCorner(ring: Polygon, index: number): boolean {
  const point = ring[index];
  const before = ring[(index - 1 + ring.length) % ring.length];
  const after = ring[(index + 1) % ring.length];
  if (!point || !before || !after) return false;
  const incoming = Math.atan2(point.y - before.y, point.x - before.x);
  const outgoing = Math.atan2(after.y - point.y, after.x - point.x);
  const turn = Math.abs(((outgoing - incoming + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
  return (turn * 180) / Math.PI > CORNER_ANGLE_DEGREES;
}
