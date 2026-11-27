import type { InteractionResolver } from '../../../core/pipeline/interaction';
import { listSectionsInBuildings } from './buildings';
import { cutRoofsAtNeighbors, listRoofClashes } from './neighborRoofs';
import { joinSharedWalls } from './sharedWalls';

/**
 * Sektioner bredvid varandra (ägarens val, t.ex. en borg med höga torn och
 * låga block emellan, eller ett torn bredvid ett hus): där två byggnader står
 * vägg i vägg behålls den högre väggen, och tak som når in i den andra
 * byggnaden kapas mot dess väggar. Tak som går in i varandra blir ett fel,
 * eftersom det skulle behöva en vinkelränna; då passar en tillbyggnad bättre.
 *
 * Körs efter vinkelrännorna, så att tillbyggnadernas tak först läggs mot sin värd.
 */
export const neighborResolver: InteractionResolver = {
  id: 'gb.neighbors',
  resolve: (placed, parts) => {
    const sections = listSectionsInBuildings(placed);
    return cutRoofsAtNeighbors(sections, joinSharedWalls(sections, parts));
  },
  listConflicts: (placed) => listRoofClashes(listSectionsInBuildings(placed)),
};
