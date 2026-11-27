import { describe, expect, it } from 'vitest';
import { HEADING_SCROLL_MARGIN_PX, measureHeadingScrollTop } from '../../src/app/ui/scrollToHeading';

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
