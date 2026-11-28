import type { Matrix4 } from '../geometry/matrix';
import { identityMatrix, multiplyMatrices, rotationYMatrix, transformPoint, translationMatrix } from '../geometry/matrix';
import { degreesToRadians, vec3 } from '../geometry/vector';
import type { Design, Instance } from '../model/design';
import type { Domain } from '../model/domain';
import type { Modifier } from '../model/modifier';
import type { BuildContext, ObjectType, Socket, SurfaceArea } from '../model/objectType';
import type { Part } from '../model/part';
import { frameMatrix, transformFrame } from './frame';

/** Ett objekt med allt som flödet har räknat fram om det, i världens koordinater. */
export interface PlacedInstance {
  instance: Instance;
  objectType: ObjectType<unknown>;
  params: Record<string, unknown>;
  context: BuildContext;
  /** Objektets eget koordinatsystem i världen. */
  matrix: Matrix4;
  /** Kopplingspunkten objektet sitter i, i världen. Saknas för roten. */
  socket?: Socket;
  parentId?: string;
  /** Objektets egna kopplingspunkter, i världen. */
  sockets: Socket[];
  /** Objektets delar i världen, innan andra objekt har påverkat dem. */
  parts: Part[];
  /** Påverkan med områdena flyttade till världen. */
  modifiers: Modifier[];
  /** Ytorna objektet behöver på andra delar, i världen. */
  surfaceAreas: SurfaceArea[];
}

export interface PlaceOptions {
  /**
   * Hoppa över ett objekt, och allt som sitter på det, när förälderns
   * kopplingspunkt saknas, i stället för att kasta. Används när en ändring
   * kan ha tagit bort punkten, t.ex. ett takfall när taket vrids.
   */
  isSkippingDetached?: boolean;
}

/** Går igenom monteringsträdet och placerar varje objekt i förälderns kopplingspunkt. */
export function placeInstances(design: Design, domain: Domain, options: PlaceOptions = {}): PlacedInstance[] {
  const placed: PlacedInstance[] = [];
  const rootContext: BuildContext = { thickness: design.material.thickness };
  placeInstance({ instance: design.root, parentMatrix: identityMatrix(), parentSockets: [], domain, context: rootContext, placed, isSkippingDetached: options.isSkippingDetached ?? false });
  return placed;
}

interface PlaceStep {
  instance: Instance;
  parentMatrix: Matrix4;
  /** Förälderns kopplingspunkter i förälderns eget koordinatsystem. */
  parentSockets: Socket[];
  parentId?: string;
  domain: Domain;
  context: BuildContext;
  placed: PlacedInstance[];
  isSkippingDetached: boolean;
}

function placeInstance(step: PlaceStep): void {
  const { instance, domain } = step;
  const objectType = findObjectType(domain, instance.type);
  const params = parseParams(objectType, instance);
  if (step.isSkippingDetached && isDetached(instance, step.parentSockets)) return;
  const localSocket = findParentSocket(instance, step.parentSockets);
  const context: BuildContext = { thickness: instance.thickness ?? step.context.thickness, socket: localSocket, attachment: localSocket ? instance.attachment : undefined };
  const matrix = multiplyMatrices(step.parentMatrix, placementMatrix(instance, localSocket, objectType.mountMatrix?.(params, context)));
  const localSockets = objectType.sockets(instance, params, context);
  step.placed.push({
    instance,
    objectType,
    params,
    context,
    matrix,
    socket: localSocket && { ...localSocket, frame: transformFrame(step.parentMatrix, localSocket.frame) },
    parentId: step.parentId,
    sockets: localSockets.map((socket) => ({ ...socket, frame: transformFrame(matrix, socket.frame) })),
    parts: objectType.parts(instance, params, context).map((part) => ({ ...part, transform: multiplyMatrices(matrix, part.transform) })),
    modifiers: (objectType.modifiers?.(instance, params, context) ?? []).map((modifier) => ({
      ...modifier,
      region: modifier.region.map((point) => transformPoint(matrix, point)),
    })),
    surfaceAreas: (objectType.surfaceAreas?.(params, context) ?? []).map((area) => ({
      ...area,
      solidRegion: area.solidRegion.map((point) => transformPoint(matrix, point)),
      coveredRegion: area.coveredRegion.map((point) => transformPoint(matrix, point)),
    })),
  });
  for (const child of instance.children) {
    placeInstance({ ...step, instance: child, parentMatrix: matrix, parentSockets: localSockets, parentId: instance.id, context });
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

function isDetached(instance: Instance, parentSockets: readonly Socket[]): boolean {
  const attachment = instance.attachment;
  return attachment !== undefined && !parentSockets.some((socket) => socket.id === attachment.socketId);
}

function findParentSocket(instance: Instance, parentSockets: Socket[]): Socket | undefined {
  const attachment = instance.attachment;
  if (!attachment) return undefined;
  const socket = parentSockets.find((candidate) => candidate.id === attachment.socketId);
  if (!socket) throw new Error(`Kopplingspunkten "${attachment.socketId}" finns inte på föräldern till "${instance.id}".`);
  return socket;
}

function placementMatrix(instance: Instance, socket: Socket | undefined, mount: Matrix4 | undefined): Matrix4 {
  const attachment = instance.attachment;
  if (!attachment || !socket) return identityMatrix();
  const offset = translationMatrix(vec3(attachment.u, 0, attachment.v));
  const rotation = rotationYMatrix(degreesToRadians(attachment.rotationDegrees));
  return multiplyMatrices(frameMatrix(socket.frame), multiplyMatrices(offset, multiplyMatrices(rotation, mount ?? identityMatrix())));
}
