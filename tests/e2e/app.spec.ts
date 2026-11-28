import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Luft mellan sista knappen och skärmens nederkant på pekskärm, se CLAUDE.md. */
const BOTTOM_GAP_PX = 16;
/** Minsta tryckyta, 44 pt, se CLAUDE.md. */
const TAP_SIZE_PX = 44;
/** Rubriken står överst i panelen med lite luft ovanför. */
const HEADING_GAP_PX = 12;
const VIEW_HINT = 'Dra för att vrida, nyp eller scrolla för att zooma.';

/** Så länge mellan två bilder av 3D-vyn när man väntar på att kameran står still. */
const VIEW_SETTLE_INTERVAL_MS = 300;
const VIEW_SETTLE_TIMEOUT_MS = 10_000;

test('laddar ner en ritning som PDF', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Ladda ner ritning (PDF)' }).click()]);
  expect(download.suggestedFilename()).toBe('ritning.pdf');
  const path = await download.path();
  expect(path).toBeTruthy();
});

test('visar vägghöjden överst i sektionen och väggens längd först när man fäller ut väggen', async ({ page }) => {
  await page.goto('/');
  // Vägghöjden gäller alla väggar och står överst i sektionen (ägarens val).
  await expect(page.getByLabel(/^Vägghöjd/)).toBeVisible();
  await expect(page.getByLabel(/^Längd/)).toHaveCount(0);
  // Varje vägg har Längd; gavelns längd är husets bredd.
  await openWall(page, 'Vägg 1');
  const gableLength = page.getByLabel(/^Längd/);
  await expect(gableLength).toBeVisible();
  const width = await gableLength.inputValue();
  await openWall(page, 'Vägg 2');
  await expect(page.getByLabel(/^Längd/)).toHaveCount(1);
  await expect(page.getByLabel(/^Längd/)).not.toHaveValue(width);
  // En sak öppen i taget: Vägg 1 fälls ihop.
  await expect(page.getByRole('button', { name: 'Vägg 1', exact: true })).toHaveAttribute('aria-expanded', 'false');
  // Motstående väggar delar längd.
  await openWall(page, 'Vägg 3');
  await expect(page.getByLabel(/^Längd/)).toHaveValue(width);
});

test('ändrar huset när ett mått ändras', async ({ page }) => {
  await page.goto('/');
  await openWall(page, 'Vägg 1');
  const width = page.getByLabel(/^Längd/);
  await width.fill('500');
  await expect(page.getByText('Välj ett värde mellan 60 och 400.')).toBeVisible();
  await width.fill('200');
  await expect(width).toHaveAttribute('aria-invalid', 'false');
});

test('ändrar ett mått med − och +', async ({ page }) => {
  await page.goto('/');
  await openWall(page, 'Vägg 1');
  const width = page.getByLabel(/^Längd/);
  const start = Number(await width.inputValue());
  await stepButton(page, 'Längd', 'Öka').click();
  await expect(width).toHaveValue(String(start + 5));
  await stepButton(page, 'Längd', 'Minska').click();
  await stepButton(page, 'Längd', 'Minska').click();
  await expect(width).toHaveValue(String(start - 5));
  await width.fill('400');
  await expect(stepButton(page, 'Längd', 'Öka')).toBeDisabled();
});

test('bygger till huset och laddar ner ritningen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openWall(page, 'Vägg 1');
  await page.getByRole('button', { name: 'Lägg till sektion' }).click();
  await expect(page.getByRole('heading', { name: 'Sektion S2' })).toBeVisible();
  // Läget står överst i den nya sektionen, utan egen rubrik.
  await expect(page.getByText('Sitter på S1 · vägg 1')).toBeVisible();
  // Bara den nya sektionen är öppen, så att panelen inte blir för lång.
  const mainSection = page.getByRole('button', { name: 'Sektion S1' });
  await expect(mainSection).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Tak', exact: true })).toHaveCount(1);
  // Rubriken byter till den sektionen och stänger den som var öppen.
  await mainSection.click();
  await expect(mainSection).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Sektion S2' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Vägg 4', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Sektion S2' }).click();
  // En tillbyggnad har tre väggar.
  await expect(page.getByRole('button', { name: /^Vägg \d$/ })).toHaveCount(3);

  const offset = page.getByLabel('Läge längs väggen (0 = mitten)');
  await offset.fill('200');
  await offset.blur();
  await expect(offset).not.toHaveValue('200');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Ladda ner ritning (PDF)' }).click()]);
  expect(download.suggestedFilename()).toBe('ritning.pdf');

  // Man får bekräfta först, och kan ångra sig.
  await page.getByRole('button', { name: 'Ta bort S2' }).click();
  await page.getByRole('button', { name: 'Avbryt' }).click();
  await expect(page.getByRole('heading', { name: 'Sektion S2' })).toBeVisible();
  await page.getByRole('button', { name: 'Ta bort S2' }).click();
  await page.getByRole('button', { name: 'Ja, ta bort S2' }).click();
  await expect(page.getByRole('heading', { name: 'Sektion S2' })).toHaveCount(0);
});

