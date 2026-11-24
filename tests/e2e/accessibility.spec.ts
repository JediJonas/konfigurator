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
    // Elementen står med i felet, så att ett fel i CI går att spåra utan att köra om.
    const violations = await page.evaluate(async (tags) => {
      type AxeResult = { violations: { id: string; nodes: { target: string[] }[] }[] };
      const axe = (window as unknown as { axe: { run: (context: Document, options: object) => Promise<AxeResult> } }).axe;
      const { violations: found } = await axe.run(document, { runOnly: tags });
      return found.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
    }, WCAG_TAGS);
    expect(violations).toEqual([]);
  });
}
