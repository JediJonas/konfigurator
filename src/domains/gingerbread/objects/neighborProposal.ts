import type { Mm, Vec2 } from '../../../core/geometry/vector';
import type { Socket } from '../../../core/model/objectType';
import type { SectionParams } from './sectionParams';
import { sectionParams, SPIRES } from './sectionParams';

/**
 * En ny sektion bredvid tar 60 % av väggens längd, som en tillbyggnad, och
 * är lika djup som bred, så att den blir ett torn eller ett kvadratiskt block.
 */
const NEIGHBOR_WALL_SHARE = 0.6;
/** Bredvid ett lågt hus föreslås ett torn så mycket högre än väggen. */
const TOWER_HEIGHT_FACTOR = 1.6;
/** Bredvid ett torn föreslås ett block så mycket lägre än väggen. */
const BLOCK_HEIGHT_FACTOR = 0.6;
/** Steget mellan bredderna som prövas när den första inte går. */
const NEIGHBOR_WIDTH_STEP_MM = 20;
/** Bredd och höjd avrundas nedåt till fältens steg, så att de går att skriva in igen. */
const WIDTH_FIELD_STEP_MM = sectionParams.shape.width.meta()?.step as number;
const WALL_HEIGHT_FIELD_STEP_MM = sectionParams.shape.wallHeight.meta()?.step as number;
const SECTION_MIN_WIDTH_MM = sectionParams.shape.width.unwrap().minValue ?? 0;
const SECTION_MIN_WALL_HEIGHT_MM = sectionParams.shape.wallHeight.unwrap().minValue ?? 0;
const SECTION_MAX_WALL_HEIGHT_MM = sectionParams.shape.wallHeight.unwrap().maxValue ?? Number.POSITIVE_INFINITY;

/**
 * Förslag till en sektion bredvid en vägg, det bästa först. Bredvid ett lågt
 * hus blir det ett torn, högre än väggen; bredvid ett torn (väggen högre än
 * den är lång) ett lägre block. Går den första höjden inte, t.ex. för att
 * taken skulle gå in i varandra, prövas den andra. Taket ärvs, men ett lägre
 * block får sadeltak i stället för tornspira.
 */
export function listNeighborCandidates(socket: Socket, inherited: Partial<SectionParams> = {}): Record<string, unknown>[] {
  const xs = socket.bounds.map((point) => point.x);
  const wallLength = Math.max(...xs) - Math.min(...xs);
  const cornerHeight = measureCornerHeight(socket.bounds, Math.max(...xs));
  const isBesideTower = cornerHeight > wallLength;
  const towerHeight = roundDown(Math.min(cornerHeight * TOWER_HEIGHT_FACTOR, SECTION_MAX_WALL_HEIGHT_MM), WALL_HEIGHT_FIELD_STEP_MM);
  const blockHeight = Math.max(roundDown(cornerHeight * BLOCK_HEIGHT_FACTOR, WALL_HEIGHT_FIELD_STEP_MM), SECTION_MIN_WALL_HEIGHT_MM);
  const heights = isBesideTower ? [blockHeight, towerHeight] : [towerHeight, blockHeight];
  const widths = listWidthsDown(Math.max(wallLength * NEIGHBOR_WALL_SHARE, SECTION_MIN_WIDTH_MM));
  return heights.flatMap((wallHeight) =>
    widths.map((width) => {
      const isBlock = wallHeight < cornerHeight;
      const roof = isBlock && inherited.roof && SPIRES.includes(inherited.roof) ? { roof: 'gable' as const } : {};
      return { ...inherited, ...roof, width, depth: width, wallHeight };
    }),
  );
}

/** Väggens höjd i hörnet, där kopplingspunktens u är `halfLength`. */
function measureCornerHeight(bounds: readonly Vec2[], halfLength: Mm): Mm {
  return Math.max(...bounds.filter((point) => Math.abs(point.x - halfLength) < 1e-6).map((point) => point.y));
}

/** Från `largest` avrundat nedåt, i steg om `NEIGHBOR_WIDTH_STEP_MM`, ner till den minsta bredden. */
function listWidthsDown(largest: Mm): Mm[] {
  const widths: Mm[] = [];
  for (let width = roundDown(largest, WIDTH_FIELD_STEP_MM); width >= SECTION_MIN_WIDTH_MM; width -= NEIGHBOR_WIDTH_STEP_MM) widths.push(width);
  return widths;
}

function roundDown(value: Mm, step: Mm): Mm {
  return Math.floor(value / step) * step;
}
