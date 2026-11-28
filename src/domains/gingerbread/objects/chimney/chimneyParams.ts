import { z } from 'zod';

export const MIN_CHIMNEY_SIZE_MM = 15;
export const MIN_CHIMNEY_HEIGHT_MM = 10;

/**
 * Skorstenens mått. Läget längs taket är kopplingspunktens u, och avståndet
 * från takfoten mäts längs lutningen till framsidans utsida. Bredden går
 * längs takfoten och djupet vågrätt in mot nocken. Höjden över taket mäts på
 * baksidan, där taket är högst, så att varje höjd går att bygga.
 *
 * Avståndet 0 betyder att skorstenen står på fatet mot väggen under takfoten
 * (`chimneyOnWall.ts`). Då mäts höjden över taket där det är högst sett rakt mot väggen.
 */
export const chimneyParams = z.object({
  eaveDistance: z.number().min(0).max(300).default(60).meta({ labelKey: 'param.chimneyEaveDistance', unit: 'mm', step: 5, isInherited: true }),
  width: z.number().min(MIN_CHIMNEY_SIZE_MM).max(100).default(25).meta({ labelKey: 'param.width', unit: 'mm', step: 5, isInherited: true }),
  depth: z.number().min(MIN_CHIMNEY_SIZE_MM).max(100).default(25).meta({ labelKey: 'param.chimneyDepth', unit: 'mm', step: 5, isInherited: true }),
  height: z.number().min(MIN_CHIMNEY_HEIGHT_MM).max(150).default(30).meta({ labelKey: 'param.chimneyHeight', unit: 'mm', step: 5, isInherited: true }),
});

export type ChimneyParams = z.infer<typeof chimneyParams>;
