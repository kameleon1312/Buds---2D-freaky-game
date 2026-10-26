import { z } from 'zod';
import { cleanChat } from './chat';
import type { Fighter } from './combat';
import { PLOTS } from './plots';
import { ROUTES } from './travel';

/**
 * Dystrykty (docs/dystrykty.md): on the wastelands between the cities the frontier is cut into fenced plots along the
 * road. A bud buys one for coins, names its district and builds it up: a town hall at its heart, apartment blocks
 * (rent in coins), vertical farms, solar farms, a concrete plant, steel recycling and a logistics centre. The district
 * grows over the plot in four stages as the bud gains levels and gathers materials. Everyone on the wasteland sees
 * every district; from RAID_MIN_LEVEL buds raid each other's districts (a duel against the owner's fighter, made
 * stronger by the district's defence, which grows with the empire), taking a share of the unprotected materials.
 * Buildings are never destroyed and a district never changes hands.
 *
 * Production runs in real time and is worked out lazily on the server (never trusted from the game); every change is
 * a compare-and-swap on the district's version, so two devices can't spend the same concrete twice. Mirrored in
 * Unity `Quests/Land.cs`.
 */

// ---------- resources ----------

export const RESOURCES = [
  { id: 'beton', name: 'Beton', price: 4 },
  { id: 'stal', name: 'Stal', price: 6 },
  { id: 'energia', name: 'Energia', price: 3 },
  { id: 'zywnosc', name: 'Żywność', price: 3 },
] as const;
export type ResourceId = (typeof RESOURCES)[number]['id'];
export const resourceIds = RESOURCES.map((r) => r.id) as [ResourceId, ...ResourceId[]];
export type Resources = Record<ResourceId, number>;
/** Coins paid for every 10 units sold (`price` above). */
export const SELL_BATCH = 10;

export const noResources = (): Resources => ({ beton: 0, stal: 0, energia: 0, zywnosc: 0 });

/** What a building makes: a resource, coins (rent, straight to the wallet) or nothing. */
export type Product = ResourceId | 'monety';

// ---------- the plots on the wastelands ----------

/** Each wasteland favours one resource: half as much again of it. */
export const ROUTE_BONUS: Record<string, ResourceId> = {
  'pustkowie-ostepy': 'energia',
  'pustkowie-wydmy': 'beton',
  'pustkowie-gosciniec': 'zywnosc',
  'pustkowie-nieuzytki': 'stal',
};
export const BIOME_BONUS = 1.5;

/** A plot is PLOT_SIZE×PLOT_SIZE cells: a fence round the edge with a gate in the middle of the side facing the road. */
export const PLOT_SIZE = 23;
/** The middle cell of a plot (the district grows round it). */
export const PLOT_CENTRE = (PLOT_SIZE - 1) / 2;
export type GateSide = 'n' | 's' | 'e' | 'w';

/** A plot on a wasteland map (generated into plots.ts by tools/world/export-maps.ts from the wasteland maps). */
export type Plot = {
  id: string;
  route: string;
  /** The plot's top-left cell on its wasteland map. */
  x: number;
  y: number;
  gate: GateSide;
};

export const plotById = (id: string): Plot | undefined => PLOTS.find((p) => p.id === id);
export const plotsOn = (route: string) => PLOTS.filter((p) => p.route === route);

/** What a plot costs: dearer on the wastelands further out. */
export function plotPrice(route: string): number {
  const r = ROUTES.find((x) => x.id === route);
  return 200 + 50 * (r?.levels[0] ?? 2);
}
export const LAND_MIN_LEVEL = 3;

/** The three cells of the gate (plot-local) and the cell just inside it, where the way in starts. */
export function gateCells(gate: GateSide): { cells: [number, number][]; inside: [number, number] } {
  const c = PLOT_CENTRE;
  const last = PLOT_SIZE - 1;
  const row = (y: number): [number, number][] => [
    [c - 1, y],
    [c, y],
    [c + 1, y],
  ];
  const col = (x: number): [number, number][] => [
    [x, c - 1],
    [x, c],
    [x, c + 1],
  ];
  switch (gate) {
    case 'n':
      return { cells: row(0), inside: [c, 1] };
    case 's':
      return { cells: row(last), inside: [c, last - 1] };
    case 'w':
      return { cells: col(0), inside: [1, c] };
    default:
      return { cells: col(last), inside: [last - 1, c] };
  }
}

/** Two rows inside the gate stay clear, so the way in is never built over. */
export function inGateClear(gate: GateSide, x: number, y: number): boolean {
  const c = PLOT_CENTRE;
  const last = PLOT_SIZE - 1;
  const across = (v: number) => v >= c - 1 && v <= c + 1;
  switch (gate) {
    case 'n':
      return across(x) && y >= 1 && y <= 2;
    case 's':
      return across(x) && y >= last - 2 && y <= last - 1;
    case 'w':
      return across(y) && x >= 1 && x <= 2;
    default:
      return across(y) && x >= last - 2 && x <= last - 1;
  }
}

