import { clipByHalfPlanes } from '../../../../core/geometry/halfPlane';
import type { Polygon } from '../../../../core/geometry/polygon';
import { boundsHeight, boundsOf, boundsWidth } from '../../../../core/geometry/polygon';
import type { Mm, Vec2, Vec3 } from '../../../../core/geometry/vector';
import { vec2, vec3 } from '../../../../core/geometry/vector';

/** Formerna på dörrar i bokstavsordning efter namnen (ägarens val): Fyrkantigt, Rundbåge och Spetsbåge. */
export const DOOR_SHAPES = ['rect', 'arch', 'pointed'] as const;
/**
 * Formerna på fönster i bokstavsordning efter namnen (ägarens val): Fyrkantigt,
 * Halvmåne, Rundbåge, Runt, Snedskuret, Spetsbåge och Trekantigt.
 */
export const WINDOW_SHAPES = ['rect', 'halfMoon', 'arch', 'circle', 'slanted', 'pointed', 'triangle'] as const;
export type OpeningShape = (typeof WINDOW_SHAPES)[number];

/** Så många raka bitar rundbågen ritas med. Fler ger en jämnare båge men fler hörn att skära. */
const ARCH_SEGMENTS = 16;
/** Spröjsens bredd, så att de håller när degen bakas. */
export const MULLION_WIDTH_MM = 5;
/**
 * Spetsbågen är två cirkelbågar med radien lika med öppningens bredd, som
 * möts i en spets mitt över (en liksidig spetsbåge). Den är då √3/2 av bredden hög.
 */
const POINTED_RISE_PER_WIDTH = Math.sqrt(3) / 2;
/** Snedskurna fönster sjunker så här mycket per mm åt vänster, en lutning på cirka 27°. */
const SLANT_DROP_PER_WIDTH = 0.5;
/**
 * En ruta ska vara minst lika bred och hög som spröjsen (ägarens val). Ett
 * fönster där rutnätet ger mindre rutor går inte att bygga (`arePanesBigEnough`),
 * och en ruta som klipps mindre av formen, t.ex. i spetsen på ett trekantigt
 * fönster, skärs inte utan blir vägg.
 */
const MIN_PANE_SIZE_MM = MULLION_WIDTH_MM;

/** En öppning i objektets eget koordinatsystem: x längs väggen från mitten, y uppåt från golvet. */
export interface OpeningSize {
  shape: OpeningShape;
  width: Mm;
  height: Mm;
  /** Underkantens höjd över golvet. */
  bottom: Mm;
  /** Snedskuret och trekantigt speglade åt andra hållet. */
  isInverted?: boolean;
}

/**
 * Öppningens kontur moturs. Rundbågen är en halv ellips över hela bredden,
 * en halvcirkel när öppningen är minst hälften så hög som bred. Den runda
 * öppningen är en ellips i rutan, och halvmånen en halv ellips från underkanten.
 * Fönstret ger dem mått som gör dem till en cirkel och en halvcirkel (`windowSizeOf`).
 */
export function openingOutline(size: OpeningSize): Vec2[] {
  const { width, height, bottom } = size;
  const half = width / 2;
  const top = bottom + height;
  if (size.shape === 'rect') return [vec2(-half, bottom), vec2(half, bottom), vec2(half, top), vec2(-half, top)];
  if (size.shape === 'circle') return ellipseOutline(half, height / 2, bottom + height / 2);
  if (size.shape === 'triangle') return invertIf(size, [vec2(-half, bottom), vec2(half, bottom), vec2(half, top)]);
  if (size.shape === 'slanted') return invertIf(size, slantedOutline(half, bottom, top));
  if (size.shape === 'pointed') return pointedOutline(half, bottom, top);
  const rise = size.shape === 'halfMoon' ? height : Math.min(half, height);
  const spring = top - rise;
  const arch = Array.from({ length: ARCH_SEGMENTS + 1 }, (_, index) => {
    const angle = (Math.PI * index) / ARCH_SEGMENTS;
    return vec2(half * Math.cos(angle), spring + rise * Math.sin(angle));
  });
  // Bågen går från höger ände över till vänster. Är öppningen bara båge sluter nederkanten den.
  return spring > bottom ? [vec2(-half, bottom), vec2(half, bottom), ...arch] : arch;
}

