import { useEffect, useState } from 'react';

const PROBE_QUERY_PARAMETER = 'matt';
const PROBE_UNITS = ['100vh', '100svh', '100dvh', '100lvh'] as const;

/**
 * Mätruta som bara visas med ?matt i adressen. Chromium har inte Safaris
 * verktygsfält, så avståndet längst ner måste mätas på en riktig iPhone.
 */
export function ViewportProbe() {
  const isEnabled = new URLSearchParams(window.location.search).has(PROBE_QUERY_PARAMETER);
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (!isEnabled) return;
    const measure = () => setLines(measureViewport());
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [isEnabled]);

  if (!isEnabled) return null;
  return (
    <>
      <div className="probe-line" aria-hidden="true" />
      <pre className="probe">{lines.join('\n')}</pre>
    </>
  );
}

function measureViewport(): string[] {
  const lastButton = [...document.querySelectorAll('.panel-actions button')].at(-1);
  return [
    `screen ${screen.width}×${screen.height}`,
    `innerHeight ${window.innerHeight}`,
    `visualViewport ${window.visualViewport?.height.toFixed(1) ?? '–'}`,
    `clientHeight ${document.documentElement.clientHeight}`,
    ...PROBE_UNITS.map((unit) => `${unit} ${measureCssLength(unit)}`),
    `safe top ${measureCssLength('env(safe-area-inset-top)')}`,
    `safe bottom ${measureCssLength('env(safe-area-inset-bottom)')}`,
    `--bottom-gap ${measureCssLength('var(--bottom-gap)')}`,
    `display-mode browser ${matchMedia('(display-mode: browser)').matches}`,
    `pointer coarse ${matchMedia('(pointer: coarse)').matches}`,
    `portrait ${matchMedia('(orientation: portrait)').matches}`,
    `sista knappen slutar ${lastButton?.getBoundingClientRect().bottom.toFixed(1) ?? '–'}`,
  ];
}

function measureCssLength(length: string): string {
  const element = document.createElement('div');
  element.style.cssText = `position:absolute;visibility:hidden;height:${length}`;
  document.body.append(element);
  const height = element.getBoundingClientRect().height;
  element.remove();
  return height.toFixed(1);
}
