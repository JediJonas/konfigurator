import type { Design } from '../../core/model/design';
import type { DrawingRequest } from '../../core/export/drawingDocument';
import type { PaperFormat } from '../../core/layout/paper';
import type { Part } from '../../core/model/part';
import { activeDomain, translate } from '../activeDomain';

interface DrawingInput {
  design: Design;
  parts: Part[];
  paper: PaperFormat;
  overviewImage?: { dataUrl: string; aspectRatio: number };
}

/** Samlar det som ritningen behöver från designen och domänens texter. */
export function createDrawingRequest(input: DrawingInput): DrawingRequest {
  const material = activeDomain.materials.find((candidate) => candidate.id === input.design.material.id);
  const steps = [...new Set(input.parts.map((part) => part.buildStep))].sort((a, b) => a - b);
  return {
    parts: input.parts,
    paper: input.paper,
    resolveLabel: translate,
    overview: {
      title: translate('domain.name'),
      materialLabel: material ? translate(material.labelKey) : input.design.material.id,
      thickness: input.design.material.thickness,
      buildSteps: steps.map((step) => ({ step, label: translate(`buildStep.${step}`) })),
      notes: [translate('drawing.note.joints')],
      overviewImage: input.overviewImage,
    },
  };
}
