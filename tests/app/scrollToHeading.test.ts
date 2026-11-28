import { describe, expect, it } from 'vitest';
import { HEADING_SCROLL_MARGIN_PX, measureHeadingScrollTop, measureRevealScrollTop } from '../../src/app/ui/scrollToHeading';

describe('measureHeadingScrollTop', () => {
  it('rullar ner så att en rubrik längre ner står överst', () => {
    expect(measureHeadingScrollTop({ containerTop: 300, scrollTop: 100, headingTop: 700, maxScrollTop: 2000 })).toBe(500 - HEADING_SCROLL_MARGIN_PX);
  });

  it('rullar upp till en rubrik ovanför det synliga', () => {
    expect(measureHeadingScrollTop({ containerTop: 300, scrollTop: 600, headingTop: 100, maxScrollTop: 2000 })).toBe(400 - HEADING_SCROLL_MARGIN_PX);
  });

  it('stannar där rullytan tar slut', () => {
    expect(measureHeadingScrollTop({ containerTop: 300, scrollTop: 0, headingTop: 900, maxScrollTop: 250 })).toBe(250);
    expect(measureHeadingScrollTop({ containerTop: 300, scrollTop: 0, headingTop: 302, maxScrollTop: 250 })).toBe(0);
  });
});

describe('measureRevealScrollTop', () => {
  const base = { containerTop: 400, containerBottom: 800, scrollTop: 100, maxScrollTop: 2000 };

  it('står kvar när knapparna redan syns', () => {
    expect(measureRevealScrollTop({ ...base, elementTop: 500, elementBottom: 600 })).toBe(100);
  });

  it('rullar ner precis så långt att knapparna under kanten syns', () => {
    expect(measureRevealScrollTop({ ...base, elementTop: 760, elementBottom: 860 })).toBe(100 + 60 + HEADING_SCROLL_MARGIN_PX);
  });

  it('rullar upp till knappar ovanför det synliga', () => {
    expect(measureRevealScrollTop({ ...base, elementTop: 350, elementBottom: 450 })).toBe(100 - 50 - HEADING_SCROLL_MARGIN_PX);
  });

  it('visar överkanten när elementet är högre än rullytan', () => {
    expect(measureRevealScrollTop({ ...base, elementTop: 900, elementBottom: 1500 })).toBe(100 + 500 - HEADING_SCROLL_MARGIN_PX);
  });

  it('stannar där rullytan tar slut', () => {
    expect(measureRevealScrollTop({ ...base, maxScrollTop: 120, elementTop: 760, elementBottom: 860 })).toBe(120);
  });
});
