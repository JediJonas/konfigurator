import { useMemo, useRef, useState } from 'react';
import type { Part } from '../../core/model/part';
import type { DesignEvaluation } from '../../core/rules/evaluateDesign';
import { evaluateDesign } from '../../core/rules/evaluateDesign';
import { activeDomain, translate } from '../activeDomain';
import { useDesignStore } from '../state/designStore';
import { useSeenHints } from '../state/seenHints';
import { DesignView } from '../three/DesignView';
import type { FitView } from '../three/DesignView';
import type { CaptureOverview } from '../three/OverviewCapture';
import { ViewportProbe } from '../device/ViewportProbe';
import { listPickAreas } from '../three/pickAreas';
import { describeHighlight } from './selectionHighlight';
import { findLeafInstanceOf, findSocketOwnedBy } from './socketSelection';
import { SettingsPanel } from './SettingsPanel';
import { uiStrings } from './strings.sv';

const EMPTY_EVALUATION: DesignEvaluation = { placed: [], parts: [], violations: [] };

type EvaluationResult = { evaluation: DesignEvaluation; error?: string };

export function App() {
  const design = useDesignStore((state) => state.design);
  const selectedSocket = useDesignStore((state) => state.selectedSocket);
  const selectSocket = useDesignStore((state) => state.selectSocket);
  const focusInstance = useDesignStore((state) => state.focusInstance);
  const focusedInstance = useDesignStore((state) => state.focusedInstance);
  const openInstanceId = useDesignStore((state) => state.openInstanceId);
  const hasMovedView = useSeenHints((state) => state.seen.view);
  const markHintSeen = useSeenHints((state) => state.markHintSeen);
  const captureRef = useRef<CaptureOverview>(null);
  const fitRef = useRef<FitView>(null);
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
  const pickAreas = useMemo(() => listPickAreas(evaluation.placed), [evaluation.placed]);
  const material = activeDomain.materials.find((candidate) => candidate.id === design.material.id);
  const highlight = useMemo(
    () => describeHighlight(evaluation.placed, evaluation.parts, { selectedSocket, focusedInstance, openInstanceId }),
    [evaluation, selectedSocket, focusedInstance, openInstanceId],
  );

  return (
    <div className="app">
      <header className="toolbar">
        <h1>{uiStrings.appName}</h1>
        <span className="toolbar-domain">· {translate('domain.name')}</span>
      </header>
      <main className="workspace">
        <section className="viewport" aria-label={uiStrings.viewLabel}>
          <DesignView
            parts={result.error ? lastGoodParts : evaluation.parts}
            color={material?.color ?? '#a8652f'}
            captureRef={captureRef}
            fitRef={fitRef}
            highlight={highlight}
            onSelectPart={(partId) => {
              // En fönsterlucka eller ett dörrblad öppnar sitt fönster eller sin dörr.
              const leafId = partId ? findLeafInstanceOf(evaluation.placed, evaluation.parts, partId) : undefined;
              if (leafId) return focusInstance(leafId);
              const part = evaluation.parts.find((candidate) => candidate.id === partId);
              const found = findSocketOwnedBy(evaluation.placed, partId);
              // Taket öppnar takets fält på sektionen det hör till; en vägg väljs och fäller ut sektionens mått.
              if (!found && part?.paramGroupKey) return focusInstance(part.sourceInstanceId, part.paramGroupKey);
              const socket = found && part?.paramGroupKey ? { ...found, groupKey: part.paramGroupKey } : found;
              selectSocket(socket);
              if (socket) markHintSeen('addFromView');
            }}
            pickAreas={result.error ? [] : pickAreas}
            onSelectInstance={focusInstance}
            onUserMoveView={() => markHintSeen('view')}
          />
          {hasMovedView ? null : <p className="viewport-hint">{uiStrings.viewHint}</p>}
          <button type="button" className="fit-button" onClick={() => fitRef.current?.()}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
              <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            </svg>
            {uiStrings.fitView}
          </button>
        </section>
        <SettingsPanel evaluation={evaluation} error={result.error} captureOverview={captureRef} />
      </main>
      <ViewportProbe />
    </div>
  );
}
