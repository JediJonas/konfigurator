import type { Mm } from '../geometry/vector';
import { boundsHeight, boundsOf, boundsWidth } from '../geometry/polygon';
import type { PartGroup } from '../layout/partGroups';
import type { PaperFormat } from '../layout/paper';
import { PAGE_MARGIN_MM } from '../layout/paper';
import { coreStrings } from '../text/strings.sv';
import type { PageNumbering, ResolveLabel } from './drawingSvg';
import { renderFooter } from './pageFurniture';
import { escapeXml, SMALL_TEXT_SIZE_MM, svgDocument, text } from './svgElements';

export interface OverviewContent {
  title: string;
  groups: PartGroup[];
  materialLabel: string;
  thickness: Mm;
  /** Byggsteg i ordning, med texten för steget. */
  buildSteps: { step: number; label: string }[];
  /** Domänens råd, t.ex. hur fogarna görs. */
  notes: string[];
  /** Bild av modellen som data-URL (PNG). Saknas i tester och när bilden inte gick att ta. */
  overviewImage?: { dataUrl: string; aspectRatio: number };
}

const LINE_HEIGHT_MM = 5.5;
const SECTION_GAP_MM = 6;
const IMAGE_MAX_HEIGHT_MM = 90;
const TABLE_COLUMNS_MM = [0, 12, 70, 90] as const;

/** Första sidan: översiktsbild, dellista och byggordning. */
export function renderOverviewSvg(content: OverviewContent, paper: PaperFormat, numbering: PageNumbering, resolveLabel: ResolveLabel): string {
  const left = PAGE_MARGIN_MM;
  const contentWidth = paper.width - 2 * PAGE_MARGIN_MM;
  const parts: string[] = [text({ x: left, y: PAGE_MARGIN_MM + 6 }, content.title, { size: 7, isBold: true })];
  let y = PAGE_MARGIN_MM + 13;
  parts.push(text({ x: left, y }, coreStrings.overviewTitle + ' · ' + coreStrings.materialLine(content.materialLabel, content.thickness)));
  y += SECTION_GAP_MM;

  if (content.overviewImage) {
    const height = Math.min(IMAGE_MAX_HEIGHT_MM, contentWidth / content.overviewImage.aspectRatio);
    const width = height * content.overviewImage.aspectRatio;
    parts.push(`<image x="${left}" y="${y}" width="${width}" height="${height}" href="${escapeXml(content.overviewImage.dataUrl)}"/>`);
    y += height + SECTION_GAP_MM;
  }

  y += LINE_HEIGHT_MM;
  parts.push(text({ x: left, y }, coreStrings.partListTitle, { size: 5, isBold: true }));
  y += LINE_HEIGHT_MM + 1;
  parts.push(renderTableRow(left, y, [...coreStrings.partListHeaders], true));
  for (const group of content.groups) {
    y += LINE_HEIGHT_MM;
    const bounds = boundsOf(group.outline);
    const name = resolveLabel(group.labelKey) + (group.isMirrored ? ` (${coreStrings.mirrored})` : '');
    const row = [String(group.number), name, String(group.count), coreStrings.dimensions(boundsWidth(bounds), boundsHeight(bounds))];
    parts.push(renderTableRow(left, y, row, false));
  }

  y += LINE_HEIGHT_MM + SECTION_GAP_MM;
  parts.push(text({ x: left, y }, coreStrings.buildOrderTitle, { size: 5, isBold: true }));
  content.buildSteps.forEach((step, index) => {
    y += LINE_HEIGHT_MM;
    const numbers = content.groups.filter((group) => group.buildStep === step.step).map((group) => group.number);
    parts.push(text({ x: left, y }, `${index + 1}. ${step.label} (del ${numbers.join(', ')})`));
  });

  for (const note of content.notes) {
    y += LINE_HEIGHT_MM;
    parts.push(text({ x: left, y }, note, { size: SMALL_TEXT_SIZE_MM }));
  }
  parts.push(text({ x: left, y: y + LINE_HEIGHT_MM }, coreStrings.totalParts(totalCount(content.groups)), { size: SMALL_TEXT_SIZE_MM }));
  parts.push(renderFooter(paper, numbering.pageNumber, numbering.pageCount));
  return svgDocument(paper.width, paper.height, parts.join(''));
}

function renderTableRow(left: Mm, y: Mm, cells: string[], isHeader: boolean): string {
  return cells.map((cell, index) => text({ x: left + (TABLE_COLUMNS_MM[index] ?? 0), y }, cell, { isBold: isHeader })).join('');
}

function totalCount(groups: PartGroup[]): number {
  return groups.reduce((sum, group) => sum + group.count, 0);
}
