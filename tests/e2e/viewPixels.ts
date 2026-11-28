import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Så länge mellan två bilder av 3D-vyn när man väntar på att kameran står still. */
const VIEW_SETTLE_INTERVAL_MS = 300;
const VIEW_SETTLE_TIMEOUT_MS = 10_000;
/** Så många lika bilder i rad krävs, så att en kamera som glider långsamt inte räknas som stilla. */
const VIEW_SETTLE_STILL_COUNT = 3;

/** Antal bruna bildpunkter i 3D-vyn, alltså hur stort huset syns. */
export function countHousePixels(page: Page): Promise<number> {
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

/**
 * Väntar tills kameran har slutat röra sig efter att den ställts in på huset,
 * så att ett tryck på en viss punkt i 3D-vyn träffar. En fast väntetid räcker
 * inte när CI ritar långsamt.
 */
export async function waitForViewToSettle(page: Page) {
  let previous: number[] = [];
  let stillCount = 0;
  await expect
    .poll(
      async () => {
        await page.waitForTimeout(VIEW_SETTLE_INTERVAL_MS);
        const current = await takeViewSnapshot(page);
        // Efter ett drag glider kameran ut, och i CI ritar den långsamt; ett grovt rutnät tål de sista bildpunkterna.
        stillCount = isSameView(current, previous) ? stillCount + 1 : 0;
        previous = current;
        return stillCount >= VIEW_SETTLE_STILL_COUNT;
      },
      { timeout: VIEW_SETTLE_TIMEOUT_MS, intervals: [0] },
    )
    .toBe(true);
}

/** Rutnätets storlek när 3D-vyn jämförs; grovt nog att tåla någon bildpunkts skillnad. */
const SNAPSHOT_COLUMNS = 40;
const SNAPSHOT_ROWS = 28;
/** Högst så stor andel av rutorna får skilja sig för att två vyer räknas som lika. */
const SAME_VIEW_MAX_DIFFERENT_SHARE = 0.03;
/** Så stor skillnad i ljushet (0–255) mellan två rutor räknas som olika. */
const CELL_DIFFERENCE_LIMIT = 24;

/** 3D-vyn som ett grovt rutnät av ljushet, för att jämföra två vinklar. */
export function takeViewSnapshot(page: Page): Promise<number[]> {
  return page.evaluate(
    ([columns, rows]) => {
      const source = document.querySelector('.viewport canvas');
      if (!(source instanceof HTMLCanvasElement)) return [];
      const small = document.createElement('canvas');
      small.width = columns ?? 1;
      small.height = rows ?? 1;
      const context = small.getContext('2d');
      if (!context) return [];
      context.drawImage(source, 0, 0, small.width, small.height);
      const pixels = context.getImageData(0, 0, small.width, small.height).data;
      const cells: number[] = [];
      for (let i = 0; i < pixels.length; i += 4) cells.push(((pixels[i] ?? 0) + (pixels[i + 1] ?? 0) + (pixels[i + 2] ?? 0)) / 3);
      return cells;
    },
    [SNAPSHOT_COLUMNS, SNAPSHOT_ROWS],
  );
}

/** Sant när två vyer ser likadana ut, även om någon enstaka bildpunkt skiljer. */
export function isSameView(first: readonly number[], second: readonly number[]): boolean {
  if (first.length === 0 || first.length !== second.length) return false;
  const differing = first.filter((value, index) => Math.abs(value - (second[index] ?? 0)) > CELL_DIFFERENCE_LIMIT).length;
  return differing / first.length <= SAME_VIEW_MAX_DIFFERENT_SHARE;
}
