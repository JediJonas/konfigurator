import type { Polygon } from '../geometry/polygon';
import { boundsHeight, boundsOf, boundsWidth, rotatePolygonQuarter, translatePolygon } from '../geometry/polygon';
import type { Mm, Vec2 } from '../geometry/vector';
import type { PartGroup } from './partGroups';
import type { PaperFormat, Rect } from './paper';
import { drawableArea } from './paper';

/** Överlappning mellan sidor när en del är större än en sida, SPEC.md avsnitt 9. */
export const TILE_OVERLAP_MM = 10;
/** Plats ovanför varje del för nummer, namn och antal. */
export const LABEL_BLOCK_MM = 12;
/** Luft mellan delar på samma sida. */
export const PART_SPACING_MM = 6;

/** En del (eller en bit av en del) placerad på en sida. Koordinater i mm med y nedåt. */
export interface PlacedShape {
  group: PartGroup;
  outline: Polygon;
  holes: Polygon[];
  isRotated: boolean;
  /** Var etiketten börjar. Saknas för bitar av stora delar; de har etiketten i sidfoten. */
  labelAt?: Vec2;
  tile?: TileInfo;
}

export interface TileInfo {
  index: number;
  total: number;
  column: number;
  row: number;
  /** Streckade skarvlinjer, mitt i överlappningen mot grannbitarna. */
  joinLines: { from: Vec2; to: Vec2 }[];
  clip: Rect;
}

export interface PartsPage {
  shapes: PlacedShape[];
}

interface Piece {
  group: PartGroup;
  outline: Polygon;
  holes: Polygon[];
  isRotated: boolean;
  width: Mm;
  height: Mm;
}

/** Fördelar delarna på sidor: små delar packas i hyllor, stora delas upp i bitar med överlappning. */
export function layoutPartPages(groups: readonly PartGroup[], paper: PaperFormat): PartsPage[] {
  const area = drawableArea(paper);
  const pieces = groups.map((group) => orientPiece(group, area));
  const fitting = pieces.filter((piece) => fitsOnPage(piece, area));
  const oversized = pieces.filter((piece) => !fitsOnPage(piece, area));
  return [...packOnShelves(fitting, area), ...oversized.flatMap((piece) => tilePiece(piece, area))];
}

function fitsOnPage(piece: Piece, area: Rect): boolean {
  return piece.width <= area.width && piece.height + LABEL_BLOCK_MM <= area.height;
}

/** Vrider delen 90° om den då ryms på en sida, eller på färre sidor. */
function orientPiece(group: PartGroup, area: Rect): Piece {
  const upright = toPiece(group, group.outline, group.holes, false);
  const turned = toPiece(group, rotatePolygonQuarter(group.outline), group.holes.map(rotatePolygonQuarter), true);
  return countTiles(turned, area) < countTiles(upright, area) ? turned : upright;
}

function toPiece(group: PartGroup, outline: Polygon, holes: Polygon[], isRotated: boolean): Piece {
  // Flyttar till origo igen och vänder y, eftersom sidan har y nedåt.
  const bounds = boundsOf(outline);
  const flip = (polygon: Polygon) => polygon.map((p) => ({ x: p.x - bounds.minX, y: bounds.maxY - p.y }));
  return { group, outline: flip(outline), holes: holes.map(flip), isRotated, width: boundsWidth(bounds), height: boundsHeight(bounds) };
}

function countTiles(piece: Piece, area: Rect): number {
  if (fitsOnPage(piece, area)) return 1;
  return tileCount(piece.width, area.width) * tileCount(piece.height, area.height);
}

function tileCount(length: Mm, window: Mm): number {
  return Math.max(1, Math.ceil((length - TILE_OVERLAP_MM) / (window - TILE_OVERLAP_MM)));
}

function packOnShelves(pieces: Piece[], area: Rect): PartsPage[] {
  const pages: PartsPage[] = [];
  let page: PartsPage = { shapes: [] };
  let cursor = { x: 0, y: 0 };
  let shelfHeight = 0;
  const sorted = [...pieces].sort((a, b) => b.height - a.height);
  for (const piece of sorted) {
    const itemHeight = piece.height + LABEL_BLOCK_MM;
    if (cursor.x > 0 && cursor.x + piece.width > area.width) {
      cursor = { x: 0, y: cursor.y + shelfHeight + PART_SPACING_MM };
      shelfHeight = 0;
    }
    if (cursor.y > 0 && cursor.y + itemHeight > area.height) {
      pages.push(page);
      page = { shapes: [] };
      cursor = { x: 0, y: 0 };
      shelfHeight = 0;
    }
    const origin = { x: area.x + cursor.x, y: area.y + cursor.y };
    page.shapes.push(placePiece(piece, { x: origin.x, y: origin.y + LABEL_BLOCK_MM }, origin));
    cursor = { x: cursor.x + piece.width + PART_SPACING_MM, y: cursor.y };
    shelfHeight = Math.max(shelfHeight, itemHeight);
  }
  if (page.shapes.length > 0) pages.push(page);
  return pages;
}

function placePiece(piece: Piece, offset: Vec2, labelAt?: Vec2): PlacedShape {
  return {
    group: piece.group,
    outline: translatePolygon(piece.outline, offset),
    holes: piece.holes.map((hole) => translatePolygon(hole, offset)),
    isRotated: piece.isRotated,
    labelAt,
  };
}

function tilePiece(piece: Piece, area: Rect): PartsPage[] {
  const columns = tileCount(piece.width, area.width);
  const rows = tileCount(piece.height, area.height);
  const step = { x: area.width - TILE_OVERLAP_MM, y: area.height - TILE_OVERLAP_MM };
  const pages: PartsPage[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const offset = { x: area.x - column * step.x, y: area.y - row * step.y };
      const tile: TileInfo = {
        index: pages.length + 1,
        total: columns * rows,
        column,
        row,
        joinLines: joinLinesFor({ column, row, columns, rows }, area),
        clip: area,
      };
      pages.push({ shapes: [{ ...placePiece(piece, offset), tile }] });
    }
  }
  return pages;
}

function joinLinesFor(position: { column: number; row: number; columns: number; rows: number }, area: Rect): TileInfo['joinLines'] {
  const half = TILE_OVERLAP_MM / 2;
  const left = area.x + half;
  const right = area.x + area.width - half;
  const top = area.y + half;
  const bottom = area.y + area.height - half;
  const lines: TileInfo['joinLines'] = [];
  if (position.column > 0) lines.push({ from: { x: left, y: area.y }, to: { x: left, y: area.y + area.height } });
  if (position.column < position.columns - 1) lines.push({ from: { x: right, y: area.y }, to: { x: right, y: area.y + area.height } });
  if (position.row > 0) lines.push({ from: { x: area.x, y: top }, to: { x: area.x + area.width, y: top } });
  if (position.row < position.rows - 1) lines.push({ from: { x: area.x, y: bottom }, to: { x: area.x + area.width, y: bottom } });
  return lines;
}
