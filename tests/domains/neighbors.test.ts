import { describe, expect, it } from 'vitest';
import { buildDrawingPages } from '../../src/core/export/drawingDocument';
import { PAPER_FORMATS } from '../../src/core/layout/paper';
import { buildParts } from '../../src/core/pipeline/buildParts';
import { evaluateDesign } from '../../src/core/rules/evaluateDesign';
import { proposeChild } from '../../src/core/rules/placement';
import { setParamWithinRules } from '../../src/core/rules/paramAdjustment';
import { addChildInstance, findInstance } from '../../src/core/model/instanceTree';
import { vec2, vec3 } from '../../src/core/geometry/vector';
import { listNeighborCandidates } from '../../src/domains/gingerbread/objects/neighborProposal';
import { WALL_BESIDE } from '../../src/domains/gingerbread/socketKinds';
import type { Design } from '../../src/core/model/design';
import { gingerbreadDomain } from '../../src/domains/gingerbread';
import { SECTION_TYPE_ID } from '../../src/domains/gingerbread/objects/section';
import { designWithExtensions, HOST_PARAMS } from './extensionFixtures';
import { beside, BLOCK_PARAMS, castleDesign, houseWithTower, TOWER_PARAMS } from './neighborFixtures';
import { partById, worldCorners } from './roofFixtures';

const THICKNESS = 4;
const TOWER_BESIDE_HOUSE = { width: 60, depth: 60, wallHeight: 190, roof: 'spire8' };

function errorsFor(design: Design): string[] {
  return evaluateDesign(design, gingerbreadDomain, (key) => key)
    .violations.filter((violation) => violation.level === 'error')
    .map((violation) => violation.message);
}

function widthOf(points: readonly { x: number }[]): number {
  const xs = points.map((point) => point.x);
  return Math.max(...xs) - Math.min(...xs);
}

describe('sektion bredvid en vägg (ägarens val)', () => {
  it('föreslår ett torn bredvid en låg vägg och ett lägre block bredvid ett torn', () => {
    const socket = { id: 'side-right', kind: WALL_BESIDE, labelKey: '', frame: { origin: vec3(0, 0, 0), u: vec3(1, 0, 0), normal: vec3(0, 0, 1) } };
    const lowWall = [vec2(-90, 0), vec2(90, 0), vec2(90, 100), vec2(-90, 100)];
    expect(listNeighborCandidates({ ...socket, bounds: lowWall })[0]).toMatchObject({ width: 105, depth: 105, wallHeight: 160 });
    const towerWall = [vec2(-40, 0), vec2(40, 0), vec2(40, 200), vec2(-40, 200)];
    expect(listNeighborCandidates({ ...socket, bounds: towerWall }, { roof: 'spire4' })[0]).toMatchObject({ wallHeight: 120, roof: 'gable' });
  });

  it('byter mellan tillbyggnad och sektion bredvid när vägghöjden ändras', () => {
    const start = designWithExtensions();
    const proposal = proposeChild(start, gingerbreadDomain, { parentId: 'S1', socketId: 'side-right', objectTypeId: SECTION_TYPE_ID });
    expect(proposal.instance.attachment?.socketId).toBe('side-right');
    const withExtension = { ...start, root: addChildInstance(start.root, 'S1', proposal.instance) };
    const socketOf = (design: Design) => findInstance(design.root, 'S2')?.attachment?.socketId;
    const tower = setParamWithinRules(withExtension, gingerbreadDomain, { instanceId: 'S2', key: 'wallHeight', value: 160 });
    expect(socketOf(tower)).toBe('beside-side-right');
    expect(errorsFor(tower)).toEqual([]);
    const lowAgain = setParamWithinRules(tower, gingerbreadDomain, { instanceId: 'S2', key: 'wallHeight', value: 60 });
    expect(socketOf(lowAgain)).toBe('side-right');
  });

  it('kan inte vridas', () => {
    const design = houseWithTower(TOWER_BESIDE_HOUSE);
    const tower = design.root.children[0]?.children[0];
    if (tower?.attachment) tower.attachment.rotationDegrees = 90;
    expect(errorsFor(design)).toContain('rule.neighborUpright');
  });

  it('kan stå vägg i vägg utan att räknas som att den går in i huset', () => {
    expect(errorsFor(houseWithTower(TOWER_BESIDE_HOUSE))).toEqual([]);
  });
});

