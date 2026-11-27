import { useEffect, useId, useRef, useState } from "react";
import { groupPanelEntries } from "./panelEntries";
import { useOpenInstance } from "./useOpenInstance";
import type { RefObject } from "react";
import { buildDrawingPages } from "../../core/export/drawingDocument";
import { PAPER_FORMATS } from "../../core/layout/paper";
import type { PaperFormat } from "../../core/layout/paper";
import type { DesignEvaluation } from "../../core/rules/evaluateDesign";
import { hasErrors } from "../../core/rules/validateDesign";
import { downloadDrawingPdf } from "../export/downloadPdf";
import type { CaptureOverview } from "../three/OverviewCapture";
import { createDrawingRequest } from "../export/drawingRequest";
import { useDesignStore } from "../state/designStore";
import { FieldGroup } from "./FieldGroup";
import { InstanceSettings } from "./InstanceSettings";
import { NumberInput } from "./NumberInput";
import { uiStrings } from "./strings.sv";

interface SettingsPanelProps {
  evaluation: DesignEvaluation;
  error?: string;
  captureOverview: RefObject<CaptureOverview | null>;
}

const THICKNESS_FIELD = {
  kind: "number",
  key: "thickness",
  meta: { labelKey: "thickness", unit: "mm", step: 0.5 },
  min: 2,
  max: 10,
  defaultValue: 4,
} as const;

