import { describe, expect, it } from 'vitest';
import { assignCornerRoles } from '../../src/domains/gingerbread/joints';

describe('hörnregeln för stumfog', () => {
  it('låter väggar med sned överkant gå ut (sadeltak: gavlarna)', () => {
    const roles = assignCornerRoles([
      { id: 'gable', hasSlopedTop: true, length: 140 },
      { id: 'side', hasSlopedTop: false, length: 180 },
    ]);
    expect(Object.fromEntries(roles)).toEqual({ gable: 'through', side: 'between' });
  });

  it('låter de längsta väggarna gå ut när alla överkanter är raka', () => {
    const roles = assignCornerRoles([
      { id: 'short', hasSlopedTop: false, length: 140 },
      { id: 'long', hasSlopedTop: false, length: 180 },
    ]);
    expect(Object.fromEntries(roles)).toEqual({ short: 'between', long: 'through' });
  });

  it('låter bara det första paret gå ut när väggarna är lika långa, som på ett kvadratiskt torn', () => {
    const roles = assignCornerRoles([
      { id: 'gable', hasSlopedTop: false, length: 120 },
      { id: 'side', hasSlopedTop: false, length: 120 },
    ]);
    expect(Object.fromEntries(roles)).toEqual({ gable: 'through', side: 'between' });
  });
});