/** Formen speglad åt andra hållet (Invertera), med hörnen kvar moturs. */
function invertIf(size: OpeningSize, outline: Vec2[]): Vec2[] {
  return size.isInverted ? outline.map((point) => vec2(-point.x, point.y)).reverse() : outline;
}

/** Hur mycket lägre den vänstra sidan av ett snedskuret fönster är än den högra. */
function slantDrop(width: Mm, height: Mm): Mm {
  return Math.min(width * SLANT_DROP_PER_WIDTH, height / 2);
}

/**
 * Rak underkant och sidor, med överkanten snedskuren nedåt åt vänster. Den
 * vänstra sidan blir hälften så lång som bredden kortare, men aldrig kortare än
 * halva höjden, så att formen går att skära även när fönstret är lågt och brett.
 */
function slantedOutline(half: Mm, bottom: Mm, top: Mm): Vec2[] {
  const drop = slantDrop(2 * half, top - bottom);
  return [vec2(-half, bottom), vec2(half, bottom), vec2(half, top), vec2(-half, top - drop)];
}

/**
 * Öppningens höjd på den lodräta mittlinjen. Rutorna delas upp efter den, så
 * att korset hamnar på samma höjd i alla rutor (ägarens val): trekantigt är
 * hälften så högt där som vid sin höga sida, och snedskuret så högt som medelvärdet av sidorna.
 */
export function heightAtCenter(size: OpeningSize): Mm {
  if (size.shape === 'triangle') return size.height / 2;
  if (size.shape === 'slanted') return size.height - slantDrop(size.width, size.height) / 2;
  return size.height;
}

/**
 * Raka sidor upp till en liksidig spetsbåge. Är öppningen lägre än bågen
 * trycks bågen ihop på höjden, så att spetsen alltid når fönstrets höjd.
 */
function pointedOutline(half: Mm, bottom: Mm, top: Mm): Vec2[] {
  const width = 2 * half;
  const fullRise = width * POINTED_RISE_PER_WIDTH;
  const rise = Math.min(fullRise, top - bottom);
  const spring = top - rise;
  const squash = rise / fullRise;
  const sweep = Math.PI / 3;
  // Högra bågen har sin medelpunkt i vänstra hörnet och går från höger hörn upp till spetsen; den vänstra speglar den.
  const right = Array.from({ length: ARCH_SEGMENTS / 2 + 1 }, (_, index) => {
    const angle = (sweep * index) / (ARCH_SEGMENTS / 2);
    return vec2(-half + width * Math.cos(angle), spring + width * Math.sin(angle) * squash);
  });
  const left = right.slice(0, -1).reverse().map((point) => vec2(-point.x, point.y));
  const arch = [...right, ...left];
  // Bågen går från höger hörn över spetsen till vänster hörn. Är öppningen bara båge sluter nederkanten den.
  return spring > bottom ? [vec2(-half, bottom), vec2(half, bottom), ...arch] : arch;
}

/** En hel ellips runt (0, centerY), moturs, med lika många bitar per halva som rundbågen. */
function ellipseOutline(radiusX: Mm, radiusY: Mm, centerY: Mm): Vec2[] {
  const segments = 2 * ARCH_SEGMENTS;
  return Array.from({ length: segments }, (_, index) => {
    const angle = (2 * Math.PI * index) / segments;
    return vec2(radiusX * Math.cos(angle), centerY + radiusY * Math.sin(angle));
  });
}

/** Spröjsen: inga, eller så många rutor som öppningen delas i. */
export const MULLION_STYLES = ['none', 'two', 'four', 'six'] as const;
export type MullionStyle = (typeof MULLION_STYLES)[number];

/**
 * Rutornas rutnät: två rutor har en lodrät spröjs i mitten, fyra ett kors och
 * sex en lodrät spröjs och två vågräta, så att rutorna blir stående (ägarens val av antal).
 */
const PANE_GRIDS: Record<Exclude<MullionStyle, 'none'>, { columns: number; rows: number }> = {
  two: { columns: 2, rows: 1 },
  four: { columns: 2, rows: 2 },
  six: { columns: 2, rows: 3 },
};

/**
 * Rutorna mellan spröjsen: öppningen delad i ett rutnät med jämna avstånd över
 * bredden och, på den lodräta mittlinjen, höjden (`heightAtCenter`), så att spröjsen blir kvar av väggen. Öppningen är konvex,
 * så varje ruta klipps med halvplan. Rutor som blir för små att skära, t.ex. i
 * spetsen på ett trekantigt fönster, hoppas över och blir vägg (`MIN_PANE_SIZE_MM`).
 */
