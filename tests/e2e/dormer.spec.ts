import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test('lägger en takkupa på taket och visar den under Tak', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openWall(page, 'Tak');
  await page.getByRole('button', { name: 'Lägg till takkupa på takfall mot vägg 2' }).click();
  await expect(page.getByRole('heading', { name: 'Takkupa K1' })).toBeVisible();
  await expect(page.getByText('Sitter på S1 · takfall mot vägg 2')).toBeVisible();
  await expect(page.getByLabel('Läge längs taket (0 = mitten)')).toHaveValue('0');
  await expect(page.getByLabel(/^Avstånd från takfoten/)).toBeVisible();
  // Kupan sitter under Tak, inte som en egen sektion på toppnivån.
  await expect(page.locator('[data-group-key="group.roof"]').getByRole('heading', { name: 'Takkupa K1' })).toBeVisible();

  // Fältet ger bara lägen där kupan har 15 mm helt tak mot takfoten.
  const eaveDistance = page.getByLabel(/^Avstånd från takfoten/);
  await eaveDistance.fill('0');
  await eaveDistance.blur();
  await expect(eaveDistance).toHaveValue('15');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Ladda ner ritning (PDF)' }).click()]);
  expect(download.suggestedFilename()).toBe('ritning.pdf');
  await page.getByRole('button', { name: 'Ta bort K1' }).click();
  await expect(page.getByRole('heading', { name: 'Takkupa K1' })).toHaveCount(0);
});

async function openWall(page: Page, name: string) {
  const wall = page.getByRole('button', { name, exact: true });
  if ((await wall.getAttribute('aria-expanded')) !== 'true') await wall.click();
}
