import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  HALL,
  LOOT_SHARE,
  MAX_DEFENCE,
  NEW_SHIELD_HOURS,
  PLOT_SIZE,
  PLOTS,
  PRODUCER_HOURS,
  PROTECTED_BASE,
  RAID_MIN_LEVEL,
  RAID_RETRY_MINUTES,
  RAIDS_PER_DAY,
  ROUTES,
  allReachable,
  build,
  collect,
  districtNameSchema,
  districtView,
  fortify,
  gateCells,
  grow,
  growProblem,
  hourly,
  landDefence,
  landPower,
  newLand,
  pending,
  placementProblem,
  plotById,
  plotPrice,
  raid,
  raidHeld,
  raidProblem,
  stageArea,
  startRaid,
  storage,
  upgrade,
  upgradeProblem,
  walkable,
  type Fighter,
  type LandState,
} from '../src/index';

const T0 = Date.UTC(2026, 9, 26, 12);
const H = 3_600_000;
/** A plot on Leśne Ostępy (energy grows half as much again there), its gate facing south. */
const PLOT = 'ostepy-1';
/** Free spots for a 3×3 building on a first-stage district, either side above the town hall. */
const A = { x: 8, y: 9 };
const B = { x: 14, y: 9 };

const land = (over: Partial<LandState> = {}): LandState => ({
  ...newLand(PLOT, 'Nowa Huta', T0),
  ...over,
});

describe('plots on the wastelands', () => {
  it('lie on every wasteland, inside its map, each one once', () => {
    expect(new Set(PLOTS.map((p) => p.id)).size).toBe(PLOTS.length);
    for (const r of ROUTES)
      expect(PLOTS.filter((p) => p.route === r.id).length).toBeGreaterThanOrEqual(6);
    for (const p of PLOTS) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
    }
    expect(plotById(PLOT)?.gate).toBe('s');
  });

  it('cost more further out', () => {
    expect(plotPrice('pustkowie-ostepy')).toBe(300);
    expect(plotPrice('pustkowie-nieuzytki')).toBeGreaterThan(plotPrice('pustkowie-ostepy'));
  });

  it('have their gate in the middle of the side facing the road', () => {
    const c = (PLOT_SIZE - 1) / 2;
    expect(gateCells('s').cells).toContainEqual([c, PLOT_SIZE - 1]);
    expect(gateCells('n').inside).toEqual([c, 1]);
    expect(gateCells('e').cells).toContainEqual([PLOT_SIZE - 1, c + 1]);
  });
});

describe('district names', () => {
  it('take letters, digits and a few signs, tidy the spaces and refuse what chat would hide', () => {
    expect(districtNameSchema.parse('  Nowa   Huta ')).toBe('Nowa Huta');
    expect(districtNameSchema.safeParse('ab').success).toBe(false);
    expect(districtNameSchema.safeParse('-Huta').success).toBe(false);
    expect(districtNameSchema.safeParse('Kurwa City').success).toBe(false);
    expect(districtNameSchema.safeParse('Zielone Wzgórze 2').success).toBe(true);
  });
});

