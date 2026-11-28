import { expect, test } from '@playwright/test';

test('felrutan syns inte när appen startar utan fel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Vägg 2', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Felmeddelanden' })).toHaveCount(0);
});

test('felrutan visar ett fel som inte fångas och går att stänga', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Vägg 2', exact: true })).toBeVisible();
  await page.evaluate(() => setTimeout(() => {
    throw new Error('Provfel');
  }));
  const box = page.getByRole('region', { name: 'Felmeddelanden' });
  await expect(box.getByRole('textbox')).toHaveValue(/Error: Provfel/);
  await expect(box.getByRole('textbox')).toHaveValue(/WebGL 2: ja/);
  await box.getByRole('button', { name: 'Stäng' }).click();
  await expect(box).toBeHidden();
});

test('felrutan visar ett skript som inte går att ladda', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.src = './saknas.js';
    document.head.appendChild(script);
  });
  await expect(page.getByRole('region', { name: 'Felmeddelanden' }).getByRole('textbox')).toHaveValue(/Kunde inte ladda .*saknas\.js/);
});

test('?fel visar felrutan även utan fel', async ({ page }) => {
  await page.goto('/?fel');
  await expect(page.getByRole('region', { name: 'Felmeddelanden' }).getByRole('textbox')).toHaveValue(/Inga fel än/);
});
