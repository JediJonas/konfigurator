import { z } from 'zod';

/** Taktyperna i SPEC.md avsnitt 8. Tornspiran finns med fyra och åtta sidor. */
export const ROOF_TYPES = ['gable', 'shed', 'hip', 'mansard', 'flat', 'spire4', 'spire8'] as const;
export type RoofType = (typeof ROOF_TYPES)[number];

export const SPIRES: readonly RoofType[] = ['spire4', 'spire8'];
/** Tak med lutning (`roofPitch`). */
export const SLOPED_ROOFS: readonly RoofType[] = ['gable', 'shed', 'hip', 'mansard'];
/** Tak med gavlar eller sidor där takutsprånget vid gaveln gäller. */
const ROOFS_WITH_GABLE_OVERHANG: readonly RoofType[] = ['gable', 'shed', 'mansard'];

/** Fältgruppen för måtten; väggarna pekar på den, så att den fälls ut när man trycker på en vägg. */
export const DIMENSIONS_GROUP_KEY = 'group.dimensions';
const dimensionField = { groupKey: DIMENSIONS_GROUP_KEY } as const;
/** Fältgruppen för taket; takets delar pekar på den. */
export const ROOF_GROUP_KEY = 'group.roof';
const roofField = { groupKey: ROOF_GROUP_KEY, isInherited: true } as const;

export const sectionParams = z.object({
  width: z.number().min(60).max(400).default(140).meta({ labelKey: 'param.width', unit: 'mm', step: 5, ...dimensionField }),
  depth: z.number().min(60).max(400).default(180).meta({ labelKey: 'param.depth', unit: 'mm', step: 5, ...dimensionField }),
  wallHeight: z.number().min(40).max(300).default(100).meta({ labelKey: 'param.wallHeight', unit: 'mm', step: 5, ...dimensionField }),
  roof: z
    .enum(ROOF_TYPES)
    .default('gable')
    .meta({
      labelKey: 'param.roof',
      optionLabelKeys: Object.fromEntries(ROOF_TYPES.map((roof) => [roof, `roof.${roof}`])),
      ...roofField,
    }),
  isRoofTurned: z
    .boolean()
    .default(false)
    .meta({ labelKey: 'param.isRoofTurned', visibleWhen: { roof: SLOPED_ROOFS }, ...roofField }),
  roofPitch: z.number().min(10).max(60).default(45).meta({ labelKey: 'param.roofPitch', unit: '°', step: 1, visibleWhen: { roof: SLOPED_ROOFS }, ...roofField }),
  mansardLowerPitch: z
    .number()
    .min(50)
    .max(80)
    .default(70)
    .meta({ labelKey: 'param.mansardLowerPitch', unit: '°', step: 1, visibleWhen: { roof: ['mansard'] }, ...roofField }),
  mansardBreakHeight: z
    .number()
    .min(10)
    .max(150)
    .default(40)
    .meta({ labelKey: 'param.mansardBreakHeight', unit: 'mm', step: 5, visibleWhen: { roof: ['mansard'] }, ...roofField }),
  spirePitch: z.number().min(45).max(80).default(70).meta({ labelKey: 'param.spirePitch', unit: '°', step: 1, visibleWhen: { roof: SPIRES }, ...roofField }),
  rimHeight: z.number().min(5).max(40).default(15).meta({ labelKey: 'param.rimHeight', unit: 'mm', step: 1, visibleWhen: { roof: ['flat'] }, ...roofField }),
  eaveOverhang: z
    .number()
    .min(0)
    .max(40)
    .default(10)
    .meta({ labelKey: 'param.eaveOverhang', unit: 'mm', step: 1, ...roofField }),
  gableOverhang: z
    .number()
    .min(0)
    .max(40)
    .default(10)
    .meta({ labelKey: 'param.gableOverhang', unit: 'mm', step: 1, visibleWhen: { roof: ROOFS_WITH_GABLE_OVERHANG }, ...roofField }),
});

export type SectionParams = z.infer<typeof sectionParams>;

/** Taket är vridet 90° runt sin mitt, t.ex. sadeltakets nock tvärs över huset. Gäller bara tak med lutning. */
export function isRoofTurned(params: SectionParams): boolean {
  return params.isRoofTurned && SLOPED_ROOFS.includes(params.roof);
}