// ---------- growing: four stages over the plot ----------

/** The side of the built-up square at each stage (centred on the plot; the fence and a lawn round it). */
export const STAGE_SIDES = [9, 13, 17, 21] as const;
export const MAX_STAGE = STAGE_SIDES.length;

/** The built-up square of a stage, plot-local and inclusive. */
export function stageArea(stage: number) {
  const side = STAGE_SIDES[Math.min(Math.max(stage, 1), MAX_STAGE) - 1]!;
  const half = (side - 1) / 2;
  return {
    x0: PLOT_CENTRE - half,
    x1: PLOT_CENTRE + half,
    y0: PLOT_CENTRE - half,
    y1: PLOT_CENTRE + half,
  };
}

/** What the next stage asks for: materials and coins, the bud's level and the town hall's level. */
export const STAGES: readonly {
  cost: Partial<Resources>;
  coins: number;
  level: number;
  hall: number;
}[] = [
  { cost: {}, coins: 0, level: LAND_MIN_LEVEL, hall: 1 },
  { cost: { beton: 150, stal: 80 }, coins: 150, level: 5, hall: 2 },
  { cost: { beton: 450, stal: 300, energia: 120 }, coins: 400, level: 8, hall: 3 },
  { cost: { beton: 1000, stal: 750, energia: 350, zywnosc: 250 }, coins: 900, level: 11, hall: 4 },
];

/** The town hall's spot: the middle of the plot, its door just below. */
export const HALL = { x: PLOT_CENTRE, y: PLOT_CENTRE + 2 } as const;

// ---------- the name ----------

export const DISTRICT_NAME_MIN = 3;
export const DISTRICT_NAME_MAX = 24;

/** A district's name: letters, digits, spaces and a few signs, and nothing the chat filter would star or hide. */
export const districtNameSchema = z
  .string()
  .trim()
  .min(DISTRICT_NAME_MIN, `Nazwa musi mieć co najmniej ${DISTRICT_NAME_MIN} znaki`)
  .max(DISTRICT_NAME_MAX, `Nazwa może mieć najwyżej ${DISTRICT_NAME_MAX} znaki`)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} .'-]*$/u, "Tylko litery, cyfry, spacje i . ' -")
  .refine((name) => cleanChat(name) === name.replace(/\s+/gu, ' '), 'Tej nazwy nie da się użyć')
  .transform((name) => name.replace(/\s+/gu, ' '));

// ---------- raids ----------

/** Raiding (and being raided) starts at this bud level. */
export const RAID_MIN_LEVEL = 6;
/** A new district is safe for this long. */
export const NEW_SHIELD_HOURS = 48;
/** A district that lost a raid is safe for this long. */
export const RAID_SHIELD_HOURS = 12;
/** Raids a bud may start a day. */
export const RAIDS_PER_DAY = 5;
/** After a failed raid the same district can be tried again after this long. */
export const RAID_RETRY_MINUTES = 60;
/** The share of the unprotected materials a won raid takes. */
export const LOOT_SHARE = 0.3;
/** Of every material this much is always safe, and more with every level of the logistics centre. */
export const PROTECTED_BASE = 100;
export const PROTECTED_PER_LOGISTICS = 100;
export const RAID_LOG = 10;
/** The highest defence (per cent added to the defender's health). */
export const MAX_DEFENCE = 60;

// ---------- buildings ----------

export type BuildingLevel = {
  cost: Partial<Resources>;
  /** Seconds the building (or the upgrade) takes. */
  seconds: number;
  /** The bud's level needed to start it. */
  player: number;
  /** Units (or coins) an hour for producers, extra storage for warehouses. */
  value: number;
};

export type BuildingKind = {
  id: string;
  name: string;
  /** Footprint in cells (odd width: the anchor is the middle of the bottom row). */
  w: number;
  h: number;
  /** What it makes, or null (the town hall, warehouses). */
  produces: Product | null;
  /** How many of it a district may have, by the town hall's level (index = hall level - 1). */
  limit: readonly number[];
  levels: readonly BuildingLevel[];
  blurb: string;
};

const L = (
  cost: Partial<Resources>,
  seconds: number,
  player: number,
  value: number,
): BuildingLevel => ({ cost, seconds, player, value });

