import { expect, test } from '@playwright/test';

/** Luft mellan sista knappen och skärmens nederkant på pekskärm, se CLAUDE.md. */
const BOTTOM_GAP_PX = 16;

test('laddar ner en ritning som PDF', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Ladda ner ritning (PDF)' }).click()]);
  expect(download.suggestedFilename()).toBe('ritning.pdf');
  const path = await download.path();
  expect(path).toBeTruthy();
});

test('ändrar huset när ett mått ändras', async ({ page }) => {
  await page.goto('/');
  const width = page.getByLabel('Gavelbredd');
  await width.fill('500');
  await expect(page.getByText('Välj ett värde mellan 60 och 400.')).toBeVisible();
  await width.fill('200');
  await expect(width).toHaveAttribute('aria-invalid', 'false');
});

test('bygger till huset och laddar ner ritningen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByLabel('Vägg', { exact: true }).selectOption({ label: 'S1 · framgavel' });
  await page.getByRole('button', { name: 'Lägg till tillbyggnad' }).click();
  await expect(page.getByRole('heading', { name: 'Sektion S2' })).toBeVisible();
  await expect(page.getByText('Sitter på S1 · framgavel')).toBeVisible();

  const offset = page.getByLabel('Läge längs väggen (0 = mitten)');
  await offset.fill('200');
  await offset.blur();
  await expect(offset).not.toHaveValue('200');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Ladda ner ritning (PDF)' }).click()]);
  expect(download.suggestedFilename()).toBe('ritning.pdf');

  await page.getByRole('button', { name: 'Ta bort S2' }).click();
  await expect(page.getByRole('heading', { name: 'Sektion S2' })).toHaveCount(0);
});

test('stoppar ritningen när en tillbyggnad inte ryms', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Lägg till tillbyggnad' }).click();
  await page.getByLabel('Vägghöjd').nth(1).fill('150');
  await expect(page.getByText(/Tillbyggnaden ryms inte på väggen/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ladda ner ritning (PDF)' })).toBeDisabled();
});

test.describe('pekskärm', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

  test('har knapparna 16 px ovanför nederkanten', async ({ page }) => {
    await page.goto('/');
    const bottom = await page.getByRole('button', { name: 'Ladda ner ritning (PDF)' }).evaluate((button) => button.getBoundingClientRect().bottom);
    const innerHeight = await page.evaluate(() => window.innerHeight);
    expect(bottom).toBeCloseTo(innerHeight - BOTTOM_GAP_PX, 0);
  });

  test('visar inställningarna i ett ark och behåller knapparna nertill', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Visa inställningar' }).click();
    await expect(page.getByLabel('Gavelbredd')).toBeVisible();
    const bottom = await page.getByRole('button', { name: 'Ladda ner ritning (PDF)' }).evaluate((button) => button.getBoundingClientRect().bottom);
    expect(bottom).toBeCloseTo((await page.evaluate(() => window.innerHeight)) - BOTTOM_GAP_PX, 0);
  });
});
