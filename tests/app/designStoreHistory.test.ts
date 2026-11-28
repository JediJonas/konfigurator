import { beforeEach, describe, expect, it } from 'vitest';
import { listInstances } from '../../src/core/model/instanceTree';
import { useDesignStore } from '../../src/app/state/designStore';

const store = useDesignStore;

/** Mallens sektion med vägghöjden från schemats standardvärde. */
const SECTION = { id: 'S1', params: { wallHeight: 100 } };

describe('Ångra och Gör om i designStore', () => {
  beforeEach(() => {
    store.getState().resetDesign();
    store.getState().replaceDesign(store.getState().design);
  });

  it('ångrar en ändring av ett fält och gör om den', () => {
    const before = store.getState().design;
    const section = SECTION;
    store.getState().setParam(section.id, 'wallHeight', Number(section.params.wallHeight) - 10);
    const after = store.getState().design;
    expect(after).not.toBe(before);
    store.getState().undo();
    expect(store.getState().design).toBe(before);
    store.getState().redo();
    expect(store.getState().design).toBe(after);
  });

  it('ångrar flera snabba steg i samma fält med ett tryck', () => {
    const before = store.getState().design;
    const section = SECTION;
    const height = Number(section.params.wallHeight);
    for (let step = 1; step <= 3; step += 1) store.getState().setParam(section.id, 'wallHeight', height - step * 5);
    expect(store.getState().history.past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().design).toBe(before);
  });

  it('kan ångra Börja om', () => {
    const section = SECTION;
    store.getState().setParam(section.id, 'wallHeight', Number(section.params.wallHeight) - 10);
    const changed = store.getState().design;
    store.getState().resetDesign();
    expect(store.getState().design).not.toBe(changed);
    store.getState().undo();
    expect(store.getState().design).toBe(changed);
  });

  it('släpper valet av ett objekt som inte finns efter Ångra', () => {
    const section = SECTION;
    store.getState().addChild({ parentId: section.id, socketId: 'side-right', objectTypeId: 'gb.window' });
    const added = listInstances(store.getState().design.root).find((instance) => instance.type === 'gb.window');
    expect(added).toBeDefined();
    store.getState().focusInstance(added!.id);
    store.getState().undo();
    expect(store.getState().focusedInstance).toBeUndefined();
  });

  it('tömmer historiken när ett annat hus öppnas', () => {
    const section = SECTION;
    store.getState().setParam(section.id, 'wallHeight', Number(section.params.wallHeight) - 10);
    store.getState().replaceDesign(store.getState().design);
    expect(store.getState().history.past).toHaveLength(0);
  });

  it('kan ångra att ett sparat hus öppnas', () => {
    const before = store.getState().design;
    const other = { ...before, material: { ...before.material, thickness: 5 } };
    store.getState().openDesign(other, 'Kyrkan');
    expect(store.getState().design).toBe(other);
    expect(store.getState().houseName).toBe('Kyrkan');
    store.getState().undo();
    expect(store.getState().design).toBe(before);
  });
});
