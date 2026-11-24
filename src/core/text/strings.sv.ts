/** Kärnans egna texter. Domänens texter ligger i domänpaketet. */
export const coreStrings = {
  printAtActualSize: 'Skriv ut i faktisk storlek / 100 %',
  rulerLabel: 'Kontroll: 10 cm',
  pageOf: (page: number, total: number) => `Sida ${page} av ${total}`,
  cutCount: (count: number) => `skär ${count} st`,
  mirrored: 'spegelvänd',
  dimensions: (width: number, height: number) => `${Math.round(width)} × ${Math.round(height)} mm`,
  tileOf: (tile: number, total: number) => `bit ${tile} av ${total}`,
  tileHint: 'Lägg bitarna omlott så att de streckade linjerna och kryssen möts.',
  overviewTitle: 'Ritning i skala 1:1',
  partListTitle: 'Delar',
  partListHeaders: ['Nr', 'Del', 'Antal', 'Mått'] as const,
  buildOrderTitle: 'Byggordning',
  totalParts: (count: number) => `Totalt ${count} delar att skära ut.`,
  openingSplitsPart: 'Öppningen skulle dela väggen i flera bitar.',
  noSizeFits: 'Kopplingspunkten är för liten för objektet.',
  cannotAttachHere: 'Objektet kan inte sitta i den här kopplingspunkten.',
  materialLine: (material: string, thickness: number) => `Material: ${material}, ${formatMm(thickness)} mm tjockt`,
} as const;

/** Svenska decimaltecken, högst en decimal. */
export function formatMm(value: number): string {
  return (Math.round(value * 10) / 10).toString().replace('.', ',');
}
