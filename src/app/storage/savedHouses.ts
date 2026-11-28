import type { Design } from '../../core/model/design';
import type { Domain } from '../../core/model/domain';
import { OPEN_PROJECT_ID } from './autosave';
import type { CameraView } from '../state/cameraView';
import { readCameraView } from '../state/cameraView';
import type { ProjectMeta, ProjectStore } from './projectStore';
import { readStoredDesign } from './storedDesign';

/** Sparade hus i domänen, senast ändrat först. Det öppna huset, som sparas av sig självt, räknas inte. */
export async function listSavedHouses(store: ProjectStore, domainId: string): Promise<ProjectMeta[]> {
  return (await store.list()).filter((meta) => meta.id !== OPEN_PROJECT_ID && meta.domain === domainId);
}

/** Det sparade huset med namnet, oavsett stora och små bokstäver och mellanslag runt om. */
export function findHouseNamed(houses: readonly ProjectMeta[], name: string): ProjectMeta | undefined {
  const wanted = normalizeName(name);
  return houses.find((house) => normalizeName(house.name) === wanted);
}

/** Huset som sparas, under vilket namn och med vilken vinkel. */
export interface HouseToSave {
  name: string;
  design: Design;
  view?: CameraView;
}

/** Sparar huset under ett namn, med kamerans vinkel om den finns. Finns ett hus med samma namn ersätts det. */
export async function saveHouse(store: ProjectStore, house: HouseToSave, now: Date = new Date()): Promise<ProjectMeta> {
  const { name, design, view } = house;
  const houses = await listSavedHouses(store, design.domain);
  const id = findHouseNamed(houses, name)?.id ?? createHouseId(now);
  const meta: ProjectMeta = { id, name: name.trim(), domain: design.domain, updatedAt: now.toISOString() };
  await store.save({ ...meta, design, ...(view ? { view } : {}) });
  return meta;
}

/** Öppnar ett sparat hus i dagens format, med vinkeln det sparades med. Kastar om det inte går att öppna. */
export async function openHouse(store: ProjectStore, id: string, domain: Domain): Promise<{ design: Design; name: string; view?: CameraView }> {
  const project = await store.load(id);
  return { design: readStoredDesign(project.design, domain), name: project.name, view: readCameraView(project.view) };
}

/** Byter namn utan att ändra när huset ändrades senast. */
export async function renameHouse(store: ProjectStore, id: string, name: string): Promise<void> {
  const project = await store.load(id);
  await store.save({ ...project, name: name.trim() });
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('sv');
}

function createHouseId(now: Date): string {
  return `house-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
