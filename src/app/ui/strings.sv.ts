/** Gränssnittets egna texter. Objekt, parametrar och delar får sina texter från domänpaketet. */
export const uiStrings = {
  appName: 'Konfiguratorn',
  viewLabel: '3D-vy av huset',
  viewHint: 'Dra för att vrida, nyp eller scrolla för att zooma.',
  settings: 'Inställningar',
  showSettings: 'Visa inställningar',
  hideSettings: 'Dölj inställningar',
  objects: 'Objekt',
  material: 'Material',
  thickness: 'Tjocklek',
  paper: 'Pappersformat',
  downloadPdf: 'Ladda ner ritning (PDF)',
  creatingPdf: 'Skapar PDF …',
  pdfFailed: 'Det gick inte att skapa PDF:en. Försök igen.',
  invalidDesign: 'Huset går inte att bygga med de här måtten:',
  outOfRange: (min?: number, max?: number) => `Välj ett värde mellan ${min ?? '–'} och ${max ?? '–'}.`,
  pdfFileName: 'ritning.pdf',
} as const;
