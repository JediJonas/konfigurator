import { create } from 'zustand';
import type { Design } from '../../core/model/design';
import type { PaperFormat } from '../../core/layout/paper';
import { findInstance } from '../../core/model/instanceTree';
import type { InstanceIdPrefixOf } from '../../core/model/instanceNumbering';
import { findRemoval, removeAndRenumber } from '../../core/model/instanceNumbering';
import type { ChildRequest } from '../../core/rules/placement';
import { setParamWithinRules } from '../../core/rules/paramAdjustment';
import { snapAttachmentOffset } from '../../core/rules/placement';
import { addProposedChild } from '../../core/rules/addProposedChild';
import { activeDomain } from '../activeDomain';
import type { CameraView } from './cameraView';
import type { DesignHistory } from './designHistory';
import { EMPTY_HISTORY, recordChange, redoChange, undoChange } from './designHistory';

/** Objektet eller fältgruppen som öppnades med ett tryck i 3D-vyn. */
export interface FocusedInstance {
  instanceId: string;
  /** Fältgruppen som ska fällas ut, t.ex. taket. */
  groupKey?: string;
  count: number;
}

/** En kopplingspunkt på ett visst objekt, t.ex. vägg 2 på S1. */
export interface SocketRef {
  instanceId: string;
  socketId: string;
  /** Ökar vid varje val, så att sektionen öppnas igen när man trycker på samma vägg en gång till. */
  count?: number;
}

/**
 * Id:n som byttes i senaste ändringen av designen, t.ex. S3 → S2 när S2 togs bort,
 * så att panelen kan hålla samma objekt öppet. Gäller bara när `design` är den öppna designen.
 */
export interface InstanceIdChange {
  design: Design;
  renames: ReadonlyMap<string, string>;
  removedIds: readonly string[];
  /** Objektet som kom tillbaka, t.ex. när en borttagning ångras. */
  addedId?: string;
}

interface DesignState {
  design: Design;
  /** Id:n som byttes i senaste borttagningen, eller när den ångrades eller gjordes om. */
  instanceIdChange?: InstanceIdChange;
  paper: PaperFormat['id'];
  /** Kopplingspunkten som är vald i 3D-vyn eller i panelen. */
  selectedSocket?: SocketRef;
  /**
   * Objektet man tryckte på i 3D-vyn när det inte har någon kopplingspunkt, t.ex. ett fönster,
   * eller fältgruppen man tryckte på, t.ex. en sektions tak. Räknaren ökar vid varje tryck,
   * så att objektet och gruppen öppnas igen om man har stängt dem.
   */
  focusedInstance?: FocusedInstance;
  /**
   * Kopplingspunkten i en fältgrupp som knapparna i gruppen lägger till på,
   * t.ex. takfallet man tryckte på för + Takkupa och + Skorsten. Står kvar
   * när annat väljs, så att samma takfall gäller när Tak öppnas igen.
   */
  selectedGroupSocket?: SocketRef;
  /** Objektet som är öppet i panelen; det visas markerat i 3D-vyn när det är ett fönster eller en dörr. */
  openInstanceId?: string;
  /** Falskt efter ett tryck utanför huset: det öppna fönstret visas då inte längre markerat. */
  isOpenInstanceHighlighted: boolean;
  /** Sätter ett fält. Gör ett nytt val, t.ex. taktypen, att en ärvd lutning inte går flyttas lutningen till närmaste som går. */
  setParam: (instanceId: string, key: string, value: unknown) => void;
  setThickness: (thickness: number) => void;
  setPaper: (paper: PaperFormat['id']) => void;
  selectSocket: (socket: SocketRef | undefined) => void;
  /**
   * Öppnar ett objekt i panelen, t.ex. fönstret man tryckte på. Väljer bort vald kopplingspunkt.
   * Med `groupSocketId` väljs också kopplingspunkten i gruppen, t.ex. takfallet man tryckte på.
   */
  focusInstance: (instanceId: string, groupKey?: string, groupSocketId?: string) => void;
  /** Väljer takfallet som knapparna under Tak lägger till på, utan att öppna eller rulla något. */
  selectGroupSocket: (socket: SocketRef) => void;
  setOpenInstanceId: (instanceId: string | undefined) => void;
  /** Lägger till ett objekt som snäpper mitt i kopplingspunkten. Gör inget om reglerna inte tillåter det. */
  addChild: (request: ChildRequest) => void;
  removeChild: (instanceId: string) => void;
  /** Flyttar ett objekt längs sin kopplingspunkt till närmaste tillåtna snäppläge. */
  moveAlongSocket: (instanceId: string, u: number) => void;
  /** Namnet huset senast sparades eller öppnades under; föreslås när man sparar igen. */
  houseName?: string;
  /** Byter hela designen, t.ex. mot den som sparades senast. Historiken töms, eftersom det är ett annat hus. */
  replaceDesign: (design: Design, houseName?: string) => void;
  /**
   * Ändras när ett annat hus öppnas, så att 3D-vyn visar det med den sparade
   * vinkeln, eller ställer in kameran på det som med Centrera när ingen vinkel sparades.
   */
  viewRequest: ViewRequest;
  /** Öppnar ett sparat hus eller ett från en länk. Går att ångra, så att huset som var öppet går att få tillbaka. Kameran visar huset med den sparade vinkeln, annars ställs den in på huset. */
  openDesign: (design: Design, houseName?: string, view?: CameraView) => void;
  setHouseName: (houseName: string) => void;
  /** Börjar om med domänens mall. Autosparet sparar mallen över det som var sparat. Går att ångra. */
  resetDesign: () => void;
  /** Tidigare och ångrade designer för Ångra och Gör om. */
  history: DesignHistory;
  /** Går tillbaka till designen före senaste ändringen. */
  undo: () => void;
  /** Gör om det som senast ångrades. */
  redo: () => void;
}

