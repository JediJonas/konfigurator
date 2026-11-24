import { useId, useState } from 'react';
import type { RefObject } from 'react';
import { buildDrawingPages } from '../../core/export/drawingDocument';
import { PAPER_FORMATS } from '../../core/layout/paper';
import type { PaperFormat } from '../../core/layout/paper';
import type { DesignEvaluation } from '../../core/rules/evaluateDesign';
import { hasErrors } from '../../core/rules/validateDesign';
import { downloadDrawingPdf } from '../export/downloadPdf';
import type { CaptureOverview } from '../three/OverviewCapture';
import { createDrawingRequest } from '../export/drawingRequest';
import { useDesignStore } from '../state/designStore';
import { AddObjectSection } from './AddObjectSection';
import { InstanceSettings } from './InstanceSettings';
import { NumberInput } from './ParamForm';
import { uiStrings } from './strings.sv';

interface SettingsPanelProps {
  evaluation: DesignEvaluation;
  error?: string;
  captureOverview: RefObject<CaptureOverview | null>;
}

const THICKNESS_FIELD = { kind: 'number', key: 'thickness', meta: { labelKey: 'thickness', unit: 'mm', step: 0.5 }, min: 2, max: 10, defaultValue: 4 } as const;

export function SettingsPanel({ evaluation, error, captureOverview }: SettingsPanelProps) {
  const { design, paper, setThickness, setPaper, selectSocket } = useDesignStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [pdfState, setPdfState] = useState<'idle' | 'working' | 'failed'>('idle');
  const contentId = useId();
  const thicknessId = useId();
  const paperId = useId();
  const rootId = design.root.id;
  const canDownload = !error && !hasErrors(evaluation.violations);

  async function handleDownload() {
    setPdfState('working');
    try {
      // Den valda väggen visas i en annan färg och ska inte synas i ritningens översiktsbild.
      selectSocket(undefined);
      await waitForRedraw();
      const request = createDrawingRequest({ design, parts: evaluation.parts, paper: PAPER_FORMATS[paper], overviewImage: captureOverview.current?.() });
      await downloadDrawingPdf(buildDrawingPages(request), PAPER_FORMATS[paper], uiStrings.pdfFileName);
      setPdfState('idle');
    } catch (pdfError) {
      console.error(pdfError);
      setPdfState('failed');
    }
  }

  return (
    <aside className="panel" data-expanded={isExpanded} aria-label={uiStrings.settings}>
      <button type="button" className="sheet-handle" aria-expanded={isExpanded} aria-controls={contentId} onClick={() => setIsExpanded(!isExpanded)}>
        {isExpanded ? uiStrings.hideSettings : uiStrings.showSettings}
      </button>
      <div className="panel-content" id={contentId}>
        {/* Överst, så att knappen syns direkt när man har tryckt på en vägg. */}
        <AddObjectSection placed={evaluation.placed} />
        {evaluation.placed
          .filter((entry) => entry.parentId !== undefined)
          .map((entry) => (
            <InstanceSettings
              key={entry.instance.id}
              entry={entry}
              isRemovable={entry.parentId !== rootId}
              violations={evaluation.violations.filter((violation) => violation.instanceId === entry.instance.id)}
            />
          ))}
        <section className="panel-section">
          <h2>{uiStrings.material}</h2>
          <NumberInput id={thicknessId} label={uiStrings.thickness} field={THICKNESS_FIELD} value={design.material.thickness} onChange={setThickness} />
        </section>
        {error ? (
          <p className="design-error" role="alert">
            {uiStrings.invalidDesign} {error}
          </p>
        ) : null}
      </div>
      <div className="panel-actions">
        <div className="field field-inline">
          <label htmlFor={paperId}>{uiStrings.paper}</label>
          <select id={paperId} value={paper} onChange={(event) => setPaper(event.target.value as PaperFormat['id'])}>
            {Object.values(PAPER_FORMATS).map((format) => (
              <option key={format.id} value={format.id}>
                {format.id}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="primary-button" onClick={handleDownload} disabled={pdfState === 'working' || !canDownload}>
          {pdfState === 'working' ? uiStrings.creatingPdf : uiStrings.downloadPdf}
        </button>
        {canDownload ? null : <p className="field-hint">{uiStrings.fixErrorsFirst}</p>}
        {pdfState === 'failed' ? (
          <p className="field-error" role="alert">
            {uiStrings.pdfFailed}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

/** Väntar tills React och 3D-vyn har ritat om efter en ändring i tillståndet. */
function waitForRedraw(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
