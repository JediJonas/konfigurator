import { z } from 'zod';

/**
 * Metadata som formulären behöver utöver själva valideringen. Läggs på varje
 * fält med `.meta()` i objekttypens Zod-schema.
 */
export interface ParamMeta {
  labelKey: string;
  unit?: string;
  step?: number;
  /** Texter för valen i en lista, nyckel i domänens texter per värde. */
  optionLabelKeys?: Record<string, string>;
}

export type ParamField =
  | { kind: 'number'; key: string; meta: ParamMeta; min?: number; max?: number; defaultValue: number }
  | { kind: 'boolean'; key: string; meta: ParamMeta; defaultValue: boolean }
  | { kind: 'choice'; key: string; meta: ParamMeta; options: string[]; defaultValue: string };

export type ParamSchema = z.ZodObject;

/** Läser fälten i ett parameterschema så att UI:t kan bygga formuläret utan egen kod per objekttyp. */
export function describeParams(schema: ParamSchema): ParamField[] {
  return Object.entries(schema.shape).map(([key, field]) => describeField(key, field as z.ZodType));
}

function describeField(key: string, field: z.ZodType): ParamField {
  const meta = readMeta(key, field);
  const inner = field instanceof z.ZodDefault ? (field.unwrap() as z.ZodType) : field;
  const defaultValue: unknown = field instanceof z.ZodDefault ? field.def.defaultValue : undefined;
  if (inner instanceof z.ZodNumber) {
    return {
      kind: 'number',
      key,
      meta,
      min: inner.minValue ?? undefined,
      max: inner.maxValue ?? undefined,
      defaultValue: Number(defaultValue ?? inner.minValue ?? 0),
    };
  }
  if (inner instanceof z.ZodBoolean) {
    return { kind: 'boolean', key, meta, defaultValue: Boolean(defaultValue) };
  }
  if (inner instanceof z.ZodEnum) {
    const options = inner.options.map(String);
    return { kind: 'choice', key, meta, options, defaultValue: String(defaultValue ?? options[0]) };
  }
  throw new Error(`Parametern "${key}" har en typ som formulären inte kan visa.`);
}

function readMeta(key: string, field: z.ZodType): ParamMeta {
  const meta = field.meta() as Partial<ParamMeta> | undefined;
  if (!meta?.labelKey) throw new Error(`Parametern "${key}" saknar labelKey i .meta().`);
  return { ...meta, labelKey: meta.labelKey };
}