describe('building a district', () => {
  it('starts with a town hall in the middle, a shield and materials', () => {
    const l = newLand(PLOT, 'Nowa Huta', T0);
    expect(l.buildings[0]).toMatchObject({ kind: 'ratusz', x: HALL.x, y: HALL.y, level: 1 });
    expect(l.stage).toBe(1);
    expect(l.shieldUntil).toBe(T0 + NEW_SHIELD_HOURS * H);
    expect(allReachable(l)).toBe(true);
  });

  it('builds only on the stage’s square, never on the hall, the gate or walling anything in', () => {
    const l = land();
    expect(placementProblem(l, 'szklarnia', A.x, A.y, 3)).toBeNull();
    expect(placementProblem(l, 'szklarnia', B.x, B.y, 3)).toBeNull();
    expect(placementProblem(l, 'szklarnia', 3, 9, 9)).toBe('outside');
    expect(placementProblem(l, 'szklarnia', HALL.x, HALL.y, 9)).toBe('occupied');
    expect(placementProblem(l, 'szklarnia', A.x, A.y, 2)).toBe('level_too_low');
    expect(placementProblem(l, 'ratusz', A.x, A.y, 9)).toBe('too_many');
    expect(placementProblem(l, 'zamek', A.x, A.y, 9)).toBe('unknown_building');
    expect(
      placementProblem(
        land({ resources: { beton: 0, stal: 0, energia: 0, zywnosc: 0 } }),
        'szklarnia',
        A.x,
        A.y,
        9,
      ),
    ).toBe('poor');
    // at the last stage the square reaches the fence: the gate keeps a clear way in
    const full = land({ stage: 4 });
    expect(placementProblem(full, 'szklarnia', (PLOT_SIZE - 1) / 2, PLOT_SIZE - 3, 9)).toBe('gate');
    // a building over the town hall's door would wall it in
    const wide = land({ stage: 2 });
    expect(placementProblem(wide, 'szklarnia', HALL.x, HALL.y + 3, 9)).toBeNull();
    expect(build(wide, 'szklarnia', HALL.x, HALL.y + 3, T0)).toBe('walls_in');
  });

  it('pays, builds over time, produces with the wasteland’s bonus and fills storage', () => {
    const l = build(land(), 'farma-solarna', A.x, A.y, T0) as LandState;
    expect(l.resources).toMatchObject({ beton: 70, stal: 20 });
    const solar = l.buildings.at(-1)!;
    expect(solar.readyAt).toBe(T0 + 60_000);
    expect(hourly(l, solar)).toBe(30);
    expect(pending(l, solar, solar.readyAt + 2 * H)).toBe(60);
    expect(pending(l, solar, solar.readyAt + 100 * H)).toBe(30 * PRODUCER_HOURS);
    const got = collect(l, solar.readyAt + 2 * H);
    expect(got.gathered.energia).toBe(60);
    expect(got.land.resources.energia).toBe(60);
    expect(storage(l, T0)).toBe(300);
  });

  it('pays rent straight to the wallet', () => {
    const flats = {
      ...land(),
      buildings: [
        ...land().buildings,
        {
          id: 2,
          kind: 'apartamentowiec' as const,
          x: A.x,
          y: A.y,
          level: 1,
          readyAt: T0,
          collectedAt: T0,
        },
      ],
    };
    const got = collect(flats, T0 + 2 * H);
    expect(got.coins).toBe(8);
    expect(got.gathered).toMatchObject({ beton: 0, stal: 0, energia: 0, zywnosc: 0 });
  });

  it('raises buildings within the town hall’s level', () => {
    const l = build(
      land({ resources: { beton: 900, stal: 900, energia: 900, zywnosc: 900 } }),
      'szklarnia',
      A.x,
      A.y,
      T0,
    ) as LandState;
    const farm = l.buildings.at(-1)!;
    expect(upgradeProblem(l, farm.id, 9, T0)).toBe('busy');
    expect(upgradeProblem(l, farm.id, 9, T0 + H)).toBe('hall_too_low');
    const hall = upgrade(l, 1, T0 + H).land;
    expect(upgradeProblem(hall, farm.id, 9, T0 + 3 * H)).toBeNull();
    expect(upgradeProblem(hall, 99, 9, T0)).toBe('not_found');
  });
});

describe('growing over the plot', () => {
  it('needs the bud’s level, the hall’s level, materials and coins', () => {
    const rich = land({ resources: { beton: 2000, stal: 2000, energia: 2000, zywnosc: 2000 } });
    expect(growProblem(rich, 4, 1000).problem).toBe('level_too_low');
    expect(growProblem(rich, 5, 1000).problem).toBe('hall_too_low');
    const hall2 = { ...rich, buildings: [{ ...rich.buildings[0]!, level: 2 }] };
    expect(growProblem(hall2, 5, 100).problem).toBe('poor');
    expect(growProblem(hall2, 5, 150)).toMatchObject({ problem: null, coins: 150 });
    const grown = grow(hall2);
    expect(grown.stage).toBe(2);
    expect(grown.resources.beton).toBe(2000 - 150);
    expect(stageArea(2).x1 - stageArea(2).x0 + 1).toBe(13);
    expect(growProblem({ ...grown, stage: 4 }, 30, 99_999).problem).toBe('max_stage');
  });

  it('makes the district mightier and harder to raid', () => {
    const small = land();
    const big = {
      ...land({ stage: 4 }),
      buildings: BUILDINGS.map((b, i) => ({
        id: i + 1,
        kind: b.id,
        x: 0,
        y: 0,
        level: 5,
        readyAt: T0,
        collectedAt: T0,
      })),
    };
    expect(landPower(small)).toBe(45);
    expect(landDefence(landPower(small))).toBe(10);
    expect(landDefence(landPower(big))).toBeGreaterThan(landDefence(landPower(small)));
    expect(landDefence(1_000_000)).toBe(MAX_DEFENCE);
  });
});

