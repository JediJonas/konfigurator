import { useEffect, useId, useRef, useState } from 'react';
import { useOpenInstance } from './useOpenInstance';
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
import { FieldGroup } from './FieldGroup';
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
  const { design, paper, setThickness, setPaper, selectSocket, selectedSocket } = useDesignStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [pdfState, setPdfState] = useState<'idle' | 'working' | 'failed'>('idle');
  const contentId = useId();
  const thicknessId = useId();
  const paperId = useId();
  const rootId = design.root.id;
  const canDownload = !error && !hasErrors(evaluation.violations);
  const instanceEntries = evaluation.placed.filter((entry) => entry.parentId !== undefined);
  const openInstance = useOpenInstance(instanceEntries.map((entry) => entry.instance.id), selectedSocket);
  const contentRef = useRef<HTMLDivElement>(null);
  // Trycker man på en vägg fälls arket upp i mobilen, så att måtten för den delen syns.
  const focusKey = selectedSocket ? `${selectedSocket.instanceId}/${selectedSocket.socketId}` : undefined;
  const [knownFocusKey, setKnownFocusKey] = useState(focusKey);
  if (focusKey !== knownFocusKey) {
    setKnownFocusKey(focusKey);
    if (focusKey) setIsExpanded(true);
  }
  const focusedInstanceId = selectedSocket?.instanceId;
  useEffect(() => {
    if (!focusKey || !focusedInstanceId) return;
    const section = contentRef.current?.querySelector(`[data-instance-id="${CSS.escape(focusedInstanceId)}"]`);
    section?.scrollIntoView({ block: 'nearest' });
  }, [focusKey, focusedInstanceId]);

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
        {isExpanded ? uiStrings.hideConfiguration : uiStrings.showConfiguration}
      </button>
      <div className="panel-content" id={contentId} ref={contentRef}>
        {instanceEntries.map((entry) => (
          <InstanceSettings
            key={entry.instance.id}
            entry={entry}
            isRemovable={entry.parentId !== rootId}
            isOpen={openInstance.isOpen(entry.instance.id)}
            onToggle={() => openInstance.toggle(entry.instance.id)}
            violations={evaluation.violations.filter((violation) => violation.instanceId === entry.instance.id)}
          />
        ))}
        {/* Ändras sällan, så sektionen är hopfälld från början som takets grupp. */}
        <section className="panel-section">
          <FieldGroup label={uiStrings.settings} headingLevel={2}>
            <NumberInput id={thicknessId} label={uiStrings.thickness} field={THICKNESS_FIELD} value={design.material.thickness} onChange={setThickness} />
            <div className="field">
              <label htmlFor={paperId}>{uiStrings.paper}</label>
              <select id={paperId} value={paper} onChange={(event) => setPaper(event.target.value as PaperFormat['id'])}>
                {Object.values(PAPER_FORMATS).map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.id}
                  </option>
                ))}
              </select>
            </div>
          </FieldGroup>
        </section>
        {error ? (
          <p className="design-error" role="alert">
            {uiStrings.invalidDesign} {error}
          </p>
        ) : null}
      </div>
      <div className="panel-actions">
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