export const BUILDINGS = [
  {
    id: 'ratusz',
    name: 'Ratusz',
    w: 5,
    h: 4,
    produces: null,
    limit: [1, 1, 1, 1, 1],
    levels: [
      L({}, 0, LAND_MIN_LEVEL, 0),
      L({ beton: 140, stal: 70 }, 120, 3, 0),
      L({ beton: 380, stal: 260, energia: 90 }, 900, 5, 0),
      L({ beton: 850, stal: 680, energia: 320, zywnosc: 200 }, 3600, 8, 0),
      L({ beton: 1700, stal: 1450, energia: 750, zywnosc: 600 }, 3 * 3600, 11, 0),
    ],
    blurb:
      'Serce dystryktu. Jego poziom pozwala na więcej budynków, wyższe poziomy i kolejne etapy rozbudowy.',
  },
  {
    id: 'apartamentowiec',
    name: 'Apartamentowiec',
    w: 3,
    h: 3,
    produces: 'monety',
    limit: [1, 1, 2, 2, 3],
    levels: [
      L({ beton: 120, stal: 60, energia: 30 }, 180, 3, 4),
      L({ beton: 260, stal: 140, energia: 80, zywnosc: 40 }, 900, 5, 7),
      L({ beton: 560, stal: 320, energia: 200, zywnosc: 120 }, 2400, 7, 11),
      L({ beton: 1100, stal: 700, energia: 420, zywnosc: 260 }, 5400, 9, 16),
      L({ beton: 2000, stal: 1300, energia: 800, zywnosc: 520 }, 3 * 3600, 12, 24),
    ],
    blurb: 'Mieszkańcy płacą czynsz: monety prosto do portfela.',
  },
  {
    id: 'szklarnia',
    name: 'Szklarnia pionowa',
    w: 3,
    h: 3,
    produces: 'zywnosc',
    limit: [2, 3, 4, 5, 6],
    levels: [
      L({ beton: 40 }, 45, LAND_MIN_LEVEL, 20),
      L({ beton: 80, stal: 30, energia: 20 }, 300, 3, 34),
      L({ beton: 180, stal: 90, energia: 60 }, 1200, 5, 54),
      L({ beton: 400, stal: 220, energia: 150 }, 3600, 8, 84),
      L({ beton: 820, stal: 480, energia: 330 }, 2 * 3600, 11, 126),
    ],
    blurb: 'Warzywa na regałach pod lampami. Żywność dla mieszkańców i do skupu.',
  },
  {
    id: 'farma-solarna',
    name: 'Farma solarna',
    w: 3,
    h: 3,
    produces: 'energia',
    limit: [1, 1, 2, 2, 3],
    levels: [
      L({ beton: 30, stal: 20 }, 60, LAND_MIN_LEVEL, 20),
      L({ beton: 80, stal: 50 }, 300, 3, 34),
      L({ beton: 200, stal: 150 }, 1200, 5, 54),
      L({ beton: 460, stal: 360, zywnosc: 80 }, 3600, 8, 84),
      L({ beton: 950, stal: 780, zywnosc: 250 }, 2 * 3600, 11, 126),
    ],
    blurb: 'Panele i magazyn energii. Prąd dla nowych budynków.',
  },
  {
    id: 'betoniarnia',
    name: 'Betoniarnia',
    w: 3,
    h: 3,
    produces: 'beton',
    limit: [1, 1, 2, 2, 3],
    levels: [
      L({ stal: 20 }, 60, LAND_MIN_LEVEL, 24),
      L({ beton: 60, stal: 40 }, 300, 3, 40),
      L({ beton: 160, stal: 120, energia: 40 }, 1200, 5, 64),
      L({ beton: 380, stal: 300, energia: 140 }, 3600, 8, 100),
      L({ beton: 800, stal: 650, energia: 320 }, 2 * 3600, 11, 150),
    ],
    blurb: 'Silos, mieszalnik i taśma. Betonu potrzeba do wszystkiego.',
  },
  {
    id: 'recykling',
    name: 'Recykling stali',
    w: 3,
    h: 3,
    produces: 'stal',
    limit: [1, 1, 2, 2, 3],
    levels: [
      L({ beton: 50 }, 90, LAND_MIN_LEVEL, 16),
      L({ beton: 100, stal: 30 }, 300, 3, 26),
      L({ beton: 250, stal: 100, energia: 40 }, 1200, 5, 42),
      L({ beton: 560, stal: 260, energia: 140 }, 3600, 8, 66),
      L({ beton: 1100, stal: 600, energia: 320 }, 2 * 3600, 11, 100),
    ],
    blurb: 'Złom z pogranicza wraca jako stal. Najcenniejszy surowiec.',
  },
  {
    id: 'magazyn',
    name: 'Centrum logistyczne',
    w: 3,
    h: 3,
    produces: null,
    limit: [1, 1, 1, 2, 2],
    levels: [
      L({ beton: 80, stal: 50 }, 180, LAND_MIN_LEVEL, 400),
      L({ beton: 180, stal: 140 }, 600, 4, 400),
      L({ beton: 420, stal: 340, energia: 60 }, 1800, 6, 400),
      L({ beton: 900, stal: 780, energia: 200 }, 3600, 9, 400),
      L({ beton: 1800, stal: 1550, energia: 450 }, 3 * 3600, 12, 400),
    ],
    blurb: 'Więcej miejsca na surowce (każdy poziom +400 każdego).',
  },
] as const satisfies readonly BuildingKind[];

