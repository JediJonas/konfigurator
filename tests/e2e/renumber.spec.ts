import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test('numrerar om sektionerna när en tas bort', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  for (const [wall, added] of [['Vägg 1', 'S2'], ['Vägg 2', 'S3'], ['Vägg 4', 'S4']] as const) {
    await openSection(page, 'S1');
    await openWall(page, wall);
    await page.getByRole('button', { name: 'Lägg till sektion' }).click();
    await expect(page.getByRole('heading', { name: `Sektion ${added}` })).toBeVisible();
  }
  await openSection(page, 'S2');
  await page.getByRole('button', { name: 'Ta bort S2' }).click();
  await page.getByRole('button', { name: 'Ja, ta bort S2' }).click();
  // S3 blir S2 och S4 blir S3, och ingen annan sektion öppnas i stället för den borttagna.
  await expect(page.getByRole('button', { name: /^Sektion S\d$/ })).toHaveText(['Sektion S1', 'Sektion S2', 'Sektion S3']);
  for (const id of ['S1', 'S2', 'S3']) await expect(sectionButton(page, id)).toHaveAttribute('aria-expanded', 'false');
  await openSection(page, 'S2');
  await expect(page.getByText('Sitter på S1 · vägg 2')).toBeVisible();
  // Ångra ger tillbaka den borttagna sektionen med sitt gamla nummer.
  await page.getByRole('button', { name: 'Ångra' }).click();
  await expect(page.getByRole('button', { name: /^Sektion S\d$/ })).toHaveCount(4);
  await expect(page.getByText('Sitter på S1 · vägg 1')).toBeVisible();
});

function sectionButton(page: Page, id: string) {
  return page.getByRole('button', { name: `Sektion ${id}`, exact: true });
}

async function openSection(page: Page, id: string) {
  const section = sectionButton(page, id);
  if ((await section.getAttribute('aria-expanded')) !== 'true') await section.click();
}

async function openWall(page: Page, name: string) {
  const wall = page.getByRole('button', { name, exact: true });
  if ((await wall.getAttribute('aria-expanded')) !== 'true') await wall.click();
}
