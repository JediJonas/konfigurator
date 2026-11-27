/** Luft ovanför rubriken när panelen har rullat fram till den. */
export const HEADING_SCROLL_MARGIN_PX = 8;

interface ScrollMeasures {
  /** Rullytans överkant i fönstret. */
  containerTop: number;
  scrollTop: number;
  /** Rubrikens överkant i fönstret. */
  headingTop: number;
  maxScrollTop: number;
}

/** Var rullytan ska stå för att rubriken ska hamna överst, så långt ytan räcker. */
export function measureHeadingScrollTop({ containerTop, scrollTop, headingTop, maxScrollTop }: ScrollMeasures): number {
  const target = scrollTop + headingTop - containerTop - HEADING_SCROLL_MARGIN_PX;
  return Math.min(Math.max(target, 0), Math.max(maxScrollTop, 0));
}

/**
 * Rullar panelen så att rubriken står överst. Bara närmaste rullyta flyttas:
 * `scrollIntoView` skulle även kunna rulla arket i mobilen, som har `overflow: hidden`,
 * och då försvinner knappen "Dölj konfiguration".
 */
export function scrollHeadingToTop(heading: Element) {
  const container = findScrollContainer(heading);
  if (!container) return;
  const top = measureHeadingScrollTop({
    containerTop: container.getBoundingClientRect().top,
    scrollTop: container.scrollTop,
    headingTop: heading.getBoundingClientRect().top,
    maxScrollTop: container.scrollHeight - container.clientHeight,
  });
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  container.scrollTo({ top, behavior: isReducedMotion ? 'auto' : 'smooth' });
}

/** Närmaste förälder som rullar sitt innehåll: formuläret i mobilen, hela panelen på datorn. */
function findScrollContainer(element: Element): HTMLElement | undefined {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return undefined;
}
