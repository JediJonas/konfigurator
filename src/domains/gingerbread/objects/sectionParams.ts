import { z } from 'zod';

export const sectionParams = z.object({
  width: z.number().min(60).max(400).default(140).meta({ labelKey: 'param.width', unit: 'mm', step: 5 }),
  depth: z.number().min(60).max(400).default(180).meta({ labelKey: 'param.depth', unit: 'mm', step: 5 }),
  wallHeight: z.number().min(40).max(300).default(100).meta({ labelKey: 'param.wallHeight', unit: 'mm', step: 5 }),
  roof: z
    .enum(['gable'])
    .default('gable')
    .meta({ labelKey: 'param.roof', optionLabelKeys: { gable: 'roof.gable' }, groupKey: 'group.roof', isInherited: true }),
  roofPitch: z.number().min(20).max(60).default(45).meta({ labelKey: 'param.roofPitch', unit: '°', step: 1, groupKey: 'group.roof', isInherited: true }),
  eaveOverhang: z.number().min(0).max(40).default(10).meta({ labelKey: 'param.eaveOverhang', unit: 'mm', step: 1, groupKey: 'group.roof', isInherited: true }),
  gableOverhang: z.number().min(0).max(40).default(10).meta({ labelKey: 'param.gableOverhang', unit: 'mm', step: 1, groupKey: 'group.roof', isInherited: true }),
});

export type SectionParams = z.infer<typeof sectionParams>;
