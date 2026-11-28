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

interface RevealMeasures {
  /** Rullytans över- och underkant i fönstret. */
  containerTop: number;
  containerBottom: number;
  scrollTop: number;
  /** Elementets över- och underkant i fönstret. */
  elementTop: number;
  elementBottom: number;
  maxScrollTop: number;
}

/**
 * Var rullytan ska stå för att hela elementet ska synas, med så liten rullning som möjligt.
 * Syns det redan står ytan kvar; är det högre än ytan hamnar dess överkant överst.
 */
export function measureRevealScrollTop({ containerTop, containerBottom, scrollTop, elementTop, elementBottom, maxScrollTop }: RevealMeasures): number {
  const margin = HEADING_SCROLL_MARGIN_PX;
  let target = scrollTop;
  if (elementBottom + margin > containerBottom) target = scrollTop + elementBottom + margin - containerBottom;
  if (elementTop - margin < containerTop + (target - scrollTop)) target = scrollTop + elementTop - margin - containerTop;
  return Math.min(Math.max(target, 0), Math.max(maxScrollTop, 0));
}

/**
 * Rullar panelen så att hela elementet syns, t.ex. knapparna för att bekräfta
 * längst ner i arket i mobilen. Bara närmaste rullyta flyttas, som för rubrikerna.
 */
export function revealInPanel(element: Element) {
  const container = findScrollContainer(element);
  if (!container) return;
  const containerBox = container.getBoundingClientRect();
  const elementBox = element.getBoundingClientRect();
  const top = measureRevealScrollTop({
    containerTop: containerBox.top,
    containerBottom: containerBox.top + container.clientHeight,
    scrollTop: container.scrollTop,
    elementTop: elementBox.top,
    elementBottom: elementBox.bottom,
    maxScrollTop: container.scrollHeight - container.clientHeight,
  });
  if (top === container.scrollTop) return;
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
