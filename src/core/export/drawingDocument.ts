import type { Part } from '../model/part';
import { layoutPartPages } from '../layout/pageLayout';
import { groupIdenticalParts } from '../layout/partGroups';
import type { PaperFormat } from '../layout/paper';
import type { ResolveLabel } from './drawingSvg';
import { renderPartsPageSvg } from './drawingSvg';
import type { OverviewContent } from './overviewSvg';
import { renderOverviewSvg } from './overviewSvg';

export interface DrawingRequest {
  parts: readonly Part[];
  paper: PaperFormat;
  resolveLabel: ResolveLabel;
  overview: Omit<OverviewContent, 'groups'>;
}

/** Hela ritningen som en SVG per sida i skala 1:1: översikt först, sedan delarna. */
export function buildDrawingPages(request: DrawingRequest): string[] {
  const groups = groupIdenticalParts(request.parts);
  const partPages = layoutPartPages(groups, request.paper);
  const pageCount = partPages.length + 1;
  const overview = renderOverviewSvg({ ...request.overview, groups }, request.paper, { pageNumber: 1, pageCount }, request.resolveLabel);
  const drawings = partPages.map((page, index) =>
    renderPartsPageSvg(page, request.paper, { pageNumber: index + 2, pageCount }, request.resolveLabel),
  );
  return [overview, ...drawings];
}
