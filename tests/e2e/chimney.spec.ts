import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test('lägger en skorsten på taket och visar den under Tak', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openWall(page, 'Tak');
  await page.getByRole('button', { name: 'Lägg till skorsten på takfall mot vägg 2' }).click();
  await expect(page.getByRole('heading', { name: 'Skorsten SK1' })).toBeVisible();
  await expect(page.getByText('Sitter på S1 · takfall mot vägg 2')).toBeVisible();
  await expect(page.getByLabel('Läge längs taket (0 = mitten)')).toHaveValue('0');
  await expect(page.getByLabel(/^Avstånd från takfoten/)).toBeVisible();
  await expect(page.getByLabel(/^Djup/)).toBeVisible();
  await expect(page.getByLabel(/^Höjd över taket/)).toBeVisible();
  // Skorstenen sitter under Tak, inte som en egen sektion på toppnivån.
  await expect(page.locator('[data-group-key="group.roof"]').getByRole('heading', { name: 'Skorsten SK1' })).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Ladda ner ritning (PDF)' }).click()]);
  expect(download.suggestedFilename()).toBe('ritning.pdf');
  await page.getByRole('button', { name: 'Ta bort SK1' }).click();
  await page.getByRole('button', { name: 'Ja, ta bort SK1' }).click();
  await expect(page.getByRole('heading', { name: 'Skorsten SK1' })).toHaveCount(0);
});

test('flyttar skorstenen ut till väggen under takfoten och längs väggen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openWall(page, 'Tak');
  await page.getByRole('button', { name: 'Lägg till skorsten på takfall mot vägg 2' }).click();
  const eaveDistance = page.getByLabel(/^Avstånd från takfoten \(0 = mot väggen\)/);
  await eaveDistance.fill('0');
  await eaveDistance.blur();
  await expect(page.getByText('Sitter på S1 · vägg 2')).toBeVisible();
  // Mot väggen får den flyttas till hörnet men inte förbi: väggen är 180 mm och skorstenen 25 mm bred.
  const offset = page.locator('[data-instance-id="SK1"]').getByRole('spinbutton').first();
  await expect(offset).toHaveAttribute('max', '75', { timeout: 15_000 });
  await eaveDistance.fill('60');
  await eaveDistance.blur();
  await expect(page.getByText('Sitter på S1 · takfall mot vägg 2')).toBeVisible();
});

test('lägger skorstenen på takfallet som är valt under Tak', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openWall(page, 'Tak');
  // Knapparna är korta; takfallet väljs i listan eller med ett tryck på taket i 3D-vyn.
  const roofFace = page.getByLabel('Takfall', { exact: true });
  await expect(roofFace.locator('option:checked')).toHaveText('Takfall mot Vägg 2');
  await expect(page.getByRole('button', { name: 'Lägg till skorsten på takfall mot vägg 2' })).toHaveText('Skorsten');
  await roofFace.selectOption({ label: 'Takfall mot Vägg 4' });
  await page.getByRole('button', { name: 'Lägg till skorsten på takfall mot vägg 4' }).click();
  await expect(page.getByText('Sitter på S1 · takfall mot vägg 4')).toBeVisible();
});

async function openWall(page: Page, name: string) {
  const wall = page.getByRole('button', { name, exact: true });
  if ((await wall.getAttribute('aria-expanded')) !== 'true') await wall.click();
}
