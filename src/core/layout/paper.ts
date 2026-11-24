import type { Mm } from '../geometry/vector';

export interface PaperFormat {
  id: 'A4' | 'A3';
  /** Stående. */
  width: Mm;
  height: Mm;
}

export const PAPER_FORMATS: Record<PaperFormat['id'], PaperFormat> = {
  A4: { id: 'A4', width: 210, height: 297 },
  A3: { id: 'A3', width: 297, height: 420 },
};

/** De flesta skrivare kan inte skriva ända ut till kanten. */
export const PAGE_MARGIN_MM = 10;
/** Utrymme längst ner för kontrollinjal, utskriftstext och sidnummer. */
export const PAGE_FOOTER_MM = 20;

export interface Rect {
  x: Mm;
  y: Mm;
  width: Mm;
  height: Mm;
}

/** Ytan där delar ritas, i sidans koordinater (mm, y nedåt). */
export function drawableArea(paper: PaperFormat): Rect {
  return {
    x: PAGE_MARGIN_MM,
    y: PAGE_MARGIN_MM,
    width: paper.width - 2 * PAGE_MARGIN_MM,
    height: paper.height - 2 * PAGE_MARGIN_MM - PAGE_FOOTER_MM,
  };
}
