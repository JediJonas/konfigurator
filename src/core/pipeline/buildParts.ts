import type { Matrix4 } from '../geometry/matrix';
import { identityMatrix, multiplyMatrices, rotationYMatrix, translationMatrix } from '../geometry/matrix';
import { degreesToRadians, vec3 } from '../geometry/vector';
import type { Design, Instance } from '../model/design';
import type { Domain } from '../model/domain';
import type { BuildContext, ObjectType, Socket } from '../model/objectType';
import type { Part } from '../model/part';
import { frameMatrix } from './frame';

/**
 * Flödet Design → delar. Allt som 3D-vyn och exporten visar kommer härifrån,
 * så att det man ser är exakt det som går att tillverka.
 */
export function buildParts(design: Design, domain: Domain): Part[] {
  const context: BuildContext = { thickness: design.material.thickness };
  const parts: Part[] = [];
  collectParts({ instance: design.root, parentMatrix: identityMatrix(), parentSockets: [], domain, context, parts });
  return parts;
}

interface CollectStep {
  instance: Instance;
  parentMatrix: Matrix4;
  parentSockets: Socket[];
  domain: Domain;
  context: BuildContext;
  parts: Part[];
}

function collectParts(step: CollectStep): void {
  const { instance, domain } = step;
  const context: BuildContext = { thickness: instance.thickness ?? step.context.thickness };
  const objectType = findObjectType(domain, instance.type);
  const params = parseParams(objectType, instance);
  const matrix = multiplyMatrices(step.parentMatrix, placementMatrix(instance, step.parentSockets));
  for (const part of objectType.parts(instance, params, context)) {
    step.parts.push({ ...part, transform: multiplyMatrices(matrix, part.transform) });
  }
  const sockets = objectType.sockets(instance, params, context);
  for (const child of instance.children) {
    collectParts({ ...step, instance: child, parentMatrix: matrix, parentSockets: sockets });
  }
}

export function findObjectType(domain: Domain, typeId: string): ObjectType<unknown> {
  const objectType = domain.objectTypes.find((candidate) => candidate.id === typeId);
  if (!objectType) throw new Error(`Okänd objekttyp "${typeId}" i domänen "${domain.id}".`);
  return objectType;
}

/** Fyller i standardvärden och kastar om något värde är ogiltigt. */
export function parseParams(objectType: ObjectType<unknown>, instance: Instance): Record<string, unknown> {
  return objectType.params.parse(instance.params);
}

function placementMatrix(instance: Instance, parentSockets: Socket[]): Matrix4 {
  const attachment = instance.attachment;
  if (!attachment) return identityMatrix();
  const socket = parentSockets.find((candidate) => candidate.id === attachment.socketId);
  if (!socket) throw new Error(`Kopplingspunkten "${attachment.socketId}" finns inte på föräldern till "${instance.id}".`);
  const offset = translationMatrix(vec3(attachment.u, 0, attachment.v));
  const rotation = rotationYMatrix(degreesToRadians(attachment.rotationDegrees));
  return multiplyMatrices(frameMatrix(socket.frame), multiplyMatrices(offset, rotation));
}