export type BuildingId = (typeof BUILDINGS)[number]['id'];
export const buildingIds = BUILDINGS.map((b) => b.id) as [BuildingId, ...BuildingId[]];
export const buildingById = (id: string): BuildingKind | undefined =>
  BUILDINGS.find((b) => b.id === id);

/** Storage of each resource with no warehouse. */
export const BASE_STORAGE = 300;
/** A producer holds at most this many hours of its output until it is collected. */
export const PRODUCER_HOURS = 8;

// ---------- the state of a district ----------

export const landBuildingSchema = z.object({
  id: z.number().int().nonnegative(),
  kind: z.enum(buildingIds),
  /** Plot-local cell of the anchor (the middle of the bottom row). */
  x: z.number().int(),
  y: z.number().int(),
  level: z.number().int().min(1),
  /** When the building (or its last upgrade) is done, ms since epoch. */
  readyAt: z.number(),
  /** Output counted from here (the last collection, or when it was finished). */
  collectedAt: z.number(),
});
export type LandBuilding = z.infer<typeof landBuildingSchema>;

export const resourcesSchema = z.object({
  beton: z.number().int().nonnegative(),
  stal: z.number().int().nonnegative(),
  energia: z.number().int().nonnegative(),
  zywnosc: z.number().int().nonnegative(),
});

/** One raid on a district, kept in the defender's log. */
export const raidRecordSchema = z.object({
  at: z.number(),
  by: z.string(),
  slug: z.string(),
  /** True when the raider won (and took `loot`). */
  won: z.boolean(),
  loot: resourcesSchema,
});
export type RaidRecord = z.infer<typeof raidRecordSchema>;

export const landStateSchema = z.object({
  plot: z.string(),
  name: z.string().min(1).max(DISTRICT_NAME_MAX),
  stage: z.number().int().min(1).max(MAX_STAGE),
  resources: resourcesSchema,
  buildings: z.array(landBuildingSchema),
  nextId: z.number().int().nonnegative(),
  /** No raids until then (ms). */
  shieldUntil: z.number().default(0),
  /** Raids on this district, the newest first. */
  raids: z.array(raidRecordSchema).default([]),
  /** This bud's own raids: how many today, and when it last tried each district (owner slug → ms). */
  raiding: z
    .object({ day: z.string(), count: z.number().int().nonnegative(), tried: z.record(z.number()) })
    .default({ day: '', count: 0, tried: {} }),
});
export type LandState = z.infer<typeof landStateSchema>;

/** A new district on a bought plot: a finished town hall in the middle, some materials to start, a shield. */
export function newLand(
  plot: string,
  name: string,
  now: number,
  shieldHours: number = NEW_SHIELD_HOURS,
): LandState {
  return {
    plot,
    name,
    stage: 1,
    resources: { beton: 100, stal: 40, energia: 0, zywnosc: 0 },
    buildings: [
      { id: 1, kind: 'ratusz', x: HALL.x, y: HALL.y, level: 1, readyAt: now, collectedAt: now },
    ],
    nextId: 2,
    shieldUntil: now + shieldHours * 3_600_000,
    raids: [],
    raiding: { day: '', count: 0, tried: {} },
  };
}

export const hallLevel = (land: LandState) =>
  land.buildings.find((b) => b.kind === 'ratusz')?.level ?? 1;

/** Finished levels of the logistics centres. */
const logisticsLevels = (land: LandState, now: number) =>
  land.buildings
    .filter((b) => b.kind === 'magazyn')
    .reduce((n, b) => n + (b.readyAt <= now ? b.level : b.level - 1), 0);

/** How much of each resource the district can hold. */
export function storage(land: LandState, now: number): number {
  return BASE_STORAGE + logisticsLevels(land, now) * buildingById('magazyn')!.levels[0]!.value;
}

/** The bonus resource of the wasteland a district stands on. */
export const bonusOf = (land: LandState): ResourceId | undefined => {
  const plot = plotById(land.plot);
  return plot ? ROUTE_BONUS[plot.route] : undefined;
};

/** Units (or coins) an hour a producer makes at its level on this wasteland. */
export function hourly(land: LandState, b: LandBuilding): number {
  const kind = buildingById(b.kind)!;
  if (!kind.produces) return 0;
  const base = kind.levels[b.level - 1]?.value ?? 0;
  return Math.round(base * (bonusOf(land) === kind.produces ? BIOME_BONUS : 1));
}

