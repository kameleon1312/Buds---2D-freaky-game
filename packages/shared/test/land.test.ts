import { buildingById, doorCell, footprint, landStateSchema } from '../src/land';
import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
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
  ROUTE_STYLE,
  SECTORS,
  SECTOR_LIMIT,
  allReachable,
  build,
  clearProblem,
  clearingCost,
  collect,
  districtNameSchema,
  districtView,
  fortify,
  gateCells,
  hallSpot,
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
  rankOf,
  sectorIndex,
  settle,
  startClearing,
  startRaid,
  startSectors,
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
/** Free spots for a 3×3 building in a new district: the sectors either side of the gate's. */
const A = { x: 7, y: 22 };
const B = { x: 17, y: 22 };
const HALL = hallSpot('s');
const ALL = Array.from({ length: SECTORS * SECTORS }, (_, i) => i);

const land = (over: Partial<LandState> = {}): LandState => ({
  ...newLand(PLOT, 'Nowa Huta', T0),
  ...over,
});

describe('plots on the wastelands', () => {
  it('lie on every wasteland, a few far apart, each one once, in the style of the land', () => {
    expect(new Set(PLOTS.map((p) => p.id)).size).toBe(PLOTS.length);
    for (const r of ROUTES) {
      const on = PLOTS.filter((p) => p.route === r.id);
      expect(on.length).toBe(4);
      expect(ROUTE_STYLE[r.id]).toBeDefined();
      // no two plots closer than a plot's side
      for (const p of on)
        for (const q of on)
          if (p !== q)
            expect(Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y))).toBeGreaterThan(PLOT_SIZE);
    }
    expect(ROUTE_STYLE['pustkowie-wydmy']).toBe('tropik');
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
  it('starts small: a clearing by the gate, a town hall behind it, a shield and materials', () => {
    for (const gate of ['n', 's', 'e', 'w'] as const) {
      const plot = PLOTS.find((p) => p.gate === gate)!;
      const l = newLand(plot.id, 'Nowa Huta', T0);
      expect(l.sectors).toEqual(startSectors(gate));
      expect(l.buildings[0]).toMatchObject({ kind: 'ratusz', ...hallSpot(gate), level: 1 });
      expect(allReachable(l)).toBe(true);
    }
    const l = land();
    expect(l.sectors.length).toBe(4);
    expect(l.shieldUntil).toBe(T0 + NEW_SHIELD_HOURS * H);
  });

  it('builds only on cleared land, never on the hall, the gate or walling anything in', () => {
    const l = land();
    expect(placementProblem(l, 'szklarnia', A.x, A.y, 3)).toBeNull();
    expect(placementProblem(l, 'szklarnia', B.x, B.y, 3)).toBeNull();
    // the sector beside the town hall is still wild
    expect(placementProblem(l, 'szklarnia', 7, 17, 9)).toBe('outside');
    expect(placementProblem(l, 'szklarnia', HALL.x, HALL.y, 9)).toBe('occupied');
    expect(placementProblem(l, 'szklarnia', A.x, A.y, 2)).toBe('level_too_low');
    expect(placementProblem(l, 'ratusz', A.x, A.y, 9)).toBe('too_many');
    expect(placementProblem(l, 'zamek', A.x, A.y, 9)).toBe('unknown_building');
    expect(placementProblem(l, 'fontanna', A.x, A.y, 9)).toBe('too_many');
    expect(
      placementProblem(
        land({ resources: { beton: 0, stal: 0, energia: 0, zywnosc: 0 } }),
        'szklarnia',
        A.x,
        A.y,
        9,
      ),
    ).toBe('poor');
    // the gate keeps a clear way in
    expect(placementProblem(l, 'szklarnia', 12, 21, 9)).toBe('gate');
    // a building over the town hall's door would wall it in (a plot with its gate to the north)
    const north = { ...newLand('ostepy-2', 'Północ', T0), sectors: ALL };
    const hall = hallSpot('n');
    expect(placementProblem(north, 'szklarnia', hall.x, hall.y + 3, 9)).toBeNull();
    expect(build(north, 'szklarnia', hall.x, hall.y + 3, T0)).toBe('walls_in');
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

  it('pays rent straight to the wallet, more with squares, fountains, a statue and the tower', () => {
    const flat = (level: number) => ({
      id: 2,
      kind: 'apartamentowiec' as const,
      x: A.x,
      y: A.y,
      level,
      readyAt: T0,
      collectedAt: T0,
    });
    const flats = { ...land(), buildings: [...land().buildings, flat(1)] };
    const got = collect(flats, T0 + 2 * H);
    expect(got.coins).toBe(8);
    expect(got.gathered).toMatchObject({ beton: 0, stal: 0, energia: 0, zywnosc: 0 });
    const tower = {
      id: 3,
      kind: 'iglica' as const,
      x: 12,
      y: 8,
      level: 1,
      readyAt: T0,
      collectedAt: T0,
    };
    const proud = { ...land(), buildings: [...land().buildings, flat(5), tower] };
    expect(hourly(proud, proud.buildings[1]!)).toBe(30);
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

describe('clearing the plot', () => {
  const west = sectorIndex(0, SECTORS - 1);

  it('takes the land next to what the district holds, one sector at a time, for coins and materials', () => {
    const l = land();
    expect(clearProblem(l, west, 3, 1000, T0)).toMatchObject({
      problem: null,
      coins: 60,
      level: 3,
    });
    expect(clearProblem(l, 0, 3, 1000, T0).problem).toBe('not_next');
    expect(clearProblem(l, sectorIndex(2, SECTORS - 1), 3, 1000, T0).problem).toBe('cleared');
    expect(clearProblem(l, west, 3, 10, T0).problem).toBe('poor');
    expect(clearProblem(l, west, 2, 1000, T0).problem).toBe('level_too_low');
    const busy = startClearing(l, west, T0);
    expect(busy.resources.beton).toBe(100 - 20);
    // the work turns up the wasteland's own resource
    expect(busy.resources.energia).toBe(clearingCost(0).yields);
    expect(busy.clearing).toEqual({ sector: west, readyAt: T0 + 60_000 });
    expect(clearProblem(busy, sectorIndex(4, SECTORS - 1), 3, 1000, T0).problem).toBe('clearing');
    expect(settle(busy, T0 + 59_000).sectors).not.toContain(west);
    const done = settle(busy, T0 + 60_000);
    expect(done.sectors).toContain(west);
    expect(done.clearing).toBeNull();
    // the next one costs more
    expect(clearProblem(done, sectorIndex(4, SECTORS - 1), 3, 1000, T0).coins).toBe(100);
  });

  it('as far as the town hall allows, until the whole plot is the district', () => {
    const six = land({ sectors: ALL.slice(0, SECTOR_LIMIT[0]) });
    const rich = { ...six, resources: { beton: 9000, stal: 9000, energia: 9000, zywnosc: 9000 } };
    expect(clearProblem(rich, 6, 30, 99_999, T0).problem).toBe('hall_too_low');
    const full = land({ sectors: ALL });
    expect(clearProblem(full, 0, 30, 99_999, T0).problem).toBe('cleared');
    expect(clearingCost(20).level).toBeGreaterThan(clearingCost(0).level);
    expect(clearingCost(20).coins).toBeGreaterThan(clearingCost(10).coins);
  });

  it('makes the district mightier, higher in rank and harder to raid', () => {
    const small = land();
    const big = {
      ...land({ sectors: ALL }),
      buildings: BUILDINGS.map((b, i) => ({
        id: i + 1,
        kind: b.id,
        x: 0,
        y: 0,
        level: b.levels.length,
        readyAt: T0,
        collectedAt: T0,
      })),
    };
    expect(landPower(small)).toBe(4 * 8 + 30);
    expect(landDefence(landPower(small))).toBe(7);
    expect(landDefence(landPower(big))).toBeGreaterThan(landDefence(landPower(small)));
    expect(landDefence(1_000_000)).toBe(MAX_DEFENCE);
    expect(rankOf(landPower(small)).name).toBe('Osada');
    expect(rankOf(400)).toMatchObject({ name: 'Dzielnica', next: { name: 'Dystrykt' } });
    expect(rankOf(landPower(big)).index).toBeGreaterThan(2);
    expect(rankOf(1_000_000).next).toBeNull();
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

  it('show everyone the district, its cleared land and its rank, but never its stores', () => {
    const busy = startClearing(theirs, sectorIndex(0, SECTORS - 1), T0);
    const v = districtView(busy, { slug: 'b', name: 'Bartek', level: 7 }, T0 + H);
    expect(v).toMatchObject({ plot: PLOT, name: 'Nowa Huta', rank: 'Osada', clearing: null });
    expect(v.sectors.length).toBe(5);
    expect(JSON.stringify(v)).not.toContain('resources');
  });
});

describe('walking', () => {
  it('goes in through the gate, never through the fence or the wild land', () => {
    const l = land();
    const c = (PLOT_SIZE - 1) / 2;
    expect(walkable(l, c, PLOT_SIZE - 1)).toBe(true);
    expect(walkable(l, A.x, A.y + 1)).toBe(true);
    expect(walkable(l, 0, 22)).toBe(false);
    expect(walkable(l, 2, 2)).toBe(false);
    expect(walkable(l, HALL.x, HALL.y)).toBe(false);
  });
});

describe('turning a building', () => {
  const kind = buildingById('iglica')!;
  const open = () => ({
    ...newLand('Testowo', PLOTS[0]!.id, 0),
    resources: { beton: 9999, stal: 9999, energia: 9999, zywnosc: 9999 },
    sectors: Array.from({ length: SECTORS * SECTORS }, (_, i) => i),
  });

  it('turns round its door', () => {
    expect(footprint(kind, 10, 10, 0)).toEqual({ x0: 8, x1: 12, y0: 7, y1: 10 });
    expect(footprint(kind, 10, 10, 1)).toEqual({ x0: 10, x1: 13, y0: 8, y1: 12 });
    expect(footprint(kind, 10, 10, 2)).toEqual({ x0: 8, x1: 12, y0: 10, y1: 13 });
    expect(footprint(kind, 10, 10, 3)).toEqual({ x0: 7, x1: 10, y0: 8, y1: 12 });
    expect(doorCell(10, 10, 1)).toEqual([9, 10]);
    expect(doorCell(10, 10, 3)).toEqual([11, 10]);
  });

  it('a turned building is saved with its turn and fills the cells it covers', () => {
    const land = open();
    expect(placementProblem(land, 'szklarnia', 3, 3, 20, 1)).toBeNull();
    const built = build(land, 'szklarnia', 3, 3, 0, 1);
    expect(built).not.toBe('walls_in');
    const next = built as typeof land;
    expect(next.buildings.at(-1)!.rot).toBe(1);
    expect(placementProblem(next, 'szklarnia', 4, 3, 20, 0)).toBe('occupied');
    expect(landStateSchema.safeParse(next).success).toBe(true);
  });

  it('a door against the fence is refused', () => {
    const land = open();
    // door west at x = 1: the cell in front of it is the fence
    expect(placementProblem(land, 'szklarnia', 1, 8, 20, 1)).toBe('outside');
    expect(placementProblem(land, 'szklarnia', 2, 8, 20, 1)).toBeNull();
  });
});
