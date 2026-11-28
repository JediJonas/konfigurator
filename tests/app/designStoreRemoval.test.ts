import { beforeEach, describe, expect, it } from 'vitest';
import { listInstances } from '../../src/core/model/instanceTree';
import { useDesignStore } from '../../src/app/state/designStore';

const store = useDesignStore;
const sectionIds = () => listInstances(store.getState().design.root).filter((instance) => instance.type === 'gb.section').map((instance) => instance.id);

/** Lägger till en sektion på en vägg på S1. */
function addSection(socketId: string) {
  store.getState().addChild({ parentId: 'S1', socketId, objectTypeId: 'gb.section' });
}

describe('borttagning i designStore', () => {
  beforeEach(() => {
    store.getState().resetDesign();
    store.getState().replaceDesign(store.getState().design);
    addSection('side-right');
    addSection('side-left');
    addSection('gable-front');
  });

  it('numrerar om sektionerna när en tas bort', () => {
    expect(sectionIds()).toEqual(['S1', 'S2', 'S3', 'S4']);
    const formerS3 = listInstances(store.getState().design.root).find((instance) => instance.id === 'S3')!;
    store.getState().removeChild('S2');
    expect(sectionIds()).toEqual(['S1', 'S2', 'S3']);
    expect(listInstances(store.getState().design.root).find((instance) => instance.id === 'S2')?.attachment).toEqual(formerS3.attachment);
    expect(store.getState().instanceIdChange?.renames).toEqual(new Map([['S3', 'S2'], ['S4', 'S3']]));
  });

  it('ger tillbaka de gamla numren när borttagningen ångras', () => {
    const before = store.getState().design;
    store.getState().removeChild('S2');
    store.getState().undo();
    expect(store.getState().design).toBe(before);
    expect(store.getState().instanceIdChange?.addedId).toBe('S2');
    expect(store.getState().instanceIdChange?.renames).toEqual(new Map([['S2', 'S3'], ['S3', 'S4']]));
  });

  it('släpper valet av en sektion som bytt nummer, så att ingen annan sektion öppnas', () => {
    store.getState().focusInstance('S3');
    store.getState().removeChild('S2');
    expect(store.getState().focusedInstance).toBeUndefined();
  });

  it('låter valt takfall följa med sin sektion', () => {
    store.getState().selectGroupSocket({ instanceId: 'S4', socketId: 'roof' });
    store.getState().removeChild('S2');
    expect(store.getState().selectedGroupSocket?.instanceId).toBe('S3');
  });
});