/** What a producer holds now (whole units), waiting to be collected. */
export function pending(land: LandState, b: LandBuilding, now: number): number {
  const rate = hourly(land, b);
  if (rate <= 0 || now <= b.readyAt) return 0;
  const from = Math.max(b.collectedAt, b.readyAt);
  const hours = Math.min(PRODUCER_HOURS, Math.max(0, now - from) / 3_600_000);
  return Math.floor(hours * rate);
}

/**
 * Collects producers (one by id, or all): resources go into storage up to what it holds (the rest waits in the
 * building, its clock moving on only by what was taken), rent goes straight to the wallet. Returns the new state,
 * what was gathered and the coins of the rent.
 */
export function collect(
  land: LandState,
  now: number,
  only?: number,
): { land: LandState; gathered: Resources; coins: number } {
  const cap = storage(land, now);
  const resources = { ...land.resources };
  const gathered = noResources();
  let coins = 0;
  const buildings = land.buildings.map((b) => {
    if (only !== undefined && b.id !== only) return b;
    const kind = buildingById(b.kind)!;
    if (!kind.produces) return b;
    const have = pending(land, b, now);
    if (have <= 0) return b;
    if (kind.produces === 'monety') {
      coins += have;
      return { ...b, collectedAt: now };
    }
    const room = Math.max(0, cap - resources[kind.produces]);
    const take = Math.min(have, room);
    if (take <= 0) return b;
    resources[kind.produces] += take;
    gathered[kind.produces] += take;
    // all taken: the clock starts again now; storage full: what didn't fit stays in the building
    const left = have - take;
    const collectedAt = left <= 0 ? now : now - Math.ceil((left / hourly(land, b)) * 3_600_000) - 1;
    return { ...b, collectedAt };
  });
  return { land: { ...land, resources, buildings }, gathered, coins };
}

export const footprint = (kind: BuildingKind, x: number, y: number) => ({
  x0: x - (kind.w - 1) / 2,
  x1: x + (kind.w - 1) / 2,
  y0: y - kind.h + 1,
  y1: y,
});

/** Cells covered by a district's buildings (plot-local), for placement and walking. */
function blockedCells(land: LandState, except?: number): Set<number> {
  const out = new Set<number>();
  for (const b of land.buildings) {
    if (b.id === except) continue;
    const f = footprint(buildingById(b.kind)!, b.x, b.y);
    for (let y = f.y0; y <= f.y1; y++)
      for (let x = f.x0; x <= f.x1; x++) out.add(y * PLOT_SIZE + x);
  }
  return out;
}

/** Inside the fence. */
const inside = (x: number, y: number) => x >= 1 && y >= 1 && x < PLOT_SIZE - 1 && y < PLOT_SIZE - 1;

/** Whether a plot-local cell is in the built-up square of the district's stage. */
export function inStage(land: LandState, x: number, y: number) {
  const a = stageArea(land.stage);
  return x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1;
}

/** The gate side of the district's plot ('s' for an unknown plot). */
const gateOf = (land: LandState): GateSide => plotById(land.plot)?.gate ?? 's';

/** Whether a plot-local cell can be walked on: inside the fence (or in the gate), not under a building. */
export function walkable(land: LandState, x: number, y: number, blocked = blockedCells(land)) {
  const inGate = gateCells(gateOf(land)).cells.some(([gx, gy]) => gx === x && gy === y);
  if (!inside(x, y) && !inGate) return false;
  return !blocked.has(y * PLOT_SIZE + x);
}

/** Every building's door (the cell in front of its anchor) can be reached from the gate: nothing is ever walled in. */
export function allReachable(land: LandState): boolean {
  const blocked = blockedCells(land);
  const [sx, sy] = gateCells(gateOf(land)).inside;
  if (!walkable(land, sx, sy, blocked)) return false;
  const seen = new Set<number>([sy * PLOT_SIZE + sx]);
  const queue = [sy * PLOT_SIZE + sx];
  while (queue.length) {
    const c = queue.pop()!;
    const x = c % PLOT_SIZE;
    const y = Math.floor(c / PLOT_SIZE);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const k = ny * PLOT_SIZE + nx;
      if (seen.has(k) || !walkable(land, nx, ny, blocked)) continue;
      seen.add(k);
      queue.push(k);
    }
  }
  return land.buildings.every((b) => seen.has((b.y + 1) * PLOT_SIZE + b.x));
}

export type LandProblem =
  | 'unknown_building'
  | 'too_many'
  | 'outside'
  | 'occupied'
  | 'gate'
  | 'walls_in'
  | 'level_too_low'
  | 'hall_too_low'
  | 'max_level'
  | 'max_stage'
  | 'busy'
  | 'poor'
  | 'not_found';

