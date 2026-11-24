import type { Mm, Vec2 } from '../../../core/geometry/vector';
import type { BuildContext, Socket } from '../../../core/model/objectType';
import type { SectionParams } from './sectionParams';
import { sectionParams } from './sectionParams';
import { sectionSocketOutline, WALL_EDGE_MARGIN_MM } from './sectionSockets';

/** Djup och tak för en ny tillbyggnad. Bredd och vägghöjd räknas från väggen den sitter på. */
const EXTENSION_DEPTH_MM = 80;
const EXTENSION_OVERHANG_MM = 8;
const EXTENSION_PITCH_DEGREES = 45;
/**
 * Förslagen tar 60 % av väggens längd och höjd (ägarens val), så att det
 * finns plats att flytta dem och en rad tillbyggnader trappas ner.
 */
const EXTENSION_WALL_SHARE = 0.6;
/** Steget mellan bredderna som prövas när den första inte ryms. */
const EXTENSION_WIDTH_STEP_MM = 20;
/** Bredden avrundas nedåt till jämna centimeter. */
const EXTENSION_ROUNDING_MM = 10;
/** Förslagen avrundas nedåt till fältens steg, så att de går att skriva in igen. */
const WIDTH_FIELD_STEP_MM = sectionParams.shape.width.meta()?.step as number;
const WALL_HEIGHT_FIELD_STEP_MM = sectionParams.shape.wallHeight.meta()?.step as number;
/** Schemats minsta bredd och vägghöjd för en sektion. */
const SECTION_MIN_WIDTH_MM = sectionParams.shape.width.unwrap().minValue ?? 0;
const SECTION_MIN_WALL_HEIGHT_MM = sectionParams.shape.wallHeight.unwrap().minValue ?? 0;

/**
 * Förslag till en ny tillbyggnad, största först, en vägghöjd per bredd.
 * Bredden är 60 % av väggen, eller så bred som marginalen till hörnen
 * tillåter på en kort vägg. Vägghöjden är 60 % av väggens höjd i hörnet
 * (10 mm under den om 60 % är lägre än minsta höjden), men aldrig högre än
 * att taket ryms i kopplingspunkten, som redan ligger 10 mm under värdens tak.
 */
export function listExtensionCandidates(socket: Socket, context: BuildContext): Record<string, unknown>[] {
  const xs = socket.bounds.map((point) => point.x);
  const usableLength = Math.max(...xs) - Math.min(...xs);
  const wallLength = usableLength + 2 * WALL_EDGE_MARGIN_MM;
  const widths = listWidthsDown(Math.min(wallLength * EXTENSION_WALL_SHARE, usableLength));
  const widestFitting = roundDown(usableLength, WIDTH_FIELD_STEP_MM);
  const fittingWidths = widths.length > 0 || widestFitting < SECTION_MIN_WIDTH_MM ? widths : [widestFitting];
  const cornerHeight = measureCornerHeight(socket);
  const shareHeight = cornerHeight * EXTENSION_WALL_SHARE;
  const preferredHeight = shareHeight >= SECTION_MIN_WALL_HEIGHT_MM ? shareHeight : cornerHeight - WALL_EDGE_MARGIN_MM;
  return fittingWidths.flatMap((width) => {
    const params = extensionParams(width, 0);
    const wallHeight = roundDown(Math.min(preferredHeight, findHighestWall(socket, params, context)), WALL_HEIGHT_FIELD_STEP_MM);
    return wallHeight >= SECTION_MIN_WALL_HEIGHT_MM ? [extensionParams(width, wallHeight)] : [];
  });
}

function extensionParams(width: Mm, wallHeight: Mm): SectionParams {
  return {
    width,
    depth: EXTENSION_DEPTH_MM,
    wallHeight,
    roof: 'gable',
    roofPitch: EXTENSION_PITCH_DEGREES,
    eaveOverhang: EXTENSION_OVERHANG_MM,
    gableOverhang: EXTENSION_OVERHANG_MM,
  };
}

/**
 * Den högsta vägghöjden där tillbyggnaden mitt i kopplingspunkten ryms under
 * punktens överkant. Konturen mot väggen räknas med vägghöjden 0, och varje
 * punkt får stiga tills den når överkanten rakt ovanför sig.
 */
function findHighestWall(socket: Socket, params: SectionParams, context: BuildContext): Mm {
  const outline = sectionSocketOutline(params, { ...context, socket });
  return Math.min(...outline.map((point) => findTopOfBounds(socket.bounds, point.x) - point.y));
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

/**
 * Väggens höjd i hörnet, utan marginalen: gavelns långväggshöjd eller
 * långväggens takfot. Överkanten förlängs ut till hörnet, eftersom den på en
 * gavel stiger mot nocken.
 */
function measureCornerHeight(socket: Socket): Mm {
  const halfLength = Math.max(...socket.bounds.map((point) => point.x));
  const cornerTop = findTopOfBounds(socket.bounds, halfLength);
  const slope = (cornerTop - findTopOfBounds(socket.bounds, halfLength - WALL_EDGE_MARGIN_MM)) / WALL_EDGE_MARGIN_MM;
  return cornerTop + slope * WALL_EDGE_MARGIN_MM + WALL_EDGE_MARGIN_MM;
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
