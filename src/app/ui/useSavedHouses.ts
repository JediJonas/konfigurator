import { useCallback, useEffect, useState } from 'react';
import { activeDomain } from '../activeDomain';
import type { ProjectMeta, ProjectStore } from '../storage/projectStore';
import { findBrowserProjectStore } from '../storage/openProject';
import { listSavedHouses } from '../storage/savedHouses';

/** De sparade husen i webbläsaren och lagringen de finns i. `store` saknas när webbläsaren inte tillåter lagring. */
export function useSavedHouses() {
  const [store] = useState(findBrowserProjectStore);
  const [houses, setHouses] = useState<ProjectMeta[]>([]);
  const reload = useCallback(() => readHouses(store).then(setHouses), [store]);
  useEffect(() => {
    let isCurrent = true;
    void readHouses(store).then((read) => {
      if (isCurrent) setHouses(read);
    });
    return () => {
      isCurrent = false;
    };
  }, [store]);
  return { store, houses, reload };
}

async function readHouses(store: ProjectStore | undefined): Promise<ProjectMeta[]> {
  if (!store) return [];
  try {
    return await listSavedHouses(store, activeDomain.id);
  } catch {
    return [];
  }
}