/** Whether a resource cost can be paid. */
export const canAfford = (have: Resources, cost: Partial<Resources>) =>
  resourceIds.every((r) => have[r] >= (cost[r] ?? 0));

const pay = (have: Resources, cost: Partial<Resources>): Resources => {
  const out = { ...have };
  for (const r of resourceIds) out[r] -= cost[r] ?? 0;
  return out;
};

/** Why a building can't be put here (or null): the stage's square, the gate, other buildings, limits, levels, cost. */
export function placementProblem(
  land: LandState,
  kindId: string,
  x: number,
  y: number,
  budLevel: number,
): LandProblem | null {
  const kind = buildingById(kindId);
  if (!kind) return 'unknown_building';
  const hall = hallLevel(land);
  const count = land.buildings.filter((b) => b.kind === kind.id).length;
  if (count >= (kind.limit[hall - 1] ?? 0)) return 'too_many';
  const first = kind.levels[0]!;
  if (budLevel < first.player) return 'level_too_low';
  const f = footprint(kind, x, y);
  // the building on the stage's square, the cell in front of its door inside the fence
  if (
    !Number.isInteger(f.x0) ||
    !inStage(land, f.x0, f.y0) ||
    !inStage(land, f.x1, f.y1) ||
    !inside(x, f.y1 + 1)
  )
    return 'outside';
  const blocked = blockedCells(land);
  const gate = gateOf(land);
  for (let cy = f.y0; cy <= f.y1 + 1; cy++)
    for (let cx = f.x0; cx <= f.x1; cx++) {
      if (cy === f.y1 + 1 && cx !== x) continue; // only the cell in front of the door must stay clear below
      if (inGateClear(gate, cx, cy)) return 'gate';
      if (blocked.has(cy * PLOT_SIZE + cx)) return 'occupied';
    }
  if (!canAfford(land.resources, first.cost)) return 'poor';
  return null;
}

/** Puts a new building down (call after placementProblem returned null; walling in is checked here). */
export function build(
  land: LandState,
  kindId: BuildingId,
  x: number,
  y: number,
  now: number,
): LandState | 'walls_in' {
  const kind = buildingById(kindId)!;
  const first = kind.levels[0]!;
  const ready = now + first.seconds * 1000;
  const next: LandState = {
    ...land,
    resources: pay(land.resources, first.cost),
    buildings: [
      ...land.buildings,
      { id: land.nextId, kind: kindId, x, y, level: 1, readyAt: ready, collectedAt: ready },
    ],
    nextId: land.nextId + 1,
  };
  return allReachable(next) ? next : 'walls_in';
}

/** Why a building can't be raised a level now (or null). */
export function upgradeProblem(
  land: LandState,
  id: number,
  budLevel: number,
  now: number,
): LandProblem | null {
  const b = land.buildings.find((x) => x.id === id);
  if (!b) return 'not_found';
  const kind = buildingById(b.kind)!;
  if (b.readyAt > now) return 'busy';
  const next = kind.levels[b.level];
  if (!next) return 'max_level';
  if (budLevel < next.player) return 'level_too_low';
  if (b.kind !== 'ratusz' && b.level + 1 > hallLevel(land)) return 'hall_too_low';
  if (!canAfford(land.resources, next.cost)) return 'poor';
  return null;
}

/**
 * Raises a building a level (what it made so far is collected first, its rent included; it makes nothing while it
 * is being raised). Returns the new state and the rent collected on the way.
 */
export function upgrade(
  land: LandState,
  id: number,
  now: number,
): { land: LandState; coins: number } {
  const { land: collected, coins } = collect(land, now, id);
  const b = collected.buildings.find((x) => x.id === id)!;
  const next = buildingById(b.kind)!.levels[b.level]!;
  const ready = now + next.seconds * 1000;
  return {
    land: {
      ...collected,
      resources: pay(collected.resources, next.cost),
      buildings: collected.buildings.map((x) =>
        x.id === id ? { ...x, level: x.level + 1, readyAt: ready, collectedAt: ready } : x,
      ),
    },
    coins,
  };
}

/** Why the district can't grow to its next stage now (or null), and what that stage asks for. */
export function growProblem(
  land: LandState,
  budLevel: number,
  coins: number,
): {
  problem: LandProblem | null;
  cost: Partial<Resources>;
  coins: number;
  level: number;
  hall: number;
} {
  const next = STAGES[land.stage];
  if (!next) return { problem: 'max_stage', cost: {}, coins: 0, level: 0, hall: 0 };
  const out = (problem: LandProblem | null) => ({ problem, ...next });
  if (budLevel < next.level) return out('level_too_low');
  if (hallLevel(land) < next.hall) return out('hall_too_low');
  if (!canAfford(land.resources, next.cost) || coins < next.coins) return out('poor');
  return out(null);
}

