import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { countHousePixels, isSameView, takeViewSnapshot, waitForViewToSettle } from './viewPixels';

test('sparar ett hus under ett namn och öppnar det igen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await addWindow(page);
  await openSavedHouses(page);
  await page.getByLabel('Namn', { exact: true }).fill('Kyrkan');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();
  await expect(page.getByText('Sparat som Kyrkan.')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Sparade hus' }).getByText('Kyrkan', { exact: true })).toBeVisible();
  // Börja om och öppna det sparade huset igen.
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.getByRole('button', { name: 'Börja om' }).click();
  await page.getByRole('button', { name: 'Ja, börja om' }).click();
  await expect(page.getByRole('heading', { name: 'Fönster F1' })).toHaveCount(0);
  await openSavedHouses(page);
  await page.getByRole('button', { name: 'Öppna Kyrkan' }).click();
  await expect(page.getByText('Kyrkan är öppnat. Ångra tar tillbaka huset du hade.')).toBeVisible();
  await page.getByRole('button', { name: 'Sektion S1' }).click();
  await openWall(page, 'Vägg 2');
  await expect(page.getByRole('heading', { name: 'Fönster F1' })).toBeVisible();
  // Huset finns kvar efter en omladdning.
  await page.reload();
  await openSavedHouses(page);
  await expect(page.getByLabel('Namn', { exact: true })).toHaveValue('Kyrkan');
  await page.getByRole('button', { name: 'Ta bort Kyrkan' }).click();
  await page.getByRole('button', { name: 'Ja, ta bort Kyrkan' }).click();
  await expect(page.getByText('Inga sparade hus än.', { exact: false })).toBeVisible();
});

test('öppnar ett hus från en delad länk på en annan enhet', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  await page.goto('/');
  await addWindow(page);
  await openSavedHouses(page);
  await page.getByLabel('Namn', { exact: true }).fill('Kyrkan');
  await page.getByRole('button', { name: 'Dela länk' }).click();
  await expect(page.getByText('Länken är kopierad.')).toBeVisible();
  const link = await page.getByLabel('Länk till huset').inputValue();
  expect(link).toContain('#hus=1.');
  // En annan enhet har ett eget sparat hus, som Ångra tar tillbaka.
  const other = await browser.newContext({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });
  const phone = await other.newPage();
  await phone.goto(link);
  await expect(phone.getByText('Huset från länken är öppnat.', { exact: false })).toBeVisible();
  expect(new URL(phone.url()).hash).toBe('');
  // Ingen sektion står öppen och inget är markerat.
  await expect(phone.getByRole('button', { name: 'Sektion S1' })).toHaveAttribute('aria-expanded', 'false');
  await expect(phone.getByRole('button', { name: /^Vägg \d$/ })).toHaveCount(0);
  await phone.getByRole('button', { name: 'Stäng', exact: true }).click();
  await phone.getByRole('button', { name: 'Sektion S1' }).click();
  await openWall(phone, 'Vägg 2');
  await expect(phone.getByRole('heading', { name: 'Fönster F1' })).toBeVisible();
  await phone.getByRole('button', { name: 'Ångra', exact: true }).click();
  await expect(phone.getByRole('heading', { name: 'Fönster F1' })).toHaveCount(0);
  await context.close();
  await other.close();
});

test('ställer in kameran på huset när ett sparat hus öppnas', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto('/');
  await openSavedHouses(page);
  await page.getByLabel('Namn', { exact: true }).fill('Kyrkan');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();
  await waitForViewToSettle(page);
  const atStart = await countHousePixels(page);
  await page.locator('.viewport canvas').hover();
  for (let step = 0; step < 12; step++) await page.mouse.wheel(0, 200);
  await waitForViewToSettle(page);
  expect(await countHousePixels(page)).toBeLessThan(atStart * 0.7);
  await page.getByRole('button', { name: 'Öppna Kyrkan' }).click();
  await waitForViewToSettle(page);
  expect(await countHousePixels(page)).toBeGreaterThan(atStart * 0.8);
});

test('öppnar ett sparat hus med vinkeln det sparades med', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto('/');
  await waitForViewToSettle(page);
  const view = page.locator('.viewport canvas');
  // Vrider och zoomar vyn bort från startläget.
  await view.hover();
  await page.mouse.down();
  await page.mouse.move(420, 380, { steps: 8 });
  await page.mouse.up();
  for (let step = 0; step < 3; step++) await page.mouse.wheel(0, 200);
  await waitForViewToSettle(page);
  const saved = await takeViewSnapshot(page);
  await openSavedHouses(page);
  await page.getByLabel('Namn', { exact: true }).fill('Kyrkan');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();
  await expect(page.getByText('Sparat som Kyrkan.')).toBeVisible();
  // Centrera ändrar vyn; Öppna ger tillbaka den sparade.
  await page.getByRole('button', { name: 'Centrera' }).click();
  await waitForViewToSettle(page);
  expect(isSameView(await takeViewSnapshot(page), saved)).toBe(false);
  await page.getByRole('button', { name: 'Öppna Kyrkan' }).click();
  // Vyn ändras först när huset har öppnats.
  await expect(page.getByText('Kyrkan är öppnat.', { exact: false })).toBeVisible();
  await waitForViewToSettle(page);
  expect(isSameView(await takeViewSnapshot(page), saved)).toBe(true);
});

test('öppnar en delad länk med vinkeln den delades med', async ({ browser }) => {
  test.slow();
  const context = await browser.newContext({ viewport: { width: 1000, height: 700 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  await page.goto('/');
  await waitForViewToSettle(page);
  const view = page.locator('.viewport canvas');
  await view.hover();
  await page.mouse.down();
  await page.mouse.move(420, 380, { steps: 8 });
  await page.mouse.up();
  await waitForViewToSettle(page);
  const shared = await takeViewSnapshot(page);
  await openSavedHouses(page);
  await page.getByRole('button', { name: 'Dela länk' }).click();
  const link = await page.getByLabel('Länk till huset').inputValue();
  const other = await (await browser.newContext({ viewport: { width: 1000, height: 700 } })).newPage();
  await other.goto(link);
  await expect(other.getByText('Huset från länken är öppnat.', { exact: false })).toBeVisible();
  await waitForViewToSettle(other);
  expect(isSameView(await takeViewSnapshot(other), shared)).toBe(true);
  await context.close();
});

async function addWindow(page: Page) {
  await openWall(page, 'Vägg 2');
  await page.getByRole('button', { name: 'Lägg till fönster' }).click();
  await expect(page.getByRole('heading', { name: 'Fönster F1' })).toBeVisible();
}

async function openSavedHouses(page: Page) {
  const group = page.getByRole('button', { name: 'Mina hus', exact: true });
  if ((await group.getAttribute('aria-expanded')) !== 'true') await group.click();
}

/** Fäller ut en vägg på den öppna sektionen, t.ex. "Vägg 1". */
async function openWall(page: Page, name: string) {
  const wall = page.getByRole('button', { name, exact: true });
  if ((await wall.getAttribute('aria-expanded')) !== 'true') await wall.click();
}