export function SettingsPanel({
  evaluation,
  error,
  captureOverview,
}: SettingsPanelProps) {
  const {
    design,
    paper,
    setThickness,
    setPaper,
    selectSocket,
    selectedSocket,
    focusedInstance,
    setOpenInstanceId,
  } = useDesignStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [pdfState, setPdfState] = useState<"idle" | "working" | "failed">(
    "idle",
  );
  const contentId = useId();
  const thicknessId = useId();
  const paperId = useId();
  const rootId = design.root.id;
  const canDownload = !error && !hasErrors(evaluation.violations);
  const instanceEntries = evaluation.placed.filter(
    (entry) => entry.parentId !== undefined,
  );
  const panelEntries = groupPanelEntries(evaluation.placed);
  // Varje nytt val av vägg räknas, även på samma objekt, och varje tryck på ett fönster.
  const focus = selectedSocket
    ? {
        instanceId: selectedSocket.instanceId,
        key: `${selectedSocket.instanceId}/${selectedSocket.socketId}`,
      }
    : focusedInstance
      ? {
          instanceId: focusedInstance.instanceId,
          key: `${focusedInstance.instanceId}#${focusedInstance.count}`,
        }
      : undefined;
  const openInstance = useOpenInstance(
    instanceEntries.map((entry) => entry.instance.id),
    focus,
  );
  const openInstanceId = openInstance.openId;
  // 3D-vyn markerar fönstret eller dörren som är öppen i panelen.
  useEffect(
    () => setOpenInstanceId(openInstanceId),
    [openInstanceId, setOpenInstanceId],
  );
  const revealedGroup = selectedSocket?.groupKey
    ? {
        instanceId: selectedSocket.instanceId,
        groupKey: selectedSocket.groupKey,
        revealKey: selectedSocket.socketId,
      }
    : focusedInstance?.groupKey !== undefined
      ? {
          instanceId: focusedInstance.instanceId,
          groupKey: focusedInstance.groupKey,
          revealKey: String(focusedInstance.count),
        }
      : undefined;
  const contentRef = useRef<HTMLDivElement>(null);
  // Trycker man på en vägg eller ett fönster fälls arket upp i mobilen, så att måtten syns.
  const focusKey = focus?.key;
  const [knownFocusKey, setKnownFocusKey] = useState(focusKey);
  if (focusKey !== knownFocusKey) {
    setKnownFocusKey(focusKey);
    if (focusKey) setIsExpanded(true);
  }
  const focusedInstanceId = focus?.instanceId;
  const focusedGroupKey = selectedSocket
    ? selectedSocket.groupKey
    : focusedInstance?.groupKey;
  useEffect(() => {
    if (!focusKey || !focusedInstanceId) return;
    const section = contentRef.current?.querySelector(
      `[data-instance-id="${CSS.escape(focusedInstanceId)}"]`,
    );
    // Trycker man på taket rullar panelen fram till takets fält.
    const group = focusedGroupKey
      ? section?.querySelector(
          `[data-group-key="${CSS.escape(focusedGroupKey)}"]`,
        )
      : undefined;
    (group ?? section)?.scrollIntoView({ block: "nearest" });
  }, [focusKey, focusedInstanceId, focusedGroupKey]);

  async function handleDownload() {
    setPdfState("working");
    try {
      // Den valda väggen visas i en annan färg och ska inte synas i ritningens översiktsbild.
      selectSocket(undefined);
      await waitForRedraw();
      const request = createDrawingRequest({
        design,
        parts: evaluation.parts,
        paper: PAPER_FORMATS[paper],
        overviewImage: captureOverview.current?.(),
      });
      await downloadDrawingPdf(
        buildDrawingPages(request),
        PAPER_FORMATS[paper],
        uiStrings.pdfFileName,
      );
      setPdfState("idle");
    } catch (pdfError) {
      console.error(pdfError);
      setPdfState("failed");
    }
  }

  return (
    <aside
      className="panel"
      data-expanded={isExpanded}
      aria-label={uiStrings.settings}
    >
      <button
        type="button"
        className="sheet-handle"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? uiStrings.hideConfiguration : uiStrings.showConfiguration}
      </button>
      <div className="panel-content" id={contentId} ref={contentRef}>
        {panelEntries.map(({ entry, nested }) => {
          const isExpanded =
            openInstance.isOpen(entry.instance.id) ||
            nested.some((child) => openInstance.isOpen(child.instance.id));
          // Felen på fönster och dörrar syns på sektionen när den är stängd, så att inget som stoppar ritningen göms.
          const shownIds = new Set([
            entry.instance.id,
            ...(isExpanded ? [] : nested.map((child) => child.instance.id)),
          ]);
          return (
            <InstanceSettings
              key={entry.instance.id}
              entry={entry}
              isRemovable={entry.parentId !== rootId}
              isOpen={isExpanded}
              onToggle={() => openInstance.toggle(entry.instance.id)}
              violations={evaluation.violations.filter((violation) =>
                shownIds.has(violation.instanceId),
              )}
              revealedGroup={
                revealedGroup?.instanceId === entry.instance.id
                  ? revealedGroup
                  : undefined
              }
            >
              {nested.length > 0 ? (
                // Fönster och dörrar samlas under sektionen de sitter på och syns när den är utfälld (ägarens val).
                <div className="nested-instances">
                  {nested.map((child) => (
                    <InstanceSettings
                      key={child.instance.id}
                      entry={child}
                      headingLevel={3}
                      isRemovable
                      isOpen={openInstance.isOpen(child.instance.id)}
                      onToggle={() => openInstance.toggle(child.instance.id)}
                      violations={evaluation.violations.filter(
                        (violation) =>
                          violation.instanceId === child.instance.id,
                      )}
                    />
                  ))}
                </div>
              ) : null}
            </InstanceSettings>
          );
        })}
        {/* Ändras sällan, så sektionen är hopfälld från början som takets grupp. */}
        <section className="panel-section">
          <FieldGroup label={uiStrings.settings} headingLevel={2}>
            <NumberInput
              id={thicknessId}
              label={uiStrings.thickness}
              field={THICKNESS_FIELD}
              value={design.material.thickness}
              onChange={setThickness}
            />
            <div className="field">
              <label htmlFor={paperId}>{uiStrings.paper}</label>
              <select
                id={paperId}
                value={paper}
                onChange={(event) =>
                  setPaper(event.target.value as PaperFormat["id"])
                }
              >
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
        <button
          type="button"
          className="primary-button"
          onClick={handleDownload}
          disabled={pdfState === "working" || !canDownload}
        >
          {pdfState === "working"
            ? uiStrings.creatingPdf
            : uiStrings.downloadPdf}
        </button>
        {canDownload ? null : (
          <p className="field-hint">{uiStrings.fixErrorsFirst}</p>
        )}
        {pdfState === "failed" ? (
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
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}
