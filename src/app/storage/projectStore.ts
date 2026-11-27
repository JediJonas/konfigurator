import type { Design } from '../../core/model/design';

/** Det som visas i en lista över sparade projekt, SPEC.md avsnitt 15. */
export interface ProjectMeta {
  id: string;
  name: string;
  domain: string;
  /** Liten bild som data-URL. */
  thumbnail?: string;
  /** ISO 8601. */
  updatedAt: string;
}

export interface Project extends ProjectMeta {
  /** Innehåller schemaversionen, för migrering. */
  design: Design;
}

/**
 * All lagring av projekt går via det här gränssnittet, så att en
 * serverlösning kan läggas till utan att resten av appen ändras. Det enda repositoryt.
 */
export interface ProjectStore {
  list(): Promise<ProjectMeta[]>;
  load(id: string): Promise<Project>;
  save(project: Project): Promise<void>;
  remove(id: string): Promise<void>;
}
