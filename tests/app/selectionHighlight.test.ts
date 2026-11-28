import { describe, expect, it } from 'vitest';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { placeInstances } from '../../src/core/pipeline/placeInstances';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { describeHighlight } from '../../src/app/ui/selectionHighlight';
import { findGroupSocketOwning } from '../../src/app/ui/socketSelection';
import { designWithExtensions, extension } from '../domains/extensionFixtures';
import { windowOn } from '../domains/openingFixtures';

describe('markeringen i 3D-vyn', () => {
  const design = designWithExtensions(windowOn('side-left', { hasShutters: true }), extension('side-right'));
  const placed = placeInstances(design, gingerbreadDomain);
  const parts = buildParts(design, gingerbreadDomain);

  it('ger takets delar fältgruppen för taket, även efter vinkelrännan', () => {
    const roofIds = parts.filter((part) => part.paramGroupKey === 'group.roof').map((part) => part.id);
    expect(roofIds).toEqual(expect.arrayContaining(['S1/roof-left', 'S1/roof-right', 'S2/roof-left', 'S2/roof-right']));
    expect(roofIds.some((id) => id.includes('side'))).toBe(false);
    expect(parts.filter((part) => part.id.includes('side')).every((part) => part.paramGroupKey === undefined)).toBe(true);
  });

  it('markerar första takfallet på sektionen så länge den är öppen, innan något takfall är valt', () => {
    const focusedInstance = { instanceId: 'S2', groupKey: 'group.roof', count: 1 };
    expect([...describeHighlight(placed, parts, { focusedInstance, openInstanceId: 'S2' }).partIds]).toEqual(['S2/roof-right']);
    expect(describeHighlight(placed, parts, { focusedInstance, openInstanceId: 'S1' }).partIds.size).toBe(0);
  });

  it('markerar bara takfallet man tryckte på, även efter vinkelrännan', () => {
    const focusedInstance = { instanceId: 'S2', groupKey: 'group.roof', count: 1 };
    const roofLeft = parts.find((part) => part.id === 'S2/roof-left');
    const selectedGroupSocket = roofLeft ? findGroupSocketOwning(placed, roofLeft) : undefined;
    expect(selectedGroupSocket).toEqual({ instanceId: 'S2', socketId: 'roof-left' });
    expect([...describeHighlight(placed, parts, { focusedInstance, openInstanceId: 'S2', selectedGroupSocket }).partIds]).toEqual(['S2/roof-left']);
  });

  it('markerar första takfallet när det valda hör till en annan sektion', () => {
    const focusedInstance = { instanceId: 'S1', groupKey: 'group.roof', count: 1 };
    const selectedGroupSocket = { instanceId: 'S2', socketId: 'roof-left' };
    expect([...describeHighlight(placed, parts, { focusedInstance, openInstanceId: 'S1', selectedGroupSocket }).partIds]).toEqual(['S1/roof-right']);
  });

  it('markerar hela taket när det inte har några takfall, t.ex. ett platt tak', () => {
    const flat = designWithExtensions();
    const flatDesign = { ...flat, root: { ...flat.root, children: flat.root.children.map((child) => ({ ...child, params: { ...child.params, roof: 'flat' } })) } };
    const flatPlaced = placeInstances(flatDesign, gingerbreadDomain);
    const flatParts = buildParts(flatDesign, gingerbreadDomain);
    const focusedInstance = { instanceId: 'S1', groupKey: 'group.roof', count: 1 };
    const roofIds = flatParts.filter((part) => part.paramGroupKey === 'group.roof').map((part) => part.id);
    expect(roofIds.length).toBeGreaterThan(0);
    expect([...describeHighlight(flatPlaced, flatParts, { focusedInstance, openInstanceId: 'S1' }).partIds].sort()).toEqual(roofIds.sort());
  });

  it('markerar fönstret som är öppet i panelen, med hålet och luckorna', () => {
    const highlight = describeHighlight(placed, parts, { openInstanceId: 'F1' });
    expect(highlight.pickInstanceId).toBe('F1');
    expect([...highlight.partIds].sort()).toEqual(['F1/shutter-left', 'F1/shutter-right']);
  });

  it('släcker fönstret efter ett tryck utanför huset', () => {
    const highlight = describeHighlight(placed, parts, { openInstanceId: 'F1', isOpenInstanceHighlighted: false });
    expect(highlight.pickInstanceId).toBeUndefined();
    expect(highlight.partIds.size).toBe(0);
  });

  it('markerar väggen som är vald', () => {
    const highlight = describeHighlight(placed, parts, { selectedSocket: { instanceId: 'S1', socketId: 'side-left' }, openInstanceId: 'S1' });
    expect([...highlight.partIds]).toEqual(['S1/side-left']);
    expect(highlight.pickInstanceId).toBeUndefined();
  });

  it('markerar fönstret som är öppet före väggen det sitter på', () => {
    const highlight = describeHighlight(placed, parts, { selectedSocket: { instanceId: 'S1', socketId: 'side-left' }, openInstanceId: 'F1' });
    expect(highlight.pickInstanceId).toBe('F1');
    expect([...highlight.partIds].sort()).toEqual(['F1/shutter-left', 'F1/shutter-right']);
  });
});
