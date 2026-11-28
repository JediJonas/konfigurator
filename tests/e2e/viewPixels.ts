import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Så länge mellan två bilder av 3D-vyn när man väntar på att kameran står still. */
const VIEW_SETTLE_INTERVAL_MS = 300;
const VIEW_SETTLE_TIMEOUT_MS = 10_000;

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