test('sätter fönster och dörr i väggen och har kvar dem när sidan laddas om', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openWall(page, 'Vägg 2');
  await page.getByRole('button', { name: 'Lägg till fönster' }).click();
  await expect(page.getByRole('heading', { name: 'Fönster F1' })).toBeVisible();
  await page.getByLabel('Fönsterluckor').check();
  await page.getByLabel('Form').selectOption({ label: 'Bågformat' });

  await openWall(page, 'Vägg 1');
  // Fönstret fälls ihop med sin vägg när en annan vägg öppnas.
  await expect(page.getByRole('heading', { name: 'Fönster F1' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Lägg till dörr' }).click();
  await expect(page.getByRole('heading', { name: 'Dörr D1' })).toBeVisible();
  // Fälls dörren ihop står väggen kvar öppen.
  await page.getByRole('button', { name: 'Dörr D1' }).click();
  await expect(page.getByRole('button', { name: 'Vägg 1', exact: true })).toHaveAttribute('aria-expanded', 'true');
  // En dörr per vägg: knappen är avstängd och säger varför.
  await expect(page.getByRole('button', { name: 'Lägg till dörr' })).toBeDisabled();
  await expect(page.getByText('Det får bara finnas en dörr på varje vägg.')).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Ladda ner ritning (PDF)' }).click()]);
  expect(download.suggestedFilename()).toBe('ritning.pdf');

  await page.reload();
  // Fönster och dörrar ligger under väggen de sitter på.
  const houseSection = page.locator('[data-instance-id="S1"]');
  await expect(houseSection.getByRole('heading', { level: 3, name: 'Dörr D1' })).toBeVisible();
  await openWall(page, 'Vägg 2');
  await expect(houseSection.getByRole('heading', { level: 3, name: 'Fönster F1' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dörr D1' })).toHaveCount(0);
  // De syns bara när sektionen är utfälld; på toppnivån finns bara sektioner och Inställningar.
  await page.getByRole('button', { name: 'Sektion S1' }).click();
  await expect(page.getByRole('button', { name: 'Sektion S1' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('heading', { name: 'Fönster F1' })).toHaveCount(0);
});

test('öppnar fönstret när man trycker på det i 3D-vyn', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openWall(page, 'Vägg 2');
  await page.getByRole('button', { name: 'Lägg till fönster' }).click();
  // Fönstret stängs men sektionen blir kvar öppen, och vyn hinner rita innan man trycker mitt i fönsterhålet.
  await page.getByRole('button', { name: 'Fönster F1' }).click();
  await expect(page.getByRole('button', { name: 'Sektion S1' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Fönster F1' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('Höjd över golvet')).toBeHidden();
  await waitForViewToSettle(page);
  await page.mouse.click(590, 520);
  await expect(page.getByRole('button', { name: 'Fönster F1' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Höjd över golvet')).toBeVisible();
});

test('fäller ut takets fält när man trycker på taket i 3D-vyn', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByLabel('Taktyp')).toBeHidden();
  await waitForViewToSettle(page);
  await page.mouse.click(500, 300);
  await expect(page.getByRole('button', { name: 'Tak', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Taktyp')).toBeVisible();
  // Takfallet man tryckte på blir det som + Takkupa och + Skorsten lägger till på.
  const roofFace = page.getByLabel('Takfall', { exact: true });
  await roofFace.selectOption({ label: 'Takfall mot Vägg 4' });
  await page.mouse.click(500, 300);
  await expect(roofFace.locator('option:checked')).toHaveText('Takfall mot Vägg 2');
  await expect(page.getByRole('button', { name: 'Lägg till takkupa på takfall mot vägg 2' })).toBeVisible();
});

test('öppnar sektionen och väggen när man trycker på väggen, även samma vägg igen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sektion S1' }).click();
  await expect(page.getByRole('button', { name: 'Sektion S1' })).toHaveAttribute('aria-expanded', 'false');
  await waitForViewToSettle(page);
  await page.mouse.click(540, 660);
  await expect(page.getByRole('button', { name: 'Sektion S1' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel(/^Längd/)).toBeVisible();
  const openWalls = page.getByRole('button', { name: /^Vägg \d$/, expanded: true });
  await expect(openWalls).toHaveCount(1);
  await openWalls.click();
  await expect(page.getByLabel(/^Längd/)).toHaveCount(0);
  await page.mouse.click(540, 660);
  await expect(page.getByLabel(/^Längd/)).toBeVisible();
});

test('ställer en sektion bredvid huset när den blir högre än väggen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  // Varje vägg visas en gång, med en knapp för sektion.
  await expect(page.getByRole('button', { name: /^Vägg \d$/ })).toHaveCount(4);
  await openWall(page, 'Vägg 2');
  await expect(page.getByRole('button', { name: 'Lägg till sektion' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Lägg till sektion' }).click();
  await expect(page.getByRole('heading', { name: 'Sektion S2' })).toBeVisible();
  // Högre än husets vägg blir den ett torn som står bredvid, i stället för ett fel.
  await openWall(page, 'Vägg 1');
  const wallHeight = page.getByLabel(/^Vägghöjd/);
  await wallHeight.fill('160');
  await wallHeight.blur();
  await expect(wallHeight).toHaveValue('160');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ladda ner ritning (PDF)' })).toBeEnabled();
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

/**
 * En tornspira bredvid huset som är så hög att spiran går upp genom husets
 * takutsprång. Den sparas före start, eftersom fältets gränser inte släpper
 * igenom en höjd som ger fel när de väl är räknade.
 */
const SPIRE_THROUGH_EAVES = {
  id: 'open',
  name: 'Mitt hus',
  domain: 'gingerbread',
  updatedAt: '2026-11-27T00:00:00.000Z',
  design: {
    version: 1,
    domain: 'gingerbread',
    domainVersion: 1,
    material: { id: 'gb.dough', thickness: 4 },
    root: {
      id: 'plate',
      type: 'gb.plate',
      params: {},
      children: [
        {
          id: 'S1',
          type: 'gb.section',
          params: {},
          attachment: { socketId: 'ground', u: 0, v: 0, rotationDegrees: 0 },
          children: [
            {
              id: 'S2',
              type: 'gb.section',
              params: { width: 100, depth: 80, wallHeight: 80, roof: 'spire8', spirePitch: 70, eaveOverhang: 8, gableOverhang: 8 },
              attachment: { socketId: 'beside-side-right', u: 0, v: 0, rotationDegrees: 0 },
              children: [],
            },
          ],
        },
      ],
    },
  },
};

test('stoppar ritningen när taken går in i varandra', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript((project) => localStorage.setItem('konfigurator.project.open', JSON.stringify(project)), SPIRE_THROUGH_EAVES);
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('går in i taket');
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

  test('visar konfigurationen i ett ark och behåller knapparna nertill', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Visa konfiguration' }).click();
    await openWall(page, 'Vägg 1');
    await expect(page.getByLabel(/^Längd/)).toBeVisible();
    const bottom = await page.getByRole('button', { name: 'Ladda ner ritning (PDF)' }).evaluate((button) => button.getBoundingClientRect().bottom);
    expect(bottom).toBeCloseTo((await page.evaluate(() => window.innerHeight)) - BOTTOM_GAP_PX, 0);
  });

  test('visar − och + lika stora som en tryckyta', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Visa konfiguration' }).click();
    await openWall(page, 'Vägg 1');
    const width = page.getByLabel(/^Längd/);
    const start = Number(await width.inputValue());
    const increase = stepButton(page, 'Längd', 'Öka');
    const box = await increase.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(TAP_SIZE_PX);
    expect(box?.height).toBeGreaterThanOrEqual(TAP_SIZE_PX);
    await increase.tap();
    await expect(width).toHaveValue(String(start + 5));
  });

  test('fäller upp arket och öppnar väggen när man trycker på en vägg', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel(/^Längd/)).toBeHidden();
    const view = page.locator('.viewport canvas');
    await page.waitForTimeout(1500);
    const box = await view.boundingBox();
    if (!box) throw new Error('3D-vyn saknas');
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.6);
    await expect(page.getByRole('button', { name: 'Dölj konfiguration' })).toBeVisible();
    await expect(page.getByLabel(/^Längd/)).toBeVisible();
    // Ett tryck utan att dra vrider inte vyn, så den hjälptexten står kvar.
    await expect(page.getByText(VIEW_HINT)).toBeVisible();
  });
  test('rullar panelen till ett nytt fönster och en ny sektion', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Visa konfiguration' }).click();
    await openWall(page, 'Vägg 2');
    await page.getByRole('button', { name: 'Lägg till fönster' }).click();
    await expect.poll(() => measureHeadingGap(page, /^Fönster/)).toBeLessThanOrEqual(HEADING_GAP_PX);
    await openWall(page, 'Vägg 2');
    await page.getByRole('button', { name: 'Lägg till sektion' }).click();
    await expect.poll(() => measureHeadingGap(page, /^Sektion S2/)).toBeLessThanOrEqual(HEADING_GAP_PX);
    await expect(page.getByRole('button', { name: 'Dölj konfiguration' })).toBeInViewport();
  });

  test('rullar panelen så att dörren man trycker på står överst', async ({ page }) => {
    await page.goto('/');
    const view = page.locator('.viewport canvas');
    await page.waitForTimeout(1500);
    const before = await view.boundingBox();
    if (!before) throw new Error('3D-vyn saknas');
    await page.touchscreen.tap(before.x + before.width / 2, before.y + before.height * 0.6);
    await page.getByRole('button', { name: 'Lägg till dörr' }).click();
    // Dörren sitter mitt på framgaveln. Arket är uppfällt, så 3D-vyn är lägre än nyss.
    // Panelen står längst ner, så att den måste rulla upp till dörrens rubrik.
    const content = page.locator('.panel-content');
    await content.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await page.waitForTimeout(500);
    const after = await view.boundingBox();
    if (!after) throw new Error('3D-vyn saknas');
    await page.touchscreen.tap(after.x + after.width * 0.44, after.y + after.height * 0.69);
    const heading = page.getByRole('button', { name: /^Dörr/ });
    await expect(heading).toHaveAttribute('aria-expanded', 'true');
    await expect
      .poll(async () => {
        const [headingTop, contentTop] = await Promise.all([heading.evaluate((element) => element.getBoundingClientRect().top), content.evaluate((element) => element.getBoundingClientRect().top)]);
        return Math.abs(Math.round(headingTop - contentTop));
      })
      .toBeLessThanOrEqual(HEADING_GAP_PX);
    await expect(page.getByRole('button', { name: 'Dölj konfiguration' })).toBeInViewport();
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
  // Att vrida väljer ingen vägg.
  await expect(page.getByLabel(/^Längd/)).toHaveCount(0);
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

/** Knappen − eller + bredvid ett måttfält. */
function stepButton(page: Page, fieldLabel: string, name: 'Öka' | 'Minska') {
  return page.getByLabel(new RegExp(`^${fieldLabel}`)).locator('..').getByRole('button', { name });
}

/** Fäller ut en vägg på den öppna sektionen, t.ex. "Vägg 1". */
/** Hur långt rubriken står från panelens överkant, i px. */
async function measureHeadingGap(page: Page, name: RegExp) {
  const heading = page.getByRole('button', { name });
  const [headingTop, contentTop] = await Promise.all([heading.evaluate((element) => element.getBoundingClientRect().top), page.locator('.panel-content').evaluate((element) => element.getBoundingClientRect().top)]);
  return Math.abs(Math.round(headingTop - contentTop));
}

async function openWall(page: Page, name: string) {
  const wall = page.getByRole('button', { name, exact: true });
  if ((await wall.getAttribute('aria-expanded')) !== 'true') await wall.click();
}

/**
 * Väntar tills kameran har slutat röra sig efter att den ställts in på huset,
 * så att ett tryck på en viss punkt i 3D-vyn träffar. En fast väntetid räcker
 * inte när CI ritar långsamt.
 */
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