export function listPanes(size: OpeningSize, style: MullionStyle): Vec2[][] {
  const outline = openingOutline(size);
  if (style === 'none') return [outline];
  const { columns, rows } = PANE_GRIDS[style];
  const bar = MULLION_WIDTH_MM / 2;
  const left = -size.width / 2;
  const columnWidth = size.width / columns;
  const edges = listRowEdges(size, style, bar);
  const top = size.bottom + size.height;
  const panes: Vec2[][] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const minX = left + column * columnWidth + (column > 0 ? bar : 0);
      const maxX = left + (column + 1) * columnWidth - (column < columns - 1 ? bar : 0);
      const minY = row > 0 ? size.bottom + edges[row - 1]! + bar : size.bottom;
      // Översta raden går upp till formens överkant, så att rutorna överst inte blir för små där den sluttar.
      const maxY = row < rows - 1 ? size.bottom + edges[row]! - bar : top;
      const pane = clipByHalfPlanes(outline, [
        { normal: vec2(-1, 0), offset: -minX },
        { normal: vec2(1, 0), offset: maxX },
        { normal: vec2(0, -1), offset: -minY },
        { normal: vec2(0, 1), offset: maxY },
      ]);
      if (pane.length >= 3 && isCuttable(pane)) panes.push(pane);
    }
  }
  return panes;
}

/**
 * Höjden över underkanten till mitten av varje vågrät spröjs, nerifrån. Jämnt
 * fördelat på mittlinjens höjd, utom för trekantigt med sex rutor (ägarens val):
 * understa spröjsen ligger i mitten av underdelen, som med fyra rutor, och den
 * ovanför så att understa och mellersta rutan blir lika höga mot den raka sidan.
 */
function listRowEdges(size: OpeningSize, style: MullionStyle, bar: Mm): Mm[] {
  const { rows } = PANE_GRIDS[style as Exclude<MullionStyle, 'none'>];
  const center = heightAtCenter(size);
  if (size.shape === 'triangle' && style === 'six') return [center / 2, center + bar];
  return Array.from({ length: rows - 1 }, (_, index) => ((index + 1) * center) / rows);
}

function isCuttable(pane: Vec2[]): boolean {
  const bounds = boundsOf(pane);
  return boundsWidth(bounds) >= MIN_PANE_SIZE_MM && boundsHeight(bounds) >= MIN_PANE_SIZE_MM;
}

/**
 * Luckorna uppslagna mot väggen: varje halva av öppningen speglad ut åt sitt
 * håll, så att luckan täcker sin halva när den stängs.
 */
export function shutterOutlines(size: OpeningSize): [Vec2[], Vec2[]] {
  const outline = openingOutline(size);
  const half = size.width / 2;
  const left = clipByHalfPlanes(outline, [{ normal: vec2(1, 0), offset: 0 }]);
  const right = clipByHalfPlanes(outline, [{ normal: vec2(-1, 0), offset: 0 }]);
  const mirror = (polygon: Polygon, axis: Mm) => polygon.map((point) => vec2(2 * axis - point.x, point.y)).reverse();
  return [mirror(left, -half), mirror(right, half)];
}

/** En rektangel i väggens plan, som punkter i objektets eget koordinatsystem. */
export function wallRectangle(left: Mm, bottom: Mm, right: Mm, top: Mm): Vec3[] {
  return [vec3(left, bottom, 0), vec3(right, bottom, 0), vec3(right, top, 0), vec3(left, top, 0)];
}

export function toWallPlane(polygon: Polygon): Vec3[] {
  return polygon.map((point) => vec3(point.x, point.y, 0));
}

/**
 * Om rutnätet ger rutor som är minst lika stora som spröjsen (ägarens val),
 * räknat på rutnätet med spröjsens halva bredd bort vid varje spröjs.
 */
export function arePanesBigEnough(size: OpeningSize, style: MullionStyle): boolean {
  if (style === 'none') return true;
  const { columns, rows } = PANE_GRIDS[style];
  const smallestPane = (length: Mm, count: number) => length / count - (count > 2 ? MULLION_WIDTH_MM : MULLION_WIDTH_MM / 2) * (count > 1 ? 1 : 0);
  return smallestPane(size.width, columns) >= MIN_PANE_SIZE_MM && smallestPane(heightAtCenter(size), rows) >= MIN_PANE_SIZE_MM;
}