export function grow(land: LandState): LandState {
  const next = STAGES[land.stage]!;
  return { ...land, stage: land.stage + 1, resources: pay(land.resources, next.cost) };
}

/** The duel opponent id of a raid on a plot's district, and back. */
export const raidEnemyId = (plot: string) => `raid-${plot}`;
export const raidPlotOf = (enemyId: string) =>
  enemyId.startsWith('raid-') ? enemyId.slice(5) : null;

/** A district's might on the rankings: its stage and its buildings (level² by weight). */
export function landPower(land: LandState): number {
  const weight: Record<string, number> = { ratusz: 30, apartamentowiec: 12, magazyn: 8 };
  let p = land.stage * 15;
  for (const b of land.buildings) p += b.level * b.level * (weight[b.kind] ?? 6);
  return p;
}

/** The district's defence in a raid (per cent of the defender's health added): the bigger the empire, the harder. */
export const landDefence = (power: number) =>
  Math.min(MAX_DEFENCE, Math.floor(Math.sqrt(Math.max(0, power)) * 1.5));

/** The owner's fighter defending its district: more health and armour by the district's defence. */
export function fortify(fighter: Fighter, defence: number): Fighter {
  const hp = Math.round((fighter.maxHp * (100 + defence)) / 100);
  return { ...fighter, maxHp: hp, hp, armor: fighter.armor + Math.floor(defence / 6) };
}

/** How much of each material a raid can't touch. */
export const protectedAmount = (land: LandState, now: number) =>
  PROTECTED_BASE + PROTECTED_PER_LOGISTICS * logisticsLevels(land, now);

/**
 * A won raid: LOOT_SHARE of what the defender holds over its protected amount, as much of it as fits in the
 * raider's storage. Returns both districts after it and the loot.
 */
export function raid(
  raider: LandState,
  defender: LandState,
  now: number,
  by: { name: string; slug: string },
): { raider: LandState; defender: LandState; loot: Resources } {
  const safe = protectedAmount(defender, now);
  const room = storage(raider, now);
  const loot = noResources();
  const theirs = { ...defender.resources };
  const mine = { ...raider.resources };
  for (const r of resourceIds) {
    const take = Math.min(
      Math.floor(Math.max(0, theirs[r] - safe) * LOOT_SHARE),
      Math.max(0, room - mine[r]),
    );
    loot[r] = take;
    theirs[r] -= take;
    mine[r] += take;
  }
  return {
    raider: { ...raider, resources: mine },
    defender: {
      ...defender,
      resources: theirs,
      shieldUntil: now + RAID_SHIELD_HOURS * 3_600_000,
      raids: [{ at: now, by: by.name, slug: by.slug, won: true, loot }, ...defender.raids].slice(
        0,
        RAID_LOG,
      ),
    },
    loot,
  };
}

/** A raid the defender held off: only its log changes. */
export function raidHeld(
  defender: LandState,
  now: number,
  by: { name: string; slug: string },
): LandState {
  return {
    ...defender,
    raids: [
      { at: now, by: by.name, slug: by.slug, won: false, loot: noResources() },
      ...defender.raids,
    ].slice(0, RAID_LOG),
  };
}

export type RaidProblem =
  'level_too_low' | 'no_land' | 'own' | 'target_too_low' | 'shielded' | 'daily_limit' | 'resting';

/** Why this bud can't raid that district now (or null). */
export function raidProblem(
  raider: LandState | null,
  raiderLevel: number,
  raiderSlug: string,
  defender: LandState,
  defenderSlug: string,
  defenderLevel: number,
  now: number,
  day: string,
): RaidProblem | null {
  if (raiderLevel < RAID_MIN_LEVEL) return 'level_too_low';
  if (!raider) return 'no_land';
  if (raiderSlug === defenderSlug) return 'own';
  if (defenderLevel < RAID_MIN_LEVEL) return 'target_too_low';
  if (defender.shieldUntil > now) return 'shielded';
  if (raider.raiding.day === day && raider.raiding.count >= RAIDS_PER_DAY) return 'daily_limit';
  const tried = raider.raiding.tried[defenderSlug];
  if (tried !== undefined && now - tried < RAID_RETRY_MINUTES * 60_000) return 'resting';
  return null;
}

/** The raider's log after starting a raid (counted for the day, the target remembered; old targets forgotten). */
export function startRaid(
  raider: LandState,
  defenderSlug: string,
  now: number,
  day: string,
): LandState {
  const tried: Record<string, number> = {};
  for (const [slug, at] of Object.entries(raider.raiding.tried))
    if (now - at < RAID_RETRY_MINUTES * 60_000) tried[slug] = at;
  tried[defenderSlug] = now;
  const count = raider.raiding.day === day ? raider.raiding.count + 1 : 1;
  return { ...raider, raiding: { day, count, tried } };
}

