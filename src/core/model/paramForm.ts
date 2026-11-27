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
  /** Fält med samma grupp visas tillsammans under en rubrik som är hopfälld från början. Nyckel i domänens texter. */
  groupKey?: string;
  /**
   * Ett nytt objekt får värdet från föräldern när den är av samma typ, så att t.ex. taket
   * ärvs nedåt, annars från det senast skapade syskonet av samma typ, t.ex. förra fönstret.
   */
  isInherited?: boolean;
  /**
   * Fältet visas bara när andra fält har något av de angivna värdena, t.ex.
   * `{ roof: ['flat'] }`. Värdet finns kvar i parametrarna även när fältet är dolt.
   */
  visibleWhen?: Record<string, readonly string[]>;
}

/**
 * Ett glapp i ett talfält: värdena strikt mellan `after` och `before` går
 * inte, men båda ändarna gör det. T.ex. en tillbyggnad som blir för bred för
 * väggen men ännu inte kan stå bredvid den.
 */
export interface ValueGap {
  after: number;
  before: number;
}

export type ParamField =
  | { kind: 'number'; key: string; meta: ParamMeta; min?: number; max?: number; gaps?: readonly ValueGap[]; defaultValue: number }
  | { kind: 'boolean'; key: string; meta: ParamMeta; defaultValue: boolean }
  | { kind: 'choice'; key: string; meta: ParamMeta; options: string[]; defaultValue: string };

export type ParamSchema = z.ZodObject;

/** Värdena för de fält som ärvs, från föräldern eller syskonet som ärvs från. */
export function pickInheritedParams(schema: ParamSchema, sourceParams: Record<string, unknown>): Record<string, unknown> {
  const inheritedKeys = describeParams(schema).filter((field) => field.meta.isInherited && sourceParams[field.key] !== undefined);
  return Object.fromEntries(inheritedKeys.map((field) => [field.key, sourceParams[field.key]]));
}

/** Om fältet ska visas med de här värdena på de andra fälten. */
export function isFieldVisible(field: ParamField, values: Record<string, unknown>, fields: readonly ParamField[]): boolean {
  const conditions = Object.entries(field.meta.visibleWhen ?? {});
  return conditions.every(([key, allowed]) => {
    const other = fields.find((candidate) => candidate.key === key);
    const value = values[key] ?? (other ? other.defaultValue : undefined);
    return allowed.includes(String(value));
  });
}

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
