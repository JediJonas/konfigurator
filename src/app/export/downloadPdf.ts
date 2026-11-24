import type { PaperFormat } from '../../core/layout/paper';

/**
 * Gör PDF av ritningens SVG-sidor. jsPDF och svg2pdf laddas först här, så att
 * appen startar snabbt i mobilen över långsamma nät.
 */
export async function downloadDrawingPdf(pages: string[], paper: PaperFormat, fileName: string): Promise<void> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const pdf = new jsPDF({ unit: 'mm', format: [paper.width, paper.height], orientation: 'portrait' });
  const parser = new DOMParser();
  for (const [index, page] of pages.entries()) {
    if (index > 0) pdf.addPage([paper.width, paper.height], 'portrait');
    const svg = parser.parseFromString(page, 'image/svg+xml').documentElement;
    await svg2pdf(svg, pdf, { x: 0, y: 0, width: paper.width, height: paper.height });
  }
  pdf.save(fileName);
}
