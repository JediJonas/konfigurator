import type { Mm, Vec2 } from '../../../core/geometry/vector';
import type { BuildContext, Socket } from '../../../core/model/objectType';
import type { SectionParams } from './sectionParams';
import { sectionParams } from './sectionParams';
import { sectionSocketOutline, sectionSocketTopOutline } from './sectionSockets';
import { EXTENSION_ROOF_TYPES } from './roof/extensionRoofs';

/** Djup för en ny tillbyggnad, och tak när föräldern inte har något att ärva. Bredd och vägghöjd räknas från väggen den sitter på. */
const EXTENSION_DEPTH_MM = 80;
const EXTENSION_OVERHANG_MM = 8;
const EXTENSION_PITCH_DEGREES = 45;
/**
 * Förslagen tar 60 % av väggens längd och höjd (ägarens val), så att det
 * finns plats att flytta dem och en rad tillbyggnader trappas ner.
 */
const EXTENSION_WALL_SHARE = 0.6;
/**
 * När 60 % av hörnets höjd är lägre än minsta vägghöjden blir väggen så
 * mycket lägre än hörnet (ägarens val), så att en rad tillbyggnader trappas ner.
 */
const EXTENSION_STEP_DOWN_MM = 10;
/** Steget mellan bredderna som prövas när den första inte ryms. */
const EXTENSION_WIDTH_STEP_MM = 20;
/** Bredden avrundas nedåt till jämna centimeter. */
const EXTENSION_ROUNDING_MM = 10;
/** Förslagen avrundas nedåt till fältens steg, så att de går att skriva in igen. */
const WALL_HEIGHT_FIELD_STEP_MM = sectionParams.shape.wallHeight.meta()?.step as number;
/** Schemats minsta bredd och vägghöjd för en sektion. */
const SECTION_MIN_WIDTH_MM = sectionParams.shape.width.unwrap().minValue ?? 0;
const SECTION_MIN_WALL_HEIGHT_MM = sectionParams.shape.wallHeight.unwrap().minValue ?? 0;

/**
 * Förslag till en ny tillbyggnad, största först, en vägghöjd per bredd.
 * Bredden är 60 % av väggen, eller den minsta bredden när 60 % är smalare
 * än den och väggen rymmer den. Vägghöjden är 60 % av väggens höjd i hörnet
 * (10 mm under den om 60 % är lägre än minsta höjden), men aldrig högre än
 * att väggarna ryms under värdens väggöverkant och taket under värdens tak.
 * En tornspira ärvs inte, eftersom den bara kan stå på fatet; då blir det sadeltak.
 */
export function listExtensionCandidates(socket: Socket, context: BuildContext, inherited: Partial<SectionParams> = {}): Record<string, unknown>[] {
  const xs = socket.bounds.map((point) => point.x);
  const wallLength = Math.max(...xs) - Math.min(...xs);
  const widths = listWidthsDown(wallLength * EXTENSION_WALL_SHARE);
  const fittingWidths = widths.length > 0 || wallLength < SECTION_MIN_WIDTH_MM ? widths : [SECTION_MIN_WIDTH_MM];
  const cornerHeight = measureCornerHeight(socket);
  const shareHeight = cornerHeight * EXTENSION_WALL_SHARE;
  const preferredHeight = shareHeight >= SECTION_MIN_WALL_HEIGHT_MM ? shareHeight : cornerHeight - EXTENSION_STEP_DOWN_MM;
  const roof = inherited.roof && !EXTENSION_ROOF_TYPES.includes(inherited.roof) ? { roof: 'gable' as const } : {};
  return fittingWidths.flatMap((width) => {
    // Taket ärvs från föräldern, så att den högsta vägghöjden räknas med samma tak som tillbyggnaden får.
    const params = { ...extensionParams(width, 0), ...inherited, ...roof, wallHeight: 0 };
    const wallHeight = roundDown(Math.min(preferredHeight, findHighestWall(socket, params, context)), WALL_HEIGHT_FIELD_STEP_MM);
    return wallHeight >= SECTION_MIN_WALL_HEIGHT_MM ? [{ ...params, wallHeight }] : [];
  });
}

function extensionParams(width: Mm, wallHeight: Mm): SectionParams {
  return sectionParams.parse({
    width,
    depth: EXTENSION_DEPTH_MM,
    wallHeight: Math.max(wallHeight, SECTION_MIN_WALL_HEIGHT_MM),
    roofPitch: EXTENSION_PITCH_DEGREES,
    eaveOverhang: EXTENSION_OVERHANG_MM,
    gableOverhang: EXTENSION_OVERHANG_MM,
  });
}

/**
 * Den högsta vägghöjden där tillbyggnaden mitt i kopplingspunkten ryms:
 * väggarna under punktens överkant och taket under punktens tak. Konturerna
 * räknas med vägghöjden 0, och varje punkt får stiga tills den når kanten rakt ovanför sig.
 */
function findHighestWall(socket: Socket, params: SectionParams, context: BuildContext): Mm {
  const placed = { ...context, socket };
  const room = (outline: { x: Mm; y: Mm }[], bounds: Vec2[]) => outline.map((point) => findTopOfBounds(bounds, -point.x) - point.y);
  return Math.min(
    ...room(sectionSocketOutline(params, placed), socket.bounds),
    ...room(sectionSocketTopOutline(params, placed), socket.topBounds ?? socket.bounds),
  );
}
/** Kopplingspunktens överkant rakt ovanför `x`. Utanför punkten finns ingen plats. */
function findTopOfBounds(bounds: Vec2[], x: Mm): Mm {
  let top = Number.NEGATIVE_INFINITY;
  bounds.forEach((start, index) => {
    const end = bounds[(index + 1) % bounds.length] ?? start;
    const [left, right] = start.x <= end.x ? [start, end] : [end, start];
    if (x < left.x || x > right.x) return;
    const y = left.x === right.x ? Math.max(left.y, right.y) : left.y + ((x - left.x) / (right.x - left.x)) * (right.y - left.y);
    top = Math.max(top, y);
  });
  return top;
}

/** Väggens höjd i hörnet: gavelns långväggshöjd eller långväggens överkant. */
function measureCornerHeight(socket: Socket): Mm {
  const halfLength = Math.max(...socket.bounds.map((point) => point.x));
  return findTopOfBounds(socket.bounds, halfLength);
}

/** Från `largest` avrundat nedåt, i steg om `EXTENSION_WIDTH_STEP_MM`, och sist den minsta bredden. */
function listWidthsDown(largest: Mm): Mm[] {
  const widths: Mm[] = [];
  for (let width = roundDown(largest, EXTENSION_ROUNDING_MM); width > SECTION_MIN_WIDTH_MM; width -= EXTENSION_WIDTH_STEP_MM) widths.push(width);
  if (largest >= SECTION_MIN_WIDTH_MM) widths.push(SECTION_MIN_WIDTH_MM);
  return widths;
}

function roundDown(value: Mm, step: Mm): Mm {
  return Math.floor(value / step) * step;
}
