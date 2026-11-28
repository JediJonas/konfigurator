import { create } from 'zustand';
import type { Design } from '../../core/model/design';
import type { PaperFormat } from '../../core/layout/paper';
import { findInstance, removeInstance } from '../../core/model/instanceTree';
import type { ChildRequest } from '../../core/rules/placement';
import { setParamWithinRules } from '../../core/rules/paramAdjustment';
import { snapAttachmentOffset } from '../../core/rules/placement';
import { addProposedChild } from '../../core/rules/addProposedChild';
import { activeDomain } from '../activeDomain';
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

interface DesignState {
  design: Design;
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
  /** Byter hela designen, t.ex. mot den som sparades senast. Historiken töms, eftersom det är ett annat hus. */
  replaceDesign: (design: Design) => void;
  /** Börjar om med domänens mall. Autosparet sparar mallen över det som var sparat. Går att ångra. */
  resetDesign: () => void;
  /** Tidigare och ångrade designer för Ångra och Gör om. */
  history: DesignHistory;
  /** Går tillbaka till designen före senaste ändringen. */
  undo: () => void;
  /** Gör om det som senast ångrades. */
  redo: () => void;
}

type DesignStateUpdate = Partial<DesignState>;

/** Ny design och historik efter en ändring; `mergeKey` slår ihop täta ändringar av samma sak till ett steg. */
function changeDesign(state: DesignState, design: Design, mergeKey?: string): DesignStateUpdate {
  if (design === state.design) return {};
  return { design, history: recordChange(state.history, state.design, design, { mergeKey, at: Date.now() }) };
}

/** Byter till en design ur historiken och släpper valen som pekar på objekt som inte finns i den. */
function showDesignFromHistory(state: DesignState, step: { design: Design; history: DesignHistory } | undefined): DesignStateUpdate {
  if (!step) return {};
  const exists = (instanceId: string | undefined) => instanceId !== undefined && findInstance(step.design.root, instanceId) !== undefined;
  return {
    design: step.design,
    history: step.history,
    selectedSocket: exists(state.selectedSocket?.instanceId) ? state.selectedSocket : undefined,
    focusedInstance: exists(state.focusedInstance?.instanceId) ? state.focusedInstance : undefined,
    selectedGroupSocket: exists(state.selectedGroupSocket?.instanceId) ? state.selectedGroupSocket : undefined,
  };
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
  removeChild: (instanceId) =>
    set((state) => ({
      ...changeDesign(state, { ...state.design, root: removeInstance(state.design.root, instanceId) }),
      selectedSocket: state.selectedSocket?.instanceId === instanceId ? undefined : state.selectedSocket,
      focusedInstance: state.focusedInstance?.instanceId === instanceId ? undefined : state.focusedInstance,
    })),
  moveAlongSocket: (instanceId, u) =>
    set((state) => changeDesign(state, snapAttachmentOffset(state.design, activeDomain, instanceId, u), `move:${instanceId}`)),
  replaceDesign: (design) =>
    set({ design, history: EMPTY_HISTORY, selectedSocket: undefined, focusedInstance: undefined, selectedGroupSocket: undefined }),
  resetDesign: () =>
    set((state) => ({ ...changeDesign(state, createStartDesign()), selectedSocket: undefined, focusedInstance: undefined, selectedGroupSocket: undefined })),
  undo: () => set((state) => showDesignFromHistory(state, undoChange(state.history, state.design))),
  redo: () => set((state) => showDesignFromHistory(state, redoChange(state.history, state.design))),
}));