describe('gemensam vägg', () => {
  it('ger husets vägg ett hål där tornet står, en tjocklek innanför tornets hörn', () => {
    const parts = buildParts(houseWithTower(TOWER_BESIDE_HOUSE), gingerbreadDomain);
    const pieces = parts.filter((part) => part.id.startsWith('S1/side-right'));
    // Tornet är högre än husets vägg, så väggen delas i två bitar på var sin sida om tornet.
    expect(pieces).toHaveLength(2);
    const wallLength = HOST_PARAMS.depth - 2 * THICKNESS;
    const kept = pieces.reduce((sum, piece) => sum + widthOf(piece.outline), 0);
    expect(kept).toBeCloseTo(wallLength - (TOWER_BESIDE_HOUSE.width - 2 * THICKNESS));
    // Tornet behåller sin bakre gavel hel.
    expect(widthOf(partById(parts, 'S2/gable-back').outline)).toBeCloseTo(TOWER_BESIDE_HOUSE.width);
  });

  it('kapar husets takutsprång där tornet står', () => {
    const parts = buildParts(houseWithTower(TOWER_BESIDE_HOUSE), gingerbreadDomain);
    const wallX = HOST_PARAMS.width / 2;
    const roof = partById(parts, 'S1/roof-right');
    const overTower = [...worldCorners(roof), ...worldCorners(roof, true)].filter((point) => point.x > wallX + 0.01 && Math.abs(point.z) < TOWER_BESIDE_HOUSE.width / 2 - 0.01);
    expect(overTower).toEqual([]);
    // Utanför tornet når utsprånget fortfarande ut förbi väggen.
    expect(Math.max(...worldCorners(roof).map((point) => point.x))).toBeGreaterThan(wallX);
  });

  it('tar bort ett lägre blocks gavel mot tornet och förlänger blockets långväggar dit', () => {
    const parts = buildParts(castleDesign(), gingerbreadDomain);
    expect(parts.some((part) => part.id === 'B1/gable-back' || part.id === 'B1/gable-front')).toBe(false);
    for (const side of ['B1/side-right', 'B1/side-left']) {
      expect(widthOf(partById(parts, side).outline)).toBeCloseTo(BLOCK_PARAMS.depth);
    }
    // Tornens väggar står kvar hela.
    for (const wall of ['S1/side-right', 'T2/gable-back', 'T2/side-left']) {
      expect(partById(parts, wall).holes).toEqual([]);
      expect(widthOf(partById(parts, wall).outline)).toBeGreaterThanOrEqual(TOWER_PARAMS.width - 2 * THICKNESS - 0.01);
    }
  });

  it('kapar blockens tak mot tornens väggar', () => {
    const parts = buildParts(castleDesign(), gingerbreadDomain);
    const roof = partById(parts, 'B1/roof-right');
    const xs = [...worldCorners(roof), ...worldCorners(roof, true)].map((point) => point.x);
    // B1 står mellan tornens väggar vid x = 40 och x = 160.
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(TOWER_PARAMS.width / 2 - 0.01);
    expect(Math.max(...xs)).toBeLessThanOrEqual(TOWER_PARAMS.width / 2 + BLOCK_PARAMS.depth + 0.01);
  });
});

describe('borg med fyra torn', () => {
  it('går att bygga när det sista blocket når fram till det första tornet', () => {
    expect(errorsFor(castleDesign())).toEqual([]);
    const parts = buildParts(castleDesign(), gingerbreadDomain);
    expect(parts.some((part) => part.id.startsWith('B4/gable'))).toBe(false);
  });

  it('ger en ritning', () => {
    const pages = buildDrawingPages({
      parts: buildParts(castleDesign(), gingerbreadDomain),
      paper: PAPER_FORMATS.A4,
      resolveLabel: (key) => gingerbreadDomain.strings[key] ?? key,
      overview: { title: 'Borg', materialLabel: 'Deg', thickness: THICKNESS, buildSteps: [{ step: 1, label: 'Väggar' }], notes: [] },
    });
    expect(pages.length).toBeGreaterThanOrEqual(2);
  });
});

describe('tak som möts', () => {
  it('är ett fel när ett block med sadeltak når upp i husets takutsprång', () => {
    const design = houseWithTower({ width: 80, depth: 80, wallHeight: 100, roof: 'gable', roofPitch: 45 });
    expect(errorsFor(design)).toContain('rule.roofsMeet');
  });

  it('är inget fel när blocket är så lågt att taket går fritt under utsprånget', () => {
    const design = houseWithTower({ width: 60, depth: 60, wallHeight: 40, roof: 'flat', rimHeight: 10 });
    expect(errorsFor(design)).toEqual([]);
  });

  it('räknar inte två takändar som når in i samma torn', () => {
    expect(errorsFor(castleDesign())).not.toContain('rule.roofsMeet');
  });

  it('gäller också sektioner som står var för sig på fatet', () => {
    const design = designWithExtensions();
    const house = design.root.children[0];
    if (!house) throw new Error('Mallen saknar sektion');
    house.params = HOST_PARAMS;
    // Väggarna står 10 mm isär, så takutsprången på 10 mm går in i varandra.
    const neighbor = beside('S2', 'ground', HOST_PARAMS);
    if (neighbor.attachment) neighbor.attachment.u = HOST_PARAMS.width + 10;
    design.root.children.push(neighbor);
    expect(errorsFor(design)).toContain('rule.roofsMeet');
  });
});