/** Hur 3D-vyn ska visa ett hus som just öppnats. */
export interface ViewRequest {
  /** Ökar vid varje öppnat hus. */
  count: number;
  view?: CameraView;
}

type DesignStateUpdate = Partial<DesignState>;

/** Ny design och historik efter en ändring; `mergeKey` slår ihop täta ändringar av samma sak till ett steg. */
function changeDesign(state: DesignState, design: Design, mergeKey?: string): DesignStateUpdate {
  if (design === state.design) return {};
  return { design, history: recordChange(state.history, state.design, design, { mergeKey, at: Date.now() }) };
}

const instanceIdPrefixOf: InstanceIdPrefixOf = (typeId) => activeDomain.objectTypes.find((objectType) => objectType.id === typeId)?.instanceIdPrefix;

/** Id:n som byts när man går från `current` till `next`: en borttagning, eller en borttagning som ångras. */
function describeIdChange(current: Design, next: Design): InstanceIdChange | undefined {
  const removal = findRemoval(current.root, next.root, instanceIdPrefixOf);
  if (removal) return { design: next, renames: removal.renames, removedIds: removal.removedIds };
  const restored = findRemoval(next.root, current.root, instanceIdPrefixOf);
  if (!restored) return undefined;
  const renames = new Map([...restored.renames].map(([before, after]) => [after, before]));
  return { design: next, renames, removedIds: [], addedId: restored.removedId };
}

/**
 * Släpper valen som pekar på objekt som inte finns i den nya designen eller har bytt id,
 * så att inget annat objekt öppnas av sig självt. Vald takfall följer med sitt objekt.
 */
function keepSelections(state: DesignState, design: Design, change: InstanceIdChange | undefined): DesignStateUpdate {
  const isKept = (instanceId: string | undefined) =>
    instanceId !== undefined && !change?.renames.has(instanceId) && !change?.removedIds.includes(instanceId) && findInstance(design.root, instanceId) !== undefined;
  return {
    instanceIdChange: change,
    selectedSocket: isKept(state.selectedSocket?.instanceId) ? state.selectedSocket : undefined,
    focusedInstance: isKept(state.focusedInstance?.instanceId) ? state.focusedInstance : undefined,
    selectedGroupSocket: followSocket(state.selectedGroupSocket, design, change),
  };
}

/** Kopplingspunkten på samma objekt efter att id:n har bytts, eller ingen när objektet är borta. */
function followSocket(socket: SocketRef | undefined, design: Design, change: InstanceIdChange | undefined): SocketRef | undefined {
  if (!socket || change?.removedIds.includes(socket.instanceId)) return undefined;
  const instanceId = change?.renames.get(socket.instanceId) ?? socket.instanceId;
  return findInstance(design.root, instanceId) ? { ...socket, instanceId } : undefined;
}

