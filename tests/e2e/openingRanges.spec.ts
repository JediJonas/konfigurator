import { expect, test } from '@playwright/test';

test('fönstrets fält stannar där fönstret inte går att bygga, även när sektionen är öppen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Vägg 2', exact: true }).click();
  await page.getByRole('button', { name: 'Lägg till fönster' }).click();
  const window = page.locator('[data-instance-id="F1"]');
  const width = window.getByLabel(/^Bredd/);
  // Väggen är 180 mm; fönstret behöver 15 mm hel vägg på var sida.
  await expect(width).toHaveAttribute('max', '140');
  await expect(window.getByLabel(/^Höjd över golvet/)).not.toHaveAttribute('max', '300');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