describe('raids', () => {
  const day = '2026-10-26';
  const after = T0 + (NEW_SHIELD_HOURS + 1) * H;
  const mine = newLand('ostepy-2', 'Moja', T0);
  const theirs = { ...land(), resources: { beton: 1000, stal: 40, energia: 400, zywnosc: 0 } };

  it('start at a level, against a district out of its shield, a few a day', () => {
    const at = (
      r: LandState | null,
      lvl = RAID_MIN_LEVEL,
      them = RAID_MIN_LEVEL,
      when = after,
      slug = 'b',
    ) => raidProblem(r, lvl, 'a', theirs, slug, them, when, day);
    expect(at(mine, RAID_MIN_LEVEL - 1)).toBe('level_too_low');
    expect(at(null)).toBe('no_land');
    expect(at(mine, RAID_MIN_LEVEL, RAID_MIN_LEVEL, after, 'a')).toBe('own');
    expect(at(mine, RAID_MIN_LEVEL, RAID_MIN_LEVEL - 1)).toBe('target_too_low');
    expect(at(mine, RAID_MIN_LEVEL, RAID_MIN_LEVEL, T0)).toBe('shielded');
    expect(at(mine)).toBeNull();
    const tried = startRaid(mine, 'b', after, day);
    expect(at(tried)).toBe('resting');
    expect(
      at(tried, RAID_MIN_LEVEL, RAID_MIN_LEVEL, after + RAID_RETRY_MINUTES * 60_000),
    ).toBeNull();
    let busy = mine;
    for (let i = 0; i < RAIDS_PER_DAY; i++) busy = startRaid(busy, `x${i}`, after, day);
    expect(at(busy)).toBe('daily_limit');
    expect(raidProblem(busy, 9, 'a', theirs, 'b', 9, after, '2026-10-27')).toBeNull();
  });

  it('take a share of what is not protected, as much as fits, and shield the district', () => {
    const out = raid(mine, theirs, after, { name: 'Ala', slug: 'a' });
    const beton = Math.min(
      Math.floor((1000 - PROTECTED_BASE) * LOOT_SHARE),
      storage(mine, after) - 100,
    );
    expect(out.loot.beton).toBe(beton);
    expect(out.loot.stal).toBe(0);
    expect(out.loot.energia).toBe(Math.floor((400 - PROTECTED_BASE) * LOOT_SHARE));
    expect(out.raider.resources.beton).toBe(100 + beton);
    expect(out.defender.resources.beton).toBe(1000 - beton);
    expect(out.defender.shieldUntil).toBeGreaterThan(after);
    expect(out.defender.raids[0]).toMatchObject({ by: 'Ala', won: true });
    expect(out.defender.buildings).toEqual(theirs.buildings);
    const held = raidHeld(theirs, after, { name: 'Ala', slug: 'a' });
    expect(held.raids[0]).toMatchObject({ won: false });
    expect(held.resources).toEqual(theirs.resources);
  });

  it('fortify the owner by the district’s defence', () => {
    const f = { maxHp: 100, hp: 100, armor: 4 } as Fighter;
    expect(fortify(f, 30)).toMatchObject({ maxHp: 130, hp: 130, armor: 9 });
  });

  it('show everyone the district but never its stores', () => {
    const v = districtView(theirs, { slug: 'b', name: 'Bartek', level: 7 });
    expect(v).toMatchObject({ plot: PLOT, name: 'Nowa Huta', stage: 1 });
    expect(JSON.stringify(v)).not.toContain('resources');
  });
});

describe('walking', () => {
  it('goes in through the gate and never through the fence', () => {
    const l = land();
    const c = (PLOT_SIZE - 1) / 2;
    expect(walkable(l, c, PLOT_SIZE - 1)).toBe(true);
    expect(walkable(l, 0, 5)).toBe(false);
    expect(walkable(l, HALL.x, HALL.y)).toBe(false);
  });
});
