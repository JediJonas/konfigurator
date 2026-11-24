import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

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

test('centrerar huset igen efter att man zoomat ut', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto('/');
  const view = page.locator('.viewport canvas');
  await page.waitForTimeout(1500);
  const atStart = await countHousePixels(page);
  await view.hover();
  // OrbitControls zoomar ett steg per hjulhändelse.
  for (let step = 0; step < 12; step++) await page.mouse.wheel(0, 200);
  await page.waitForTimeout(800);
  const zoomedOut = await countHousePixels(page);
  await page.getByRole('button', { name: 'Centrera' }).click();
  await page.waitForTimeout(1500);
  const centered = await countHousePixels(page);
  expect(zoomedOut).toBeLessThan(atStart * 0.7);
  expect(centered).toBeGreaterThan(atStart * 0.8);
});

/** Antal bruna bildpunkter i 3D-vyn, alltså hur stort huset syns. */
function countHousePixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const source = document.querySelector('.viewport canvas');
    if (!(source instanceof HTMLCanvasElement)) return 0;
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    const context = copy.getContext('2d');
    if (!context) return 0;
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const [red = 0, green = 0, blue = 0] = [pixels[i], pixels[i + 1], pixels[i + 2]];
      if (red > green + 30 && green > blue && red < 220) count++;
    }
    return count;
  });
}
