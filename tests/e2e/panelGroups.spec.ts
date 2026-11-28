import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const VIEW_SETTLE_INTERVAL_MS = 300;
const VIEW_SETTLE_TIMEOUT_MS = 10_000;

test('fäller ut en toppnod i taget och ett barn i taget i en sektion', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const section = page.getByRole('button', { name: 'Sektion S1' });
  const savedHouses = page.getByRole('button', { name: 'Mina hus', exact: true });
  const settings = page.getByRole('button', { name: 'Inställningar', exact: true });
  await expect(section).toHaveAttribute('aria-expanded', 'true');

  await savedHouses.click();
  await expect(savedHouses).toHaveAttribute('aria-expanded', 'true');
  await expect(section).toHaveAttribute('aria-expanded', 'false');
  await settings.click();
  await expect(settings).toHaveAttribute('aria-expanded', 'true');
  await expect(savedHouses).toHaveAttribute('aria-expanded', 'false');
  await section.click();
  await expect(section).toHaveAttribute('aria-expanded', 'true');
  await expect(settings).toHaveAttribute('aria-expanded', 'false');

  // Inuti sektionen är bara ett barn utfällt: en vägg eller Tak.
  await page.getByRole('button', { name: 'Vägg 2', exact: true }).click();
  await page.getByRole('button', { name: 'Tak', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tak', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: /^Vägg \d$/, expanded: true })).toHaveCount(0);
});

test('fäller ihop Inställningar när man trycker på en vägg i 3D-vyn', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const settings = page.getByRole('button', { name: 'Inställningar', exact: true });
  await settings.click();
  await expect(page.getByRole('button', { name: 'Sektion S1' })).toHaveAttribute('aria-expanded', 'false');
  await waitForViewToSettle(page);
  await page.mouse.click(540, 660);
  await expect(page.getByRole('button', { name: 'Sektion S1' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: /^Vägg \d$/, expanded: true })).toHaveCount(1);
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
});

test('fäller ut kupans tak eller fönstret i kupan, inte båda', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Tak', exact: true }).click();
  await page.getByRole('button', { name: 'Lägg till takkupa på takfall mot vägg 2' }).click();
  const dormer = page.locator('[data-instance-id="K1"]');
  const dormerRoof = dormer.getByRole('button', { name: 'Kupans tak', exact: true });
  const dormerWindow = dormer.getByRole('button', { name: /^Fönster F\d+$/ });
  await dormerWindow.click();
  await expect(dormerWindow).toHaveAttribute('aria-expanded', 'true');
  await dormerRoof.click();
  await expect(dormerRoof).toHaveAttribute('aria-expanded', 'true');
  await expect(dormerWindow).toHaveAttribute('aria-expanded', 'false');
  await dormerWindow.click();
  await expect(dormerWindow).toHaveAttribute('aria-expanded', 'true');
  await expect(dormerRoof).toHaveAttribute('aria-expanded', 'false');
});

/** Väntar tills kameran står still, så att ett tryck på en viss punkt i 3D-vyn träffar. */
async function waitForViewToSettle(page: Page) {
  const view = page.locator('.viewport canvas');
  let previous = '';
  await expect
    .poll(
      async () => {
        await page.waitForTimeout(VIEW_SETTLE_INTERVAL_MS);
        const current = (await view.screenshot({ scale: 'css' })).toString('base64');
        const isStill = current === previous;
        previous = current;
        return isStill;
      },
      { timeout: VIEW_SETTLE_TIMEOUT_MS, intervals: [0] },
    )
    .toBe(true);
}
