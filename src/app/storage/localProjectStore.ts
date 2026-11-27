import type { Project, ProjectMeta, ProjectStore } from './projectStore';

const PROJECT_KEY_PREFIX = 'konfigurator.project.';

/** Det lilla av webbläsarens lagring som behövs, så att det går att testa utan webbläsare. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

/**
 * Projekt i webbläsarens lokala lagring, ett per nyckel. Designerna är små,
 * så det räcker gott. Specen nämner IndexedDB; den kan ersätta det här bakom
 * samma gränssnitt när projekten får förhandsbilder.
 */
export function createLocalProjectStore(storage: KeyValueStorage): ProjectStore {
  const keys = () => Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => key?.startsWith(PROJECT_KEY_PREFIX) ?? false);
  const read = (key: string): Project | undefined => {
    try {
      return JSON.parse(storage.getItem(key) ?? 'null') as Project | undefined;
    } catch {
      return undefined;
    }
  };
  return {
    list: async () =>
      keys()
        .map(read)
        .filter((project): project is Project => project !== undefined && project !== null)
        .map((project): ProjectMeta => ({ id: project.id, name: project.name, domain: project.domain, thumbnail: project.thumbnail, updatedAt: project.updatedAt }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    load: async (id) => {
      const project = read(PROJECT_KEY_PREFIX + id);
      if (!project) throw new Error(`Projektet "${id}" finns inte.`);
      return project;
    },
    save: async (project) => storage.setItem(PROJECT_KEY_PREFIX + project.id, JSON.stringify(project)),
    remove: async (id) => storage.removeItem(PROJECT_KEY_PREFIX + id),
  };
}