/** Coins for selling `amount` of a resource (whole batches of SELL_BATCH only). */
export function sellValue(resource: ResourceId, amount: number): number {
  const r = RESOURCES.find((x) => x.id === resource)!;
  return Math.floor(amount / SELL_BATCH) * r.price;
}

// ---------- API shapes ----------

export const buyPlotRequestSchema = z.object({
  plot: z.string().min(1).max(40),
  name: districtNameSchema,
});
export const renameLandRequestSchema = z.object({ name: districtNameSchema });
export const buildRequestSchema = z.object({
  kind: z.enum(buildingIds),
  x: z.number().int().min(0).max(PLOT_SIZE),
  y: z.number().int().min(0).max(PLOT_SIZE),
});
export const collectRequestSchema = z.object({ id: z.number().int().nonnegative().optional() });
export const sellResourceRequestSchema = z.object({
  resource: z.enum(resourceIds),
  amount: z.number().int().min(SELL_BATCH).max(100_000),
});
export const raidRequestSchema = z.object({ plot: z.string().min(1).max(40) });

/** The bud's own district as the game sees it: its state, the server's clock, what it holds, its might. */
export type LandView = {
  land: LandState;
  now: number;
  storage: number;
  power: number;
  defence: number;
  /** Of every material this much is safe from raids. */
  protected: number;
  /** Units waiting in each producer that has any. */
  pending: { id: number; amount: number }[];
};

export type LandResponse = {
  land: LandView | null;
  coins?: number;
  gathered?: Resources;
  /** Rent collected with this request. */
  rent?: number;
};

export function landView(land: LandState, now: number): LandView {
  const waiting: { id: number; amount: number }[] = [];
  for (const b of land.buildings) {
    const n = pending(land, b, now);
    if (n > 0) waiting.push({ id: b.id, amount: n });
  }
  const power = landPower(land);
  return {
    land,
    now,
    storage: storage(land, now),
    power,
    defence: landDefence(power),
    protected: protectedAmount(land, now),
    pending: waiting,
  };
}

/** Any district as everyone on the wasteland sees it: who owns it, its name, buildings and defence (no stores). */
export type DistrictView = {
  plot: string;
  owner: { slug: string; name: string; level: number };
  name: string;
  stage: number;
  buildings: { id: number; kind: string; x: number; y: number; level: number; readyAt: number }[];
  power: number;
  defence: number;
  shieldUntil: number;
};

export type DistrictsResponse = { route: string; now: number; districts: DistrictView[] };

export function districtView(
  land: LandState,
  owner: { slug: string; name: string; level: number },
): DistrictView {
  const power = landPower(land);
  return {
    plot: land.plot,
    owner,
    name: land.name,
    stage: land.stage,
    buildings: land.buildings.map(({ id, kind, x, y, level, readyAt }) => ({
      id,
      kind,
      x,
      y,
      level,
      readyAt,
    })),
    power,
    defence: landDefence(power),
    shieldUntil: land.shieldUntil,
  };
}

/** Player-facing words for a problem (Polish). */
export const LAND_PROBLEM_TEXT: Record<LandProblem, string> = {
  unknown_building: 'Nie ma takiego budynku.',
  too_many: 'Masz już tyle takich budynków, ile pozwala ratusz. Ulepsz ratusz.',
  outside: 'Tu jeszcze nie da się budować. Rozbuduj dystrykt.',
  occupied: 'To miejsce jest zajęte.',
  gate: 'Przy bramie musi zostać wolne przejście.',
  walls_in: 'Tak postawiony budynek zamknąłby drogę do innych.',
  level_too_low: 'Na to potrzebujesz wyższego poziomu.',
  hall_too_low: 'Najpierw ulepsz ratusz.',
  max_level: 'To już najwyższy poziom.',
  max_stage: 'Dystrykt zajmuje już całą działkę.',
  busy: 'Trwa budowa.',
  poor: 'Brakuje surowców.',
  not_found: 'Nie ma tu takiego budynku.',
};

export const RAID_PROBLEM_TEXT: Record<RaidProblem, string> = {
  level_too_low: `Napady od poziomu ${RAID_MIN_LEVEL}.`,
  no_land: 'Najpierw kup działkę: łup musi gdzieś trafić.',
  own: 'To twój dystrykt.',
  target_too_low: `Właściciel nie ma jeszcze poziomu ${RAID_MIN_LEVEL}: jego dystrykt jest bezpieczny.`,
  shielded: 'Ten dystrykt jest teraz pod ochroną.',
  daily_limit: `Dziś było już ${RAIDS_PER_DAY} napadów. Wróć jutro.`,
  resting: `Na ten dystrykt spróbujesz znowu za jakiś czas (do ${RAID_RETRY_MINUTES} min).`,
};
