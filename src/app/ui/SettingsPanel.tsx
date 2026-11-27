import { useEffect, useId, useRef, useState } from 'react';
import { groupPanelEntries } from './panelEntries';
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
import type { OpenPart } from './SectionSettings';
import { SectionSettings } from './SectionSettings';
import { findOwnerPartId } from './panelWalls';
import { isLeafInstance } from './socketSelection';
import type { PlacedInstance } from '../../core/pipeline/placeInstances';
import type { FocusedInstance, SocketRef } from '../state/designStore';
import { StartOver } from './StartOver';
import { NumberInput } from './NumberInput';
import { uiStrings } from './strings.sv';

interface SettingsPanelProps {
  evaluation: DesignEvaluation;
  error?: string;
  captureOverview: RefObject<CaptureOverview | null>;
}

const THICKNESS_FIELD = { kind: 'number', key: 'thickness', meta: { labelKey: 'thickness', unit: 'mm', step: 0.5 }, min: 2, max: 10, defaultValue: 4 } as const;

export function SettingsPanel({ evaluation, error, captureOverview }: SettingsPanelProps) {
  const { design, paper, setThickness, setPaper, selectSocket, selectedSocket, focusedInstance, focusInstance, setOpenInstanceId } = useDesignStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [pdfState, setPdfState] = useState<'idle' | 'working' | 'failed'>('idle');
  const contentId = useId();
  const thicknessId = useId();
  const paperId = useId();
  const rootId = design.root.id;
  const canDownload = !error && !hasErrors(evaluation.violations);
  const instanceEntries = evaluation.placed.filter((entry) => entry.parentId !== undefined);
  const panelEntries = groupPanelEntries(evaluation.placed);
  // Varje nytt val av vägg räknas, även på samma objekt, och varje tryck på ett fönster.
  const focus = selectedSocket
    ? { instanceId: selectedSocket.instanceId, key: `${selectedSocket.instanceId}/${selectedSocket.socketId}#${selectedSocket.count ?? 0}` }
    : focusedInstance
      ? { instanceId: focusedInstance.instanceId, key: `${focusedInstance.instanceId}#${focusedInstance.count}` }
      : undefined;
  const openInstance = useOpenInstance(
    instanceEntries.map((entry) => entry.instance.id),
    focus,
  );
  const openInstanceId = openInstance.openId;
  // 3D-vyn markerar fönstret eller dörren som är öppen i panelen.
  useEffect(() => setOpenInstanceId(openInstanceId), [openInstanceId, setOpenInstanceId]);
  const openLeaf = instanceEntries.find((entry) => entry.instance.id === openInstanceId && isLeafInstance(entry));
  const [storedPart, setStoredPart] = useState<{ instanceId?: string; part: OpenPart }>({ part: {} });
  const contentRef = useRef<HTMLDivElement>(null);
  // Trycker man på en vägg, ett tak eller ett fönster fälls det ut och arket fälls upp i mobilen.
  const focusKey = focus?.key;
  const [knownFocusKey, setKnownFocusKey] = useState(focusKey);
  if (focusKey !== knownFocusKey) {
    setKnownFocusKey(focusKey);
    if (focusKey) setIsExpanded(true);
    const focusedPart = describeFocusedPart(evaluation.placed, selectedSocket, focusedInstance);
    if (focusedPart) setStoredPart(focusedPart);
  }
  // Ett öppet fönster eller en öppen dörr håller sin vägg utfälld.
  const openPart = openLeaf?.parentId
    ? { instanceId: openLeaf.parentId, part: { wallPartId: openLeaf.socket?.ownerPartId } }
    : storedPart;
  const focusedInstanceId = focus?.instanceId;
  const focusedGroupKey = selectedSocket ? findOwnerPartId(evaluation.placed.find((entry) => entry.instance.id === selectedSocket.instanceId), selectedSocket.socketId) : focusedInstance?.groupKey;
  useEffect(() => {
    if (!focusKey || !focusedInstanceId) return;
    const section = contentRef.current?.querySelector(`[data-instance-id="${CSS.escape(focusedInstanceId)}"]`);
    // Trycker man på en vägg eller taket rullar panelen fram till den.
    const group = focusedGroupKey ? section?.querySelector(`[data-group-key="${CSS.escape(focusedGroupKey)}"]`) : undefined;
    (group ?? section)?.scrollIntoView({ block: 'nearest' });
  }, [focusKey, focusedInstanceId, focusedGroupKey]);

  /** Fäller ut en vägg eller taket och markerar det i 3D-vyn, eller fäller ihop det. En sak i taget. */
  function togglePart(entry: PlacedInstance, part: OpenPart) {
    const instanceId = entry.instance.id;
    setStoredPart({ instanceId, part });
    openInstance.open(instanceId);
    const wall = part.wallPartId ? entry.sockets.find((socket) => socket.ownerPartId === part.wallPartId) : undefined;
    if (wall) selectSocket({ instanceId, socketId: wall.id });
    else if (part.groupKey) focusInstance(instanceId, part.groupKey);
    else selectSocket(undefined);
  }

  /** Fönster och dörrar fälls ut ett i taget; fälls ett ihop står väggen kvar öppen. */
  function toggleNested(child: PlacedInstance) {
    if (!openInstance.isOpen(child.instance.id)) return openInstance.open(child.instance.id);
    if (child.parentId) openInstance.open(child.parentId);
    setStoredPart({ instanceId: child.parentId, part: { wallPartId: child.socket?.ownerPartId } });
  }

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
        {panelEntries.map(({ entry, nested }) => {
          const isOpen = openInstance.isOpen(entry.instance.id) || nested.some((child) => openInstance.isOpen(child.instance.id));
          const shownIds = new Set([entry.instance.id, ...nested.map((child) => child.instance.id)]);
          return (
            <SectionSettings
              key={entry.instance.id}
              entry={entry}
              nested={nested}
              isRemovable={entry.parentId !== rootId}
              isOpen={isOpen}
              onToggle={() => {
                // Väggen som var markerad hör till den förra sektionen.
                selectSocket(undefined);
                openInstance.toggle(entry.instance.id);
              }}
              violations={evaluation.violations.filter((violation) => shownIds.has(violation.instanceId))}
              openPart={openPart.instanceId === entry.instance.id ? openPart.part : {}}
              onTogglePart={(part) => togglePart(entry, part)}
              isNestedOpen={(instanceId) => openInstance.isOpen(instanceId)}
              onToggleNested={(instanceId) => {
                const child = nested.find((candidate) => candidate.instance.id === instanceId);
                if (child) toggleNested(child);
              }}
            />
          );
        })}
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
            <StartOver />
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

/**
 * Vad ett tryck i 3D-vyn fäller ut inuti sin sektion: väggen man tryckte på,
 * taket, eller väggen som fönstret eller dörren sitter på.
 */
function describeFocusedPart(placed: readonly PlacedInstance[], selectedSocket: SocketRef | undefined, focusedInstance: FocusedInstance | undefined): { instanceId?: string; part: OpenPart } | undefined {
  if (selectedSocket) {
    const entry = placed.find((candidate) => candidate.instance.id === selectedSocket.instanceId);
    return { instanceId: selectedSocket.instanceId, part: { wallPartId: findOwnerPartId(entry, selectedSocket.socketId) } };
  }
  if (!focusedInstance) return undefined;
  if (focusedInstance.groupKey) return { instanceId: focusedInstance.instanceId, part: { groupKey: focusedInstance.groupKey } };
  const leaf = placed.find((candidate) => candidate.instance.id === focusedInstance.instanceId);
  return leaf && isLeafInstance(leaf) ? { instanceId: leaf.parentId, part: { wallPartId: leaf.socket?.ownerPartId } } : undefined;
}