/** Byter till en design ur historiken och släpper valen som pekar på objekt som inte finns i den. */
function showDesignFromHistory(state: DesignState, step: { design: Design; history: DesignHistory } | undefined): DesignStateUpdate {
  if (!step) return {};
  return { design: step.design, history: step.history, ...keepSelections(state, step.design, describeIdChange(state.design, step.design)) };
}

/** Tar bort objektet och numrerar om de andra av samma sort, t.ex. S3 och S4 blir S2 och S3 när S2 tas bort. */
function removeFromDesign(state: DesignState, instanceId: string): DesignStateUpdate {
  const removal = removeAndRenumber(state.design.root, instanceId, instanceIdPrefixOf);
  const design = { ...state.design, root: removal.root };
  return { ...changeDesign(state, design), ...keepSelections(state, design, { design, renames: removal.renames, removedIds: removal.removedIds }) };
}

function createStartDesign(): Design {
  const preset = activeDomain.presets[0];
  if (!preset) throw new Error(`Domänen "${activeDomain.id}" har ingen mall att börja från.`);
  return preset.create();
}

export const useDesignStore = create<DesignState>((set) => ({
  design: createStartDesign(),
  paper: 'A4',
  history: EMPTY_HISTORY,
  setParam: (instanceId, key, value) =>
    set((state) => changeDesign(state, setParamWithinRules(state.design, activeDomain, { instanceId, key, value }), `param:${instanceId}:${key}`)),
  setThickness: (thickness) =>
    set((state) => changeDesign(state, { ...state.design, material: { ...state.design.material, thickness } }, 'thickness')),
  setPaper: (paper) => set({ paper }),
  isOpenInstanceHighlighted: true,
  selectSocket: (socket) =>
    set((state) => ({
      selectedSocket: socket ? { ...socket, count: (state.selectedSocket?.count ?? state.focusedInstance?.count ?? 0) + 1 } : undefined,
      focusedInstance: undefined,
      // Inget valt, t.ex. ett tryck utanför huset, släcker också det öppna fönstrets markering.
      isOpenInstanceHighlighted: socket !== undefined,
    })),
  focusInstance: (instanceId, groupKey, groupSocketId) =>
    set((state) => ({
      selectedSocket: undefined,
      focusedInstance: { instanceId, groupKey, count: (state.focusedInstance?.count ?? 0) + 1 },
      isOpenInstanceHighlighted: true,
      selectedGroupSocket: groupSocketId ? { instanceId, socketId: groupSocketId } : state.selectedGroupSocket,
    })),
  selectGroupSocket: (selectedGroupSocket) => set({ selectedGroupSocket, isOpenInstanceHighlighted: true }),
  setOpenInstanceId: (openInstanceId) => set({ openInstanceId, isOpenInstanceHighlighted: true }),
  addChild: (request) => set((state) => changeDesign(state, addProposedChild(state.design, activeDomain, request))),
  removeChild: (instanceId) => set((state) => removeFromDesign(state, instanceId)),
  moveAlongSocket: (instanceId, u) =>
    set((state) => changeDesign(state, snapAttachmentOffset(state.design, activeDomain, instanceId, u), `move:${instanceId}`)),
  replaceDesign: (design, houseName) =>
    set({ design, houseName, history: EMPTY_HISTORY, selectedSocket: undefined, focusedInstance: undefined, selectedGroupSocket: undefined }),
  viewRequest: { count: 0 },
  openDesign: (design, houseName, view) =>
    set((state) => ({ ...changeDesign(state, design), houseName, viewRequest: { count: state.viewRequest.count + 1, view }, selectedSocket: undefined, focusedInstance: undefined, selectedGroupSocket: undefined })),
  setHouseName: (houseName) => set({ houseName }),
  resetDesign: () =>
    set((state) => ({ ...changeDesign(state, createStartDesign()), selectedSocket: undefined, focusedInstance: undefined, selectedGroupSocket: undefined })),
  undo: () => set((state) => showDesignFromHistory(state, undoChange(state.history, state.design))),
  redo: () => set((state) => showDesignFromHistory(state, redoChange(state.history, state.design))),
}));
