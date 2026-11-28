import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test('ångrar och gör om med knapparna vid Centrera och med kortkommandon', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Klockan står still, så att trycken räknas som snabba även när CI är långsam.
  await page.clock.setFixedTime(new Date('2026-11-28T09:00:00'));
  await page.goto('/');
  const undo = page.getByRole('button', { name: 'Ångra', exact: true });
  const redo = page.getByRole('button', { name: 'Gör om', exact: true });
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await openWall(page, 'Vägg 1');
  const width = page.getByLabel(/^Längd/);
  const start = Number(await width.inputValue());
  // Snabba tryck på + blir ett enda steg att ångra.
  for (let press = 0; press < 3; press += 1) await stepButton(page, 'Längd', 'Öka').click();
  await expect(width).toHaveValue(String(start + 15));
  await undo.click();
  await expect(width).toHaveValue(String(start));
  await expect(undo).toBeDisabled();
  await redo.click();
  await expect(width).toHaveValue(String(start + 15));
  await page.keyboard.press('ControlOrMeta+z');
  await expect(width).toHaveValue(String(start));
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(width).toHaveValue(String(start + 15));
});

test('får tillbaka huset med Ångra efter Börja om', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openWall(page, 'Vägg 2');
  await page.getByRole('button', { name: 'Lägg till fönster' }).click();
  await expect(page.getByRole('heading', { name: 'Fönster F1' })).toBeVisible();
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.getByRole('button', { name: 'Börja om' }).click();
  await page.getByRole('button', { name: 'Ja, börja om' }).click();
  await expect(page.getByRole('heading', { name: 'Fönster F1' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ångra', exact: true }).click();
  // Inställningar står kvar öppen, så sektionen fälls ut först.
  await page.getByRole('button', { name: 'Sektion S1' }).click();
  await openWall(page, 'Vägg 2');
  await expect(page.getByRole('heading', { name: 'Fönster F1' })).toBeVisible();
});

function stepButton(page: Page, fieldLabel: string, name: 'Öka' | 'Minska') {
  return page.getByLabel(new RegExp(`^${fieldLabel}`)).locator('..').getByRole('button', { name });
}

/** Fäller ut en vägg på den öppna sektionen, t.ex. "Vägg 1". */
async function openWall(page: Page, name: string) {
  const wall = page.getByRole('button', { name, exact: true });
  if ((await wall.getAttribute('aria-expanded')) !== 'true') await wall.click();
}
