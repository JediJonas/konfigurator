import { boundsHeight, boundsOf, boundsWidth } from '../geometry/polygon';
import type { Vec2 } from '../geometry/vector';
import type { PartsPage, PlacedShape } from '../layout/pageLayout';
import type { PartGroup } from '../layout/partGroups';
import type { PaperFormat } from '../layout/paper';
import { coreStrings } from '../text/strings.sv';
import { renderFooter } from './pageFurniture';
import { CUT_LINE_MM, line, polygonPath, SMALL_TEXT_SIZE_MM, svgDocument, text, THIN_LINE_MM } from './svgElements';

export type ResolveLabel = (key: string) => string;
/** Delens namn på ritningen, se `describeGroup`. */
export type NameGroup = (group: PartGroup) => string;

const JOIN_CROSS_MM = 4;
const JOIN_CROSS_COUNT = 3;
const JOIN_DASH = '3 2';
const TILE_BADGE_TEXT_MM = 8;

export interface PageNumbering {
  pageNumber: number;
  pageCount: number;
}

/** En sida med delar i skala 1:1 som SVG i millimeter. */
export function renderPartsPageSvg(page: PartsPage, paper: PaperFormat, numbering: PageNumbering, nameGroup: NameGroup): string {
  const tiled = page.shapes.find((shape) => shape.tile);
  const note = tiled?.tile ? tileNote(tiled, nameGroup) : undefined;
  const body = [
    ...page.shapes.map((shape, index) => renderShape(shape, index, nameGroup)),
    renderFooter(paper, numbering.pageNumber, numbering.pageCount, note),
  ].join('');
  return svgDocument(paper.width, paper.height, body);
}

function renderShape(shape: PlacedShape, index: number, nameGroup: NameGroup): string {
  const path = `<path d="${polygonPath([shape.outline, ...shape.holes])}" fill="none" stroke="#000" stroke-width="${CUT_LINE_MM}" fill-rule="evenodd"/>`;
  if (!shape.tile) return path + (shape.labelAt ? renderLabel(shape, shape.labelAt, nameGroup) : '');
  const { clip } = shape.tile;
  const clipId = `tile-${index}`;
  return [
    `<clipPath id="${clipId}"><rect x="${clip.x}" y="${clip.y}" width="${clip.width}" height="${clip.height}"/></clipPath>`,
    `<g clip-path="url(#${clipId})">${path}</g>`,
    ...shape.tile.joinLines.map((join) => renderJoin(join.from, join.to)),
    renderNumberBadge(shape, { x: clip.x + clip.width / 2, y: clip.y + clip.height / 2 }),
  ].join('');
}

function partTitle(shape: PlacedShape, nameGroup: NameGroup): string {
  return `${shape.group.number}. ${nameGroup(shape.group)}`;
}

function partDetails(shape: PlacedShape): string {
  const bounds = boundsOf(shape.outline);
  return [coreStrings.cutCount(shape.group.count, shape.group.mirroredCount), coreStrings.dimensions(boundsWidth(bounds), boundsHeight(bounds))].join(', ');
}

function renderLabel(shape: PlacedShape, at: Vec2, nameGroup: NameGroup): string {
  return (
    text({ x: at.x, y: at.y + 4 }, partTitle(shape, nameGroup), { isBold: true }) +
    text({ x: at.x, y: at.y + 8.5 }, partDetails(shape), { size: SMALL_TEXT_SIZE_MM })
  );
}

/** Stort nummer mitt på varje bit, så att bitarna går att para ihop efter utskrift. */
function renderNumberBadge(shape: PlacedShape, center: Vec2): string {
  const tile = shape.tile;
  if (!tile) return '';
  const position = `${String.fromCharCode(65 + tile.row)}${tile.column + 1}`;
  return text(center, `${shape.group.number} · ${position}`, { size: TILE_BADGE_TEXT_MM, anchor: 'middle', isBold: true, color: '#999' });
}

function tileNote(shape: PlacedShape, nameGroup: NameGroup): string {
  const tile = shape.tile;
  if (!tile) return '';
  return `${partTitle(shape, nameGroup)}, ${coreStrings.tileOf(tile.index, tile.total)}, ${partDetails(shape)}`;
}

function renderJoin(from: Vec2, to: Vec2): string {
  const marks = [line(from, to, { dashArray: JOIN_DASH })];
  for (let i = 1; i <= JOIN_CROSS_COUNT; i++) {
    const t = i / (JOIN_CROSS_COUNT + 1);
    const center = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    const half = JOIN_CROSS_MM / 2;
    marks.push(line({ x: center.x - half, y: center.y }, { x: center.x + half, y: center.y }, { width: THIN_LINE_MM * 2 }));
    marks.push(line({ x: center.x, y: center.y - half }, { x: center.x, y: center.y + half }, { width: THIN_LINE_MM * 2 }));
  }
  return marks.join('');
}
