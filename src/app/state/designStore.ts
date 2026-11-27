import { create } from 'zustand';
import type { Design } from '../../core/model/design';
import type { PaperFormat } from '../../core/layout/paper';
import { addChildInstance, removeInstance } from '../../core/model/instanceTree';
import type { ChildRequest } from '../../core/rules/placement';
import { setParamWithinRules } from '../../core/rules/paramAdjustment';
import { proposeChild, snapAttachmentOffset } from '../../core/rules/placement';
import { activeDomain } from '../activeDomain';

/** Objektet eller fältgruppen som öppnades med ett tryck i 3D-vyn. */
export interface FocusedInstance {
  instanceId: string;
  /** Fältgruppen som ska fällas ut, t.ex. taket. */
  groupKey?: string;
  count: number;
}

/** En kopplingspunkt på ett visst objekt, t.ex. högra långväggen på S1. */
export interface SocketRef {
  instanceId: string;
  socketId: string;
  /** Fältgruppen som fälls ut när väggen väljs i 3D-vyn, t.ex. måtten. */
  groupKey?: string;
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
  /** Objektet som är öppet i panelen; det visas markerat i 3D-vyn när det är ett fönster eller en dörr. */
  openInstanceId?: string;
  /** Falskt efter ett tryck utanför huset: det öppna fönstret visas då inte längre markerat. */
  isOpenInstanceHighlighted: boolean;
  /** Sätter ett fält. Gör ett nytt val, t.ex. taktypen, att en ärvd lutning inte går flyttas lutningen till närmaste som går. */
  setParam: (instanceId: string, key: string, value: unknown) => void;
  setThickness: (thickness: number) => void;
  setPaper: (paper: PaperFormat['id']) => void;
  selectSocket: (socket: SocketRef | undefined) => void;
  /** Öppnar ett objekt i panelen, t.ex. fönstret man tryckte på. Väljer bort vald kopplingspunkt. */
  focusInstance: (instanceId: string, groupKey?: string) => void;
  setOpenInstanceId: (instanceId: string | undefined) => void;
  /** Lägger till ett objekt som snäpper mitt i kopplingspunkten. Gör inget om reglerna inte tillåter det. */
  addChild: (request: ChildRequest) => void;
  removeChild: (instanceId: string) => void;
  /** Flyttar ett objekt längs sin kopplingspunkt till närmaste tillåtna snäppläge. */
  moveAlongSocket: (instanceId: string, u: number) => void;
  /** Byter hela designen, t.ex. mot den som sparades senast. */
  replaceDesign: (design: Design) => void;
  /** Börjar om med domänens mall. Autosparet sparar mallen över det som var sparat. */
  resetDesign: () => void;
}

function createStartDesign(): Design {
  const preset = activeDomain.presets[0];
  if (!preset) throw new Error(`Domänen "${activeDomain.id}" har ingen mall att börja från.`);
  return preset.create();
}

export const useDesignStore = create<DesignState>((set) => ({
  design: createStartDesign(),
  paper: 'A4',
  setParam: (instanceId, key, value) => set((state) => ({ design: setParamWithinRules(state.design, activeDomain, { instanceId, key, value }) })),
  setThickness: (thickness) => set((state) => ({ design: { ...state.design, material: { ...state.design.material, thickness } } })),
  setPaper: (paper) => set({ paper }),
  isOpenInstanceHighlighted: true,
  selectSocket: (socket) =>
    set((state) => ({
      selectedSocket: socket ? { ...socket, count: (state.selectedSocket?.count ?? state.focusedInstance?.count ?? 0) + 1 } : undefined,
      focusedInstance: undefined,
      // Inget valt, t.ex. ett tryck utanför huset, släcker också det öppna fönstrets markering.
      isOpenInstanceHighlighted: socket !== undefined,
    })),
  focusInstance: (instanceId, groupKey) =>
    set((state) => ({
      selectedSocket: undefined,
      focusedInstance: { instanceId, groupKey, count: (state.focusedInstance?.count ?? 0) + 1 },
      isOpenInstanceHighlighted: true,
    })),
  setOpenInstanceId: (openInstanceId) => set({ openInstanceId, isOpenInstanceHighlighted: true }),
  addChild: (request) =>
    set((state) => {
      const proposal = proposeChild(state.design, activeDomain, request);
      if (proposal.violations.length > 0) return {};
      return { design: { ...state.design, root: addChildInstance(state.design.root, request.parentId, proposal.instance) } };
    }),
  removeChild: (instanceId) =>
    set((state) => ({
      design: { ...state.design, root: removeInstance(state.design.root, instanceId) },
      selectedSocket: state.selectedSocket?.instanceId === instanceId ? undefined : state.selectedSocket,
      focusedInstance: state.focusedInstance?.instanceId === instanceId ? undefined : state.focusedInstance,
    })),
  moveAlongSocket: (instanceId, u) => set((state) => ({ design: snapAttachmentOffset(state.design, activeDomain, instanceId, u) })),
  replaceDesign: (design) => set({ design, selectedSocket: undefined, focusedInstance: undefined }),
  resetDesign: () => set({ design: createStartDesign(), selectedSocket: undefined, focusedInstance: undefined }),
}));
