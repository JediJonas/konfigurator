import { create } from 'zustand';
import type { Design, Instance } from '../../core/model/design';
import type { PaperFormat } from '../../core/layout/paper';
import { activeDomain } from '../activeDomain';

interface DesignState {
  design: Design;
  paper: PaperFormat['id'];
  setParam: (instanceId: string, key: string, value: unknown) => void;
  setThickness: (thickness: number) => void;
  setPaper: (paper: PaperFormat['id']) => void;
}

function createStartDesign(): Design {
  const preset = activeDomain.presets[0];
  if (!preset) throw new Error(`Domänen "${activeDomain.id}" har ingen mall att börja från.`);
  return preset.create();
}

export const useDesignStore = create<DesignState>((set) => ({
  design: createStartDesign(),
  paper: 'A4',
  setParam: (instanceId, key, value) =>
    set((state) => ({
      design: { ...state.design, root: updateInstance(state.design.root, instanceId, (instance) => ({ ...instance, params: { ...instance.params, [key]: value } })) },
    })),
  setThickness: (thickness) => set((state) => ({ design: { ...state.design, material: { ...state.design.material, thickness } } })),
  setPaper: (paper) => set({ paper }),
}));

/** Byter ut ett objekt i monteringsträdet utan att ändra resten, så att React ser vad som ändrats. */
export function updateInstance(instance: Instance, instanceId: string, update: (instance: Instance) => Instance): Instance {
  if (instance.id === instanceId) return update(instance);
  return { ...instance, children: instance.children.map((child) => updateInstance(child, instanceId, update)) };
}

/** Alla objekt utom roten, i trädordning, för listor i panelen. */
export function listInstances(root: Instance): Instance[] {
  return root.children.flatMap((child) => [child, ...listInstances(child)]);
}
