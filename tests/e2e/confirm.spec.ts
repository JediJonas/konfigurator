import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test('börjar om från början och glömmer det sparade huset', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openWall(page, 'Vägg 2');
  await page.getByRole('button', { name: 'Lägg till fönster' }).click();
  await expect(page.getByRole('heading', { name: 'Fönster F1' })).toBeVisible();
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.getByRole('button', { name: 'Börja om' }).click();
  // Man får bekräfta först, och kan ångra sig.
  await page.getByRole('button', { name: 'Avbryt' }).click();
  await expect(page.getByRole('heading', { name: 'Fönster F1' })).toBeVisible();
  await page.getByRole('button', { name: 'Börja om' }).click();
  await page.getByRole('button', { name: 'Ja, börja om' }).click();
  await expect(page.getByRole('heading', { name: 'Fönster F1' })).toHaveCount(0);
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sektion S1' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fönster F1' })).toHaveCount(0);
});

test.describe('pekskärm', () => {
  test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

  test('rullar fram knapparna för att bekräfta när man trycker på Ta bort', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Visa konfiguration' }).click();
    await openWall(page, 'Vägg 2');
    await page.getByRole('button', { name: 'Lägg till fönster' }).click();
    const remove = page.getByRole('button', { name: 'Ta bort F1' });
    const content = page.locator('.panel-content');
    // Knappen står längst ner i arket, så att bekräftelsen hamnar nedanför kanten.
    await remove.evaluate((button) => {
      const container = button.closest('.panel-content');
      if (!container) throw new Error('Panelen saknas');
      const gap = container.getBoundingClientRect().bottom - button.getBoundingClientRect().bottom;
      container.scrollTop -= gap;
    });
    await page.waitForTimeout(300);
    await remove.tap();
    const confirm = page.getByRole('button', { name: 'Ja, ta bort F1' });
    const cancel = page.getByRole('button', { name: 'Avbryt' });
    await expect
      .poll(async () => {
        const [contentBox, confirmBox, cancelBox] = await Promise.all([content.boundingBox(), confirm.boundingBox(), cancel.boundingBox()]);
        if (!contentBox || !confirmBox || !cancelBox) return false;
        return Math.max(confirmBox.y + confirmBox.height, cancelBox.y + cancelBox.height) <= contentBox.y + contentBox.height + 1;
      })
      .toBe(true);
    await expect(page.getByRole('button', { name: 'Dölj konfiguration' })).toBeInViewport();
    await confirm.tap();
    await expect(page.getByRole('heading', { name: 'Fönster F1' })).toHaveCount(0);
  });
});

async function openWall(page: Page, name: string) {
  const wall = page.getByRole('button', { name, exact: true });
  if ((await wall.getAttribute('aria-expanded')) !== 'true') await wall.click();
}
