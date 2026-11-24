import type { Mm } from '../geometry/vector';
import type { PaperFormat } from '../layout/paper';
import { PAGE_MARGIN_MM } from '../layout/paper';
import { coreStrings } from '../text/strings.sv';
import { line, SMALL_TEXT_SIZE_MM, text } from './svgElements';

/** Kontrollinjalens längd, SPEC.md avsnitt 9. */
export const RULER_LENGTH_MM = 100;
const RULER_TICK_EVERY_MM = 10;
const RULER_TICK_MM = 3;
const RULER_LONG_TICK_MM = 5;

/** Kontrollinjal, utskriftstext och sidnummer längst ner på sidan. */
export function renderFooter(paper: PaperFormat, pageNumber: number, pageCount: number, note?: string): string {
  const baseline = paper.height - PAGE_MARGIN_MM;
  const rulerY = baseline - 9;
  const right = paper.width - PAGE_MARGIN_MM;
  return [
    renderRuler(PAGE_MARGIN_MM, rulerY),
    text({ x: PAGE_MARGIN_MM, y: baseline }, coreStrings.printAtActualSize, { size: SMALL_TEXT_SIZE_MM, isBold: true }),
    text({ x: right, y: baseline }, coreStrings.pageOf(pageNumber, pageCount), { size: SMALL_TEXT_SIZE_MM, anchor: 'end' }),
    note ? text({ x: right, y: rulerY }, note, { size: SMALL_TEXT_SIZE_MM, anchor: 'end' }) : '',
  ].join('');
}

function renderRuler(x: Mm, y: Mm): string {
  const ticks: string[] = [line({ x, y }, { x: x + RULER_LENGTH_MM, y })];
  for (let offset = 0; offset <= RULER_LENGTH_MM; offset += RULER_TICK_EVERY_MM) {
    const isEnd = offset === 0 || offset === RULER_LENGTH_MM;
    const tick = isEnd ? RULER_LONG_TICK_MM : RULER_TICK_MM;
    ticks.push(line({ x: x + offset, y: y - tick }, { x: x + offset, y }));
  }
  ticks.push(text({ x: x + RULER_LENGTH_MM / 2, y: y + 3.5 }, coreStrings.rulerLabel, { size: SMALL_TEXT_SIZE_MM, anchor: 'middle' }));
  return ticks.join('');
}
