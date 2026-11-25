import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Luft mellan sista knappen och skärmens nederkant på pekskärm, se CLAUDE.md. */
const BOTTOM_GAP_PX = 16;
const VIEW_HINT = 'Dra för att vrida, nyp eller scrolla för att zooma.';
const WALL_HINT = 'Tryck på en vägg i 3D-vyn eller välj den här.';

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
  await page.getByLabel('Vägg', { exact: true }).selectOption({ label: 'Framgavel' });
  await page.getByRole('button', { name: 'Lägg till tillbyggnad' }).click();
  await expect(page.getByRole('heading', { name: 'Sektion S2' })).toBeVisible();
  await expect(page.getByText('Sitter på S1 · framgavel')).toBeVisible();
  // Bara den nya sektionen är öppen, så att panelen inte blir för lång.
  const mainSection = page.getByRole('button', { name: 'Sektion S1' });
  await expect(mainSection).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('Gavelbredd')).toHaveCount(1);
  // Rubriken byter till den sektionen och stänger den som var öppen.
  await mainSection.click();
  await expect(mainSection).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Sektion S2' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('Gavelbredd')).toHaveCount(1);
  // Tillbyggnaden på gaveln sätter en gräns för hur smalt huset kan bli.
  await expect(page.getByLabel('Gavelbredd')).not.toHaveAttribute('min', '60');
  await page.getByRole('button', { name: 'Sektion S2' }).click();

  const offset = page.getByLabel('Läge längs väggen (0 = mitten)');
  await offset.fill('200');
  await offset.blur();
  await expect(offset).not.toHaveValue('200');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Ladda ner ritning (PDF)' }).click()]);
  expect(download.suggestedFilename()).toBe('ritning.pdf');

  await page.getByRole('button', { name: 'Ta bort S2' }).click();
  await expect(page.getByRole('heading', { name: 'Sektion S2' })).toHaveCount(0);
});

test('visar takets mått först när man fäller ut Tak', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Taklutning')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tak', exact: true }).click();
  await expect(page.getByLabel('Taklutning')).toBeVisible();
  await expect(page.getByLabel('Taktyp')).toBeVisible();
});

test('visar tjocklek och pappersformat först när man fäller ut Inställningar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Pappersformat')).toHaveCount(0);
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await expect(page.getByLabel(/^Tjocklek/)).toBeVisible();
  await expect(page.getByLabel('Pappersformat')).toBeVisible();
});

test('visar bara takets fält för vald taktyp', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tak', exact: true }).click();
  await expect(page.getByLabel('Kantens höjd')).toHaveCount(0);
  await page.getByLabel('Taktyp').selectOption({ label: 'Platt tak med kant' });
  await expect(page.getByLabel('Kantens höjd')).toBeVisible();
  await expect(page.getByLabel(/^Taklutning/)).toHaveCount(0);
  await expect(page.getByLabel('Takutsprång vid gavel')).toHaveCount(0);
  await page.getByLabel('Taktyp').selectOption({ label: 'Mansardtak' });
  await expect(page.getByLabel('Nedre taklutning')).toBeVisible();
  await expect(page.getByLabel(/^Taklutning/)).toBeVisible();
});

test('låter inte måtten gå förbi det som ryms', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Lägg till tillbyggnad' }).click();
  await page.getByLabel('Vägghöjd').fill('150');
  await expect(page.getByText(/Välj ett värde mellan 40 och/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ladda ner ritning (PDF)' })).toBeEnabled();
});

test('stoppar ritningen när en tillbyggnad inte ryms', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Lägg till tillbyggnad' }).click();
  // En tornspira kan bara stå på fatet.
  await page.getByRole('button', { name: 'Tak', exact: true }).click();
  await page.getByLabel('Taktyp').selectOption({ label: 'Tornspira, 4 sidor' });
  await expect(page.getByText(/En tornspira kan bara stå på fatet/)).toBeVisible();
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

  test('visar måtten i ett ark och behåller knapparna nertill', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Visa mått' }).click();
    await expect(page.getByLabel('Gavelbredd')).toBeVisible();
    const bottom = await page.getByRole('button', { name: 'Ladda ner ritning (PDF)' }).evaluate((button) => button.getBoundingClientRect().bottom);
    expect(bottom).toBeCloseTo((await page.evaluate(() => window.innerHeight)) - BOTTOM_GAP_PX, 0);
  });

  test('fäller upp arket med måtten när man trycker på en vägg', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Gavelbredd')).toBeHidden();
    const view = page.locator('.viewport canvas');
    await page.waitForTimeout(1500);
    const box = await view.boundingBox();
    if (!box) throw new Error('3D-vyn saknas');
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.6);
    await expect(page.getByRole('button', { name: 'Dölj mått' })).toBeVisible();
    await expect(page.getByLabel('Gavelbredd')).toBeVisible();
  });

  test('döljer hjälptexten om väggar när man har tryckt på en vägg', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Visa mått' }).click();
    await expect(page.getByText(WALL_HINT)).toBeVisible();
    await page.getByRole('button', { name: 'Dölj mått' }).click();
    const view = page.locator('.viewport canvas');
    await page.waitForTimeout(1500);
    const box = await view.boundingBox();
    if (!box) throw new Error('3D-vyn saknas');
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.6);
    await expect(page.getByLabel('Gavelbredd')).toBeVisible();
    await expect(page.getByText(WALL_HINT)).toHaveCount(0);
    // Ett tryck utan att dra vrider inte vyn, så den hjälptexten står kvar.
    await expect(page.getByText(VIEW_HINT)).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Visa mått' }).click();
    await expect(page.getByLabel('Gavelbredd')).toBeVisible();
    await expect(page.getByText(WALL_HINT)).toHaveCount(0);
  });
});

test('döljer hjälptexten om vyn när man har zoomat', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto('/');
  await expect(page.getByText(VIEW_HINT)).toBeVisible();
  await page.waitForTimeout(1500);
  await page.locator('.viewport canvas').hover();
  await page.mouse.wheel(0, 200);
  await expect(page.getByText(VIEW_HINT)).toHaveCount(0);
  await page.reload();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText(VIEW_HINT)).toHaveCount(0);
});

test('döljer hjälptexten om vyn när man har vridit med musen', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto('/');
  await page.waitForTimeout(1500);
  const box = await page.locator('.viewport canvas').boundingBox();
  if (!box) throw new Error('3D-vyn saknas');
  // Börjar vid kanten, utanför huset, så att det inte blir ett val av vägg.
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 140, box.y + 60, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByText(VIEW_HINT)).toHaveCount(0);
  await expect(page.getByText(WALL_HINT)).toBeVisible();
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
