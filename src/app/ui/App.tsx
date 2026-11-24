import { useMemo, useRef, useState } from 'react';
import type { Part } from '../../core/model/part';
import type { DesignEvaluation } from '../../core/rules/evaluateDesign';
import { evaluateDesign } from '../../core/rules/evaluateDesign';
import { activeDomain, translate } from '../activeDomain';
import { useDesignStore } from '../state/designStore';
import { DesignView } from '../three/DesignView';
import type { CaptureOverview } from '../three/OverviewCapture';
import { ViewportProbe } from '../device/ViewportProbe';
import { findSocketOwnedBy } from './socketSelection';
import { SettingsPanel } from './SettingsPanel';
import { uiStrings } from './strings.sv';

const EMPTY_EVALUATION: DesignEvaluation = { placed: [], parts: [], violations: [] };

type EvaluationResult = { evaluation: DesignEvaluation; error?: string };

export function App() {
  const design = useDesignStore((state) => state.design);
  const selectedSocket = useDesignStore((state) => state.selectedSocket);
  const selectSocket = useDesignStore((state) => state.selectSocket);
  const captureRef = useRef<CaptureOverview>(null);
  const [lastGoodParts, setLastGoodParts] = useState<Part[]>([]);
  const result = useMemo<EvaluationResult>(() => {
    try {
      return { evaluation: evaluateDesign(design, activeDomain, translate) };
    } catch (error) {
      return { evaluation: EMPTY_EVALUATION, error: error instanceof Error ? error.message : String(error) };
    }
  }, [design]);
  const { evaluation } = result;
  // Vid ett ogiltigt värde visas senaste giltiga huset i stället för ett tomt fat.
  if (!result.error && evaluation.parts !== lastGoodParts) setLastGoodParts(evaluation.parts);
  const material = activeDomain.materials.find((candidate) => candidate.id === design.material.id);
  const selectedPartId = evaluation.placed
    .find((entry) => entry.instance.id === selectedSocket?.instanceId)
    ?.sockets.find((socket) => socket.id === selectedSocket?.socketId)?.ownerPartId;

  return (
    <div className="app">
      <header className="toolbar">
        <h1>
          {uiStrings.appName} <span className="toolbar-domain">· {translate('domain.name')}</span>
        </h1>
      </header>
      <main className="workspace">
        <section className="viewport" aria-label={uiStrings.viewLabel}>
          <DesignView
            parts={result.error ? lastGoodParts : evaluation.parts}
            color={material?.color ?? '#a8652f'}
            captureRef={captureRef}
            selectedPartId={selectedPartId}
            onSelectPart={(partId) => selectSocket(findSocketOwnedBy(evaluation.placed, partId))}
          />
          <p className="viewport-hint">{uiStrings.viewHint}</p>
        </section>
        <SettingsPanel evaluation={evaluation} error={result.error} captureOverview={captureRef} />
      </main>
      <ViewportProbe />
    </div>
  );
}
