import { create } from 'zustand';
import type { Design } from '../../core/model/design';
import type { PaperFormat } from '../../core/layout/paper';
import { addChildInstance, removeInstance } from '../../core/model/instanceTree';
import type { ChildRequest } from '../../core/rules/placement';
import { setParamWithinRules } from '../../core/rules/paramAdjustment';
import { proposeChild, snapAttachmentOffset } from '../../core/rules/placement';
import { activeDomain } from '../activeDomain';

/** En kopplingspunkt på ett visst objekt, t.ex. högra långväggen på S1. */
export interface SocketRef {
  instanceId: string;
  socketId: string;
}

interface DesignState {
  design: Design;
  paper: PaperFormat['id'];
  /** Kopplingspunkten som är vald i 3D-vyn eller i panelen. */
  selectedSocket?: SocketRef;
  /** Sätter ett fält. Gör ett nytt val, t.ex. taktypen, att en ärvd lutning inte går flyttas lutningen till närmaste som går. */
  setParam: (instanceId: string, key: string, value: unknown) => void;
  setThickness: (thickness: number) => void;
  setPaper: (paper: PaperFormat['id']) => void;
  selectSocket: (socket: SocketRef | undefined) => void;
  /** Lägger till ett objekt som snäpper mitt i kopplingspunkten. Gör inget om reglerna inte tillåter det. */
  addChild: (request: ChildRequest) => void;
  removeChild: (instanceId: string) => void;
  /** Flyttar ett objekt längs sin kopplingspunkt till närmaste tillåtna snäppläge. */
  moveAlongSocket: (instanceId: string, u: number) => void;
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
  selectSocket: (selectedSocket) => set({ selectedSocket }),
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
    })),
  moveAlongSocket: (instanceId, u) => set((state) => ({ design: snapAttachmentOffset(state.design, activeDomain, instanceId, u) })),
}));
