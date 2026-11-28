import { z } from 'zod';
import { ROOF_VALUES_WHEN_CHOSEN } from '../sectionParams';

/** Kupans tak har en egen grupp, så att den inte blandas ihop med husets tak som den står under. */
export const DORMER_ROOF_GROUP_KEY = 'group.dormerRoof';
/** Kupans tak ärvs från förra kupan på samma hus, men inte från huset (ägarens val). */
const roofField = { groupKey: DORMER_ROOF_GROUP_KEY, isInherited: true } as const;

/** Kupans taktyper: sadeltak med nocken ut från huset, eller pulpettak som lutar flackare än huset. */
export const DORMER_ROOF_TYPES = ['gable', 'shed'] as const;

export const MIN_DORMER_WIDTH_MM = 30;
export const MIN_DORMER_WALL_HEIGHT_MM = 15;

/**
 * Takkupans mått. Läget längs taket är kopplingspunktens u, och avståndet
 * från takfoten mäts längs lutningen till framväggens utsida. Djupet räknas
 * ut: kupan går in tills dess tak möter husets tak.
 */
export const dormerParams = z.object({
  eaveDistance: z.number().min(0).max(300).default(20).meta({ labelKey: 'param.eaveDistance', unit: 'mm', step: 5, isInherited: true }),
  width: z.number().min(MIN_DORMER_WIDTH_MM).max(200).default(50).meta({ labelKey: 'param.width', unit: 'mm', step: 5, isInherited: true }),
  wallHeight: z.number().min(MIN_DORMER_WALL_HEIGHT_MM).max(150).default(25).meta({ labelKey: 'param.wallHeight', unit: 'mm', step: 5, isInherited: true }),
  roof: z
    .enum(DORMER_ROOF_TYPES)
    .default('gable')
    .meta({
      labelKey: 'param.roof',
      optionLabelKeys: Object.fromEntries(DORMER_ROOF_TYPES.map((roof) => [roof, `roof.${roof}`])),
      valuesWhenChosen: ROOF_VALUES_WHEN_CHOSEN,
      ...roofField,
    }),
  roofPitch: z.number().min(10).max(60).default(45).meta({ labelKey: 'param.roofPitch', unit: '°', step: 1, ...roofField }),
  eaveOverhang: z.number().min(0).max(20).default(5).meta({ labelKey: 'param.eaveOverhang', unit: 'mm', step: 1, ...roofField }),
  gableOverhang: z.number().min(0).max(20).default(5).meta({ labelKey: 'param.gableOverhang', unit: 'mm', step: 1, ...roofField }),
});

export type DormerParams = z.infer<typeof dormerParams>;
