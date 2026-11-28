import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const colorScheme of ['light', 'dark'] as const) {
  test(`uppfyller WCAG 2.2 AA i ${colorScheme === 'light' ? 'ljust' : 'mörkt'} läge`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    expect(await listAxeViolations(page)).toEqual([]);
  });

  test(`uppfyller WCAG 2.2 AA med en vägg och ett fönster öppna i ${colorScheme === 'light' ? 'ljust' : 'mörkt'} läge`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await page.getByRole('button', { name: 'Vägg 2', exact: true }).click();
    await page.getByRole('button', { name: 'Lägg till fönster' }).click();
    await expect(page.getByRole('heading', { name: 'Fönster F1' })).toBeVisible();
    expect(await listAxeViolations(page)).toEqual([]);
  });

  test(`uppfyller WCAG 2.2 AA med Mina hus öppen i ${colorScheme === 'light' ? 'ljust' : 'mörkt'} läge`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    await page.goto('/');
    await page.getByRole('button', { name: 'Mina hus', exact: true }).click();
    await page.getByLabel('Namn', { exact: true }).fill('Kyrkan');
    await page.getByRole('button', { name: 'Spara', exact: true }).click();
    await page.getByRole('button', { name: 'Byt namn på Kyrkan' }).click();
    await page.getByRole('button', { name: 'Dela länk' }).click();
    await expect(page.getByLabel('Länk till huset')).toBeVisible();
    expect(await listAxeViolations(page)).toEqual([]);
    await context.close();
  });
}

/** Felen enligt axe. Elementen står med i felet, så att ett fel i CI går att spåra utan att köra om. */
async function listAxeViolations(page: Page): Promise<string[]> {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async (tags) => {
    type AxeResult = { violations: { id: string; nodes: { target: string[] }[] }[] };
    const axe = (window as unknown as { axe: { run: (context: Document, options: object) => Promise<AxeResult> } }).axe;
    const { violations: found } = await axe.run(document, { runOnly: tags });
    return found.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
  }, WCAG_TAGS);
}
