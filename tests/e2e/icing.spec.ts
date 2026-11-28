import { expect, test } from '@playwright/test';

test('visar kristyr från början och kommer ihåg om man stänger av den', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  const icing = page.getByRole('checkbox', { name: 'Visa kristyr' });
  await expect(icing).toBeChecked();
  await icing.uncheck();
  await expect(icing).not.toBeChecked();
  await page.reload();
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Visa kristyr' })).not.toBeChecked();
  expect(errors).toEqual([]);
});
