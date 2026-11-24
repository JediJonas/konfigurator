import { useId, useState } from 'react';
import type { RefObject } from 'react';
import { buildDrawingPages } from '../../core/export/drawingDocument';
import { PAPER_FORMATS } from '../../core/layout/paper';
import type { PaperFormat } from '../../core/layout/paper';
import type { Part } from '../../core/model/part';
import { describeParams } from '../../core/model/paramForm';
import { findObjectType } from '../../core/pipeline/buildParts';
import { activeDomain, translate } from '../activeDomain';
import { captureCanvasImage, downloadDrawingPdf } from '../export/downloadPdf';
import { createDrawingRequest } from '../export/drawingRequest';
import { listInstances, useDesignStore } from '../state/designStore';
import { NumberInput, ParamForm } from './ParamForm';
import { uiStrings } from './strings.sv';

interface SettingsPanelProps {
  parts: Part[];
  error?: string;
  viewRef: RefObject<HTMLElement | null>;
}

const THICKNESS_FIELD = { kind: 'number', key: 'thickness', meta: { labelKey: 'thickness', unit: 'mm', step: 0.5 }, min: 2, max: 10, defaultValue: 4 } as const;

export function SettingsPanel({ parts, error, viewRef }: SettingsPanelProps) {
  const { design, paper, setParam, setThickness, setPaper } = useDesignStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [pdfState, setPdfState] = useState<'idle' | 'working' | 'failed'>('idle');
  const contentId = useId();
  const thicknessId = useId();
  const paperId = useId();

  async function handleDownload() {
    setPdfState('working');
    try {
      const request = createDrawingRequest({ design, parts, paper: PAPER_FORMATS[paper], overviewImage: captureCanvasImage(viewRef.current) });
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
        {listInstances(design.root).map((instance) => {
          const objectType = findObjectType(activeDomain, instance.type);
          return (
            <section key={instance.id} className="panel-section">
              <h2>
                {translate(objectType.labelKey)} <span className="instance-id">{instance.id}</span>
              </h2>
              <ParamForm fields={describeParams(objectType.params)} values={instance.params} onChange={(key, value) => setParam(instance.id, key, value)} />
            </section>
          );
        })}
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
        <button type="button" className="primary-button" onClick={handleDownload} disabled={pdfState === 'working' || Boolean(error)}>
          {pdfState === 'working' ? uiStrings.creatingPdf : uiStrings.downloadPdf}
        </button>
        {pdfState === 'failed' ? (
          <p className="field-error" role="alert">
            {uiStrings.pdfFailed}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
