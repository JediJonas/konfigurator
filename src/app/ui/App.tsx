import { useMemo, useRef, useState } from 'react';
import type { Part } from '../../core/model/part';
import { buildParts } from '../../core/pipeline/buildParts';
import { activeDomain, translate } from '../activeDomain';
import { useDesignStore } from '../state/designStore';
import { DesignView } from '../three/DesignView';
import type { CaptureOverview } from '../three/OverviewCapture';
import { ViewportProbe } from '../device/ViewportProbe';
import { SettingsPanel } from './SettingsPanel';
import { uiStrings } from './strings.sv';

type PartsResult = { parts: Part[]; error?: undefined } | { parts: Part[]; error: string };

export function App() {
  const design = useDesignStore((state) => state.design);
  const captureRef = useRef<CaptureOverview>(null);
  const [lastGoodParts, setLastGoodParts] = useState<Part[]>([]);
  const result = useMemo<PartsResult>(() => {
    try {
      return { parts: buildParts(design, activeDomain) };
    } catch (error) {
      return { parts: [], error: error instanceof Error ? error.message : String(error) };
    }
  }, [design]);
  // Vid ett ogiltigt värde visas senaste giltiga huset i stället för ett tomt fat.
  if (!result.error && result.parts !== lastGoodParts) setLastGoodParts(result.parts);
  const material = activeDomain.materials.find((candidate) => candidate.id === design.material.id);

  return (
    <div className="app">
      <header className="toolbar">
        <h1>
          {uiStrings.appName} <span className="toolbar-domain">· {translate('domain.name')}</span>
        </h1>
      </header>
      <main className="workspace">
        <section className="viewport" aria-label={uiStrings.viewLabel}>
          <DesignView parts={result.error ? lastGoodParts : result.parts} color={material?.color ?? '#a8652f'} captureRef={captureRef} />
          <p className="viewport-hint">{uiStrings.viewHint}</p>
        </section>
        <SettingsPanel parts={result.parts} error={result.error} captureOverview={captureRef} />
      </main>
      <ViewportProbe />
    </div>
  );
}
