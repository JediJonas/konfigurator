import type { Design, Instance } from '../../core/model/design';
import type { Domain } from '../../core/model/domain';

/**
 * Ett objekt som en kort lista: id, typ, fält, kopplingspunkt, u, v, vridning
 * och barn. Värden som är tomma eller noll i slutet tas bort.
 */
type PackedInstance = [id: string, type: string, params?: Record<string, unknown> | 0, socketId?: string | 0, u?: number, v?: number, rotationDegrees?: number, children?: PackedInstance[]];

/** En design som en kort lista: schemaversion, domänversion, material, tjocklek, roten och husets namn. */
export type PackedDesign = [version: number, domainVersion: number, materialId: string, thickness: number, root: PackedInstance, name?: string];

/**
 * Packar designen så kort som möjligt för en länk: fält med standardvärdet
 * tas bort, eftersom objekttypen fyller i dem igen när designen räknas.
 * Domänens id står inte med; länken öppnas i samma app.
 */
export function packDesign(design: Design, domain: Domain, name?: string): PackedDesign {
  const packed: PackedDesign = [design.version, design.domainVersion, design.material.id, design.material.thickness, packInstance(design.root, domain)];
  if (name) packed.push(name);
  return packed;
}

/** Packar upp en design från `packDesign`. Kastar om listan inte har rätt form. */
export function unpackDesign(packed: unknown, domain: Domain): { design: Design; name?: string } {
  if (!Array.isArray(packed)) throw new Error('Länken innehåller inget hus.');
  const [version, domainVersion, materialId, thickness, root, name] = packed as unknown[];
  if (typeof version !== 'number' || typeof domainVersion !== 'number' || typeof materialId !== 'string' || typeof thickness !== 'number') {
    throw new Error('Länken innehåller inget hus.');
  }
  return {
    design: { version, domain: domain.id, domainVersion, material: { id: materialId, thickness }, root: unpackInstance(root) },
    name: typeof name === 'string' ? name : undefined,
  };
}

function packInstance(instance: Instance, domain: Domain): PackedInstance {
  const params = withoutDefaultParams(instance, domain);
  const attachment = instance.attachment;
  const children = instance.children.map((child) => packInstance(child, domain));
  const packed: PackedInstance = [
    instance.id,
    instance.type,
    Object.keys(params).length > 0 ? params : 0,
    attachment?.socketId ?? 0,
    attachment?.u ?? 0,
    attachment?.v ?? 0,
    attachment?.rotationDegrees ?? 0,
    children,
  ];
  while (packed.length > 2 && isEmptyValue(packed[packed.length - 1])) packed.pop();
  return packed;
}

function unpackInstance(packed: unknown): Instance {
  if (!Array.isArray(packed)) throw new Error('Länken innehåller inget hus.');
  const [id, type, params, socketId, u, v, rotationDegrees, children] = packed as unknown[];
  if (typeof id !== 'string' || typeof type !== 'string') throw new Error('Länken innehåller inget hus.');
  return {
    id,
    type,
    params: typeof params === 'object' && params !== null ? (params as Record<string, unknown>) : {},
    ...(typeof socketId === 'string' ? { attachment: { socketId, u: Number(u ?? 0), v: Number(v ?? 0), rotationDegrees: Number(rotationDegrees ?? 0) } } : {}),
    children: Array.isArray(children) ? children.map(unpackInstance) : [],
  };
}

/** Fälten som skiljer sig från objekttypens standardvärden. Okända objekttyper behåller alla fält. */
function withoutDefaultParams(instance: Instance, domain: Domain): Record<string, unknown> {
  const objectType = domain.objectTypes.find((candidate) => candidate.id === instance.type);
  const defaults = objectType?.params.safeParse({});
  if (!defaults?.success) return instance.params;
  const defaultValues = defaults.data as Record<string, unknown>;
  return Object.fromEntries(Object.entries(instance.params).filter(([key, value]) => defaultValues[key] !== value));
}

function isEmptyValue(value: unknown): boolean {
  return value === 0 || (Array.isArray(value) && value.length === 0);
}
