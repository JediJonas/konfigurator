import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const colorScheme of ['light', 'dark'] as const) {
  test(`uppfyller WCAG 2.2 AA i ${colorScheme === 'light' ? 'ljust' : 'mörkt'} läge`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await page.addScriptTag({ content: axeSource });
    const violations = await page.evaluate(async (tags) => {
      const axe = (window as unknown as { axe: { run: (context: Document, options: object) => Promise<{ violations: { id: string }[] }> } }).axe;
      return (await axe.run(document, { runOnly: tags })).violations.map((violation) => violation.id);
    }, WCAG_TAGS);
    expect(violations).toEqual([]);
  });
}
