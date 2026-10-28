import { MOVES, PERK_MOVES, Rng, critChance, damage, type Fighter, type MoveId } from './combat';
import { DISTRICTS, TUTORIAL_ISLAND } from './districts';
import { liveCell, positionWalkable, walkGrid, cellWalkable, nearestWalkable } from './live';
import { PORTS, ROUTES } from './travel';
import { TURFS } from './turfs';
import type { Enemy } from './combat';
import type { WeaponKind } from './gear';

/**
 * Walka (docs/walka.md): real-time fights in the open world, in the main view, like a MOBA. Everyone on a map is in
 * one fight simulation run by the server (`Brawl`, 20 ticks a second): buds move as before (the game sends its
 * position, the server checks it), abilities are asked for (`act`) and resolved here, so nobody can fake a hit, a
 * cooldown or a reward. The people of the districts stand where they always stood and fight back when attacked
 * (lurkers on the wastelands jump out on their own); from PVP_MIN_LEVEL buds can fight each other anywhere but the
 * safe zones (markets, harbours, rooms, the tutorial island), crews fight side by side.
 *
 * Every number is in tiles, seconds·1000 (ms) and the fighter stats of combat.ts (gear, skills, perks, drinks), so
 * the same bud is as strong here as everywhere else. Positions are Unity world units (x right, y up, the feet).
 */

// ---------- rules ----------

/** One simulation step (ms). */
export const BRAWL_TICK_MS = 50;
/** Health is the duel health times this: fights last seconds, not one blow. */
export const BRAWL_HP = 3;
/** The people of the districts: a bit less, they come at the bud one at a time and stand up again. */
export const MOB_HP = 2.4;
/** …and hit a bit harder than their duel moves (%): a fight against one of them is a real fight. */
export const MOB_DAMAGE = 118;
/** Buds (and shadows) hit each other this much harder (%): two of them are tough, a duel should still be quick. */
export const PVP_DAMAGE = 175;
/** Buds fight each other from this level on (both of them). */
export const PVP_MIN_LEVEL = 6;
/** The ultimate opens at this level. */
export const ULT_LEVEL = 5;
/** A knocked-out bud gets up after this long (ms), full of health, somewhere safe. */
export const KO_MS = 5000;
/** After getting up nobody can hurt the bud for a while (ms), and it can't start a fight with another bud. */
export const SPAWN_GUARD_MS = 4000;
/** No blow given or taken for this long (ms): health comes back by itself… */
export const OUT_OF_COMBAT_MS = 6000;
/** …this share of the maximum every second. */
export const REGEN_PER_SECOND = 0.05;
/** A beaten opponent of the districts stands up again after this long (ms). */
export const MOB_RESPAWN_MS = 45_000;
/** An opponent that is led further than this from its spot gives up, goes back and heals. */
export const LEASH = 10;
/** Lurkers jump out when a bud comes this close (Unity Ambush.SpringRadius), and wait this long (ms) after. */
export const SPRING_RADIUS = 2.4;
export const LURK_COOLDOWN_MS = 25_000;
/** How long a lurker takes to get out of its nook before the first blow (ms). */
export const SPRING_WINDUP_MS = 700;
/** A shadow (Rewiry rival, raid defender) gives up when its challenger runs this far away. */
export const SHADOW_GIVE_UP = 16;
/** The least time between two casts of one bud (ms), whatever the cooldowns. */
export const GLOBAL_COOLDOWN_MS = 220;
/** How far a bud's own report may be from a target it says it hits (tiles of slack over the range). */
export const RANGE_SLACK = 0.6;
/** Coins in the pocket lost on a knockout: % of them, at most this many (PvE losses are burned, PvP ones taken). */
export const KO_LOSS_PVE = { percent: 2, max: 20 } as const;
export const KO_LOSS_PVP = { percent: 5, max: 50 } as const;
/** The same two buds pay each other coins (and rating) at most once in this long (ms). */
export const KO_PAIR_MS = 30 * 60 * 1000;

/** Coins a knockout costs (never more than the bud has). */
export const knockoutLoss = (coins: number, rule: { percent: number; max: number }) =>
  Math.max(0, Math.min(rule.max, Math.floor((Math.max(0, coins) * rule.percent) / 100)));

// ---------- safe zones ----------

/** The turfs where buds never fight each other: the markets, the squares at the gates and the harbours. */
export const SAFE_TURFS = [
  'mz-rynek',
  'mz-port-rzeczny',
  'dp-obozowisko',
  'lp-miasteczko',
  'lp-przystan-jachtowa',
  'dc-aleja-carska',
  'lk-bazar',
  'lk-port-przemytnikow',
] as const;
/** Around every ferryman too (tiles). */
export const SAFE_PORT_RADIUS = 7;

const districtIds = new Set<string>(DISTRICTS.map((d) => d.id));
const routeIds = new Set<string>(ROUTES.map((r) => r.id));

/** Rooms and the tutorial island are safe everywhere; cities and wastelands only in their safe zones. */
export const safeMap = (map: string) =>
  map === TUTORIAL_ISLAND.id || (!districtIds.has(map) && !routeIds.has(map));

/** Is this world position somewhere buds can't fight each other? */
export function safeAt(map: string, x: number, y: number): boolean {
  if (safeMap(map)) return true;
  const g = walkGrid(map);
  if (!g) return true;
  const [cx, cy] = liveCell(x, y, g.h);
  for (const t of TURFS)
    if (
      t.district === map &&
      (SAFE_TURFS as readonly string[]).includes(t.id) &&
      cx >= t.x0 &&
      cx <= t.x1 &&
      cy >= t.y0 &&
      cy <= t.y1
    )
      return true;
  return PORTS.some(
    (p) => p.district === map && Math.hypot(p.x - cx, p.y - cy) <= SAFE_PORT_RADIUS,
  );
}

/** Where a knocked-out bud gets up: the middle of the nearest safe zone of its map, or where it fell. */
export function respawnPoint(map: string, x: number, y: number): { x: number; y: number } {
  const g = walkGrid(map);
  if (!g) return { x, y };
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const t of TURFS) {
    if (t.district !== map || !(SAFE_TURFS as readonly string[]).includes(t.id)) continue;
    const cx = (t.x0 + t.x1) / 2;
    const cy = (t.y0 + t.y1) / 2;
    const at = nearestWalkable(map, cx + 0.5, g.h - 1 - cy + 0.2);
    if (!at) continue;
    const d = Math.hypot(at.x - x, at.y - y);
    if (d < bestD) {
      best = at;
      bestD = d;
    }
  }
  return best ?? nearestWalkable(map, x, y) ?? { x, y };
}

/** The feet of a map cell (map coordinates, y down) in world units: the same spot the game stands a character on. */
export const cellFeet = (map: string, cx: number, cy: number) => {
  const h = walkGrid(map)?.h ?? 0;
  return { x: cx + 0.5, y: h - 1 - cy + 0.2 };
};

// ---------- abilities ----------

/**
 * How an ability reaches: `melee` one blow in front, `arc`/`cone` everyone in a wedge, `proj` flying shots,
 * `line` a straight strip at once, `circle` an area at a spot, `self` an area around the caster, `dash` a lunge that
 * hits on the way (and may land with an area), `buff` and `shield` the caster itself.
 */
export const ABILITY_SHAPES = [
  'melee',
  'arc',
  'proj',
  'line',
  'circle',
  'self',
  'dash',
  'buff',
  'shield',
] as const;
export type AbilityShape = (typeof ABILITY_SHAPES)[number];

export type AbilitySpec = {
  shape: AbilityShape;
  /** Reach (tiles): the blow, the shot's flight, the line, how far away the area can be put, the dash. */
  range: number;
  /** Area radius, a shot's size, a dash's sweep (tiles). */
  radius?: number;
  /** Wedge width (degrees) for melee/arc. */
  angle?: number;
  /** Strip width (tiles) for line. */
  width?: number;
  cd: number;
  /** From the press to the blow (ms): the swing everyone can see coming. */
  windup: number;
  /** Shots: speed (tiles/s), how many, the fan between them (degrees). */
  speed?: number;
  shots?: number;
  spread?: number;
  /** Blows of one cast (melee repeats, area pulses) and the time between them (ms). */
  hits?: number;
  every?: number;
  /** Damage of a blow, % of the move's power; 0 = no damage. */
  scale: number;
  stun?: number;
  root?: number;
  /** Slow: share of speed taken (%), for how long (ms). */
  slow?: [number, number];
  /** Push away from the caster (tiles). */
  knock?: number;
  /** Shield: % of the maximum health, for how long (ms). */
  shield?: [number, number];
  /** Next blows that are certain critical hits. */
  aim?: number;
  /** Can't be hit (ms) and faster (%, ms) — a dodge. */
  dodge?: number;
  haste?: [number, number];
  /** Blind (misses more) / weaken (hits softer) the ones hit (ms). */
  blind?: number;
  weaken?: number;
  /** A dash that lands with an area of this radius. */
  land?: number;
};

/** Ultimates: one per weapon kind, from ULT_LEVEL (a perk's special move takes its place when the bud has one). */
export const ULTIMATES = {
  'ult-piesci': { name: 'Nokaut', power: [12, 16], weapon: 'piesci' },
  'ult-kij': { name: 'Home run', power: [13, 18], weapon: 'kij' },
  'ult-procarka': { name: 'Deszcz kamieni', power: [6, 9], weapon: 'procarka' },
  'ult-spray': { name: 'Ściana farby', power: [7, 10], weapon: 'spray' },
  'ult-mikrofon': { name: 'Koncert', power: [6, 8], weapon: 'mikrofon' },
  'ult-deska': { name: 'Rampa', power: [11, 15], weapon: 'deska' },
} as const satisfies Record<string, { name: string; power: [number, number]; weapon: WeaponKind }>;
export type UltimateId = keyof typeof ULTIMATES;

/** Moves any weapon can carry (a loadout's wider choice, loadout.ts), on top of the weapons' own. */
export const EXTRAS = {
  podciecie: { name: 'Podcięcie', power: [6, 9], anim: 'kick' },
  zryw: { name: 'Zryw', power: [0, 0], anim: 'dodge' },
} as const satisfies Record<
  string,
  { name: string; power: readonly [number, number]; anim: string }
>;
export type ExtraId = keyof typeof EXTRAS;
export type AbilityId = MoveId | UltimateId | ExtraId;

const S = (spec: AbilitySpec) => spec;
const basic = { cd: 700, windup: 110 };

/** Every move of combat.ts as a real-time ability, plus the ultimates. */
export const ABILITIES: Record<AbilityId, AbilitySpec> = {
  // guard (everyone)
  garda: S({ shape: 'shield', range: 0, cd: 12_000, windup: 0, scale: 0, shield: [22, 2500] }),
  kontra: S({
    shape: 'shield',
    range: 0,
    radius: 1.7,
    cd: 12_000,
    windup: 0,
    scale: 100,
    shield: [26, 2500],
  }),
  // fists
  prosty: S({ shape: 'melee', range: 1.35, angle: 110, ...basic, scale: 100 }),
  'seria-ciosow': S({
    shape: 'melee',
    range: 1.35,
    angle: 110,
    ...basic,
    hits: 2,
    every: 140,
    scale: 70,
  }),
  sierpowy: S({
    shape: 'dash',
    range: 2.6,
    radius: 0.9,
    cd: 6000,
    windup: 60,
    scale: 115,
    stun: 650,
  }),
  bomba: S({
    shape: 'dash',
    range: 2.8,
    radius: 0.95,
    cd: 6000,
    windup: 60,
    scale: 125,
    stun: 900,
  }),
  kopniak: S({
    shape: 'arc',
    range: 2.1,
    angle: 80,
    cd: 7500,
    windup: 200,
    scale: 105,
    knock: 1.8,
  }),
  'z-polobrotu': S({
    shape: 'arc',
    range: 2.3,
    angle: 100,
    cd: 7500,
    windup: 200,
    scale: 110,
    knock: 2.2,
    weaken: 2500,
  }),
  // bats, sticks, canes
  pchniecie: S({ shape: 'melee', range: 1.8, angle: 60, cd: 800, windup: 130, scale: 100 }),
  'szybkie-pchniecie': S({
    shape: 'melee',
    range: 1.8,
    angle: 60,
    cd: 800,
    windup: 130,
    hits: 2,
    every: 150,
    scale: 70,
  }),
  zamach: S({
    shape: 'arc',
    range: 2.0,
    angle: 150,
    cd: 5000,
    windup: 240,
    scale: 95,
    slow: [30, 1500],
  }),
  'z-gory': S({
    shape: 'arc',
    range: 2.1,
    angle: 120,
    cd: 5000,
    windup: 260,
    scale: 100,
    stun: 700,
  }),
  mlyniec: S({
    shape: 'self',
    range: 0,
    radius: 2.0,
    cd: 9000,
    windup: 150,
    hits: 2,
    every: 300,
    scale: 60,
    knock: 1,
  }),
  huragan: S({
    shape: 'self',
    range: 0,
    radius: 2.3,
    cd: 9000,
    windup: 150,
    hits: 3,
    every: 260,
    scale: 55,
    knock: 1.2,
  }),
  // slingshots, bows
  strzal: S({ shape: 'proj', range: 7, radius: 0.45, speed: 15, ...basic, cd: 850, scale: 95 }),
  'precyzyjny-strzal': S({
    shape: 'proj',
    range: 8,
    radius: 0.45,
    speed: 19,
    ...basic,
    cd: 850,
    scale: 95,
  }),
  seria: S({
    shape: 'proj',
    range: 6.5,
    radius: 0.4,
    speed: 14,
    shots: 3,
    spread: 16,
    cd: 6000,
    windup: 140,
    scale: 90,
  }),
  grad: S({
    shape: 'proj',
    range: 6.5,
    radius: 0.4,
    speed: 14,
    shots: 5,
    spread: 12,
    cd: 6000,
    windup: 140,
    scale: 95,
  }),
  celowanie: S({
    shape: 'buff',
    range: 0,
    cd: 10_000,
    windup: 0,
    scale: 0,
    aim: 2,
    haste: [15, 3000],
  }),
  snajper: S({ shape: 'line', range: 11, width: 0.7, cd: 10_000, windup: 450, scale: 220, aim: 1 }),
  // spray cans
  psik: S({ shape: 'arc', range: 2.6, angle: 45, ...basic, cd: 900, scale: 115, blind: 1500 }),
  'psik-z-bliska': S({
    shape: 'arc',
    range: 2.6,
    angle: 50,
    ...basic,
    cd: 900,
    scale: 115,
    blind: 2000,
  }),
  chmura: S({
    shape: 'circle',
    range: 5,
    radius: 1.8,
    cd: 7000,
    windup: 300,
    hits: 3,
    every: 450,
    scale: 45,
    slow: [40, 1200],
  }),
  'burza-farby': S({
    shape: 'circle',
    range: 5.5,
    radius: 2.3,
    cd: 7000,
    windup: 300,
    hits: 3,
    every: 450,
    scale: 45,
    slow: [45, 1400],
  }),
  // microphones
  diss: S({
    shape: 'proj',
    range: 6,
    radius: 0.55,
    speed: 11,
    ...basic,
    cd: 900,
    scale: 160,
    weaken: 2500,
  }),
  roast: S({
    shape: 'proj',
    range: 6.5,
    radius: 0.6,
    speed: 12,
    ...basic,
    cd: 900,
    scale: 140,
    weaken: 3000,
  }),
  bit: S({
    shape: 'line',
    range: 6,
    width: 1.2,
    cd: 6000,
    windup: 220,
    scale: 100,
    slow: [35, 2000],
  }),
  'basowy-bit': S({
    shape: 'line',
    range: 6.5,
    width: 1.5,
    cd: 6000,
    windup: 220,
    scale: 105,
    slow: [40, 2200],
  }),
  drop: S({ shape: 'self', range: 0, radius: 2.4, cd: 10_000, windup: 380, scale: 95, stun: 800 }),
  'mega-drop': S({
    shape: 'self',
    range: 0,
    radius: 2.8,
    cd: 10_000,
    windup: 380,
    scale: 100,
    stun: 1100,
  }),
  // skateboards
  deska: S({ shape: 'melee', range: 1.6, angle: 120, cd: 800, windup: 130, scale: 100 }),
  ollie: S({ shape: 'melee', range: 1.7, angle: 120, cd: 800, windup: 130, scale: 95, knock: 0.6 }),
  kickflip: S({
    shape: 'dash',
    range: 3.2,
    radius: 1.0,
    cd: 7000,
    windup: 80,
    scale: 100,
    knock: 1.4,
  }),
  'flip-360': S({
    shape: 'dash',
    range: 3.6,
    radius: 1.05,
    cd: 7000,
    windup: 80,
    scale: 105,
    stun: 550,
  }),
  slizg: S({
    shape: 'dash',
    range: 2.6,
    cd: 8000,
    windup: 0,
    scale: 0,
    dodge: 450,
    haste: [30, 2000],
  }),
  grind: S({
    shape: 'dash',
    range: 3.0,
    radius: 0.9,
    cd: 8000,
    windup: 0,
    scale: 100,
    dodge: 500,
    haste: [30, 2200],
  }),
  // perks' special moves (they take the ultimate's place)
  freestyle: S({
    shape: 'self',
    range: 0,
    radius: 3.1,
    cd: 28_000,
    windup: 300,
    hits: 3,
    every: 380,
    scale: 110,
    weaken: 3000,
    slow: [30, 1500],
  }),
  tag: S({
    shape: 'circle',
    range: 6,
    radius: 2.2,
    cd: 28_000,
    windup: 800,
    scale: 230,
    root: 1500,
    blind: 2500,
  }),
  specjalny: S({
    shape: 'dash',
    range: 4,
    radius: 1.0,
    land: 2.0,
    cd: 28_000,
    windup: 150,
    scale: 200,
    stun: 1000,
  }),
  // ultimates
  'ult-piesci': S({
    shape: 'dash',
    range: 4,
    radius: 0.9,
    land: 1.9,
    cd: 30_000,
    windup: 160,
    scale: 190,
    stun: 1000,
  }),
  'ult-kij': S({
    shape: 'arc',
    range: 3,
    angle: 110,
    cd: 30_000,
    windup: 420,
    scale: 240,
    knock: 4,
    stun: 400,
  }),
  'ult-procarka': S({
    shape: 'circle',
    range: 7,
    radius: 2.5,
    cd: 30_000,
    windup: 400,
    hits: 4,
    every: 300,
    scale: 110,
    slow: [35, 1200],
  }),
  'ult-spray': S({
    shape: 'line',
    range: 6,
    width: 1.8,
    cd: 30_000,
    windup: 350,
    scale: 210,
    blind: 3000,
    slow: [50, 2500],
  }),
  'ult-mikrofon': S({
    shape: 'self',
    range: 0,
    radius: 3.3,
    cd: 30_000,
    windup: 300,
    hits: 4,
    every: 350,
    scale: 100,
    slow: [30, 1500],
    weaken: 3000,
  }),
  // any weapon (loadout.ts)
  podciecie: S({
    shape: 'arc',
    range: 1.9,
    angle: 120,
    cd: 9000,
    windup: 160,
    scale: 80,
    root: 900,
  }),
  zryw: S({
    shape: 'buff',
    range: 0,
    cd: 12_000,
    windup: 0,
    scale: 0,
    haste: [45, 2500],
    dodge: 300,
  }),
  'ult-deska': S({
    shape: 'dash',
    range: 6,
    radius: 1.1,
    cd: 30_000,
    windup: 120,
    scale: 200,
    stun: 800,
  }),
};

/** The picture on an ability's button (Resources/Abilities, tools/world/art/ability-icons.ts). */
const ICON: Record<AbilityId, string> = {
  garda: 'ab-shield',
  kontra: 'ab-counter',
  prosty: 'ab-fist',
  'seria-ciosow': 'ab-fist',
  sierpowy: 'ab-dash',
  bomba: 'ab-dash',
  kopniak: 'ab-kick',
  'z-polobrotu': 'ab-kick',
  pchniecie: 'ab-bat',
  'szybkie-pchniecie': 'ab-bat',
  zamach: 'ab-arc',
  'z-gory': 'ab-arc',
  mlyniec: 'ab-spin',
  huragan: 'ab-spin',
  strzal: 'ab-stone',
  'precyzyjny-strzal': 'ab-stone',
  seria: 'ab-fan',
  grad: 'ab-fan',
  celowanie: 'ab-aim',
  snajper: 'ab-snipe',
  psik: 'ab-spray',
  'psik-z-bliska': 'ab-spray',
  chmura: 'ab-cloud',
  'burza-farby': 'ab-cloud',
  diss: 'ab-mic',
  roast: 'ab-mic',
  bit: 'ab-wave',
  'basowy-bit': 'ab-wave',
  drop: 'ab-drop',
  'mega-drop': 'ab-drop',
  deska: 'ab-board',
  ollie: 'ab-board',
  kickflip: 'ab-flip',
  'flip-360': 'ab-flip',
  slizg: 'ab-dodge',
  grind: 'ab-dodge',
  freestyle: 'ab-star',
  tag: 'ab-tag',
  specjalny: 'ab-star',
  'ult-piesci': 'ab-star',
  'ult-kij': 'ab-homerun',
  'ult-procarka': 'ab-rain',
  'ult-spray': 'ab-tag',
  'ult-mikrofon': 'ab-drop',
  'ult-deska': 'ab-ramp',
  podciecie: 'ab-sweep',
  zryw: 'ab-sprint',
};
export const abilityIcon = (id: AbilityId) => ICON[id];
export const ABILITY_ICON_NAMES = [...new Set(Object.values(ICON))];

/** An upgraded move (ranks 0–3, loadout.ts): damage (%), cooldown and hold factors. */
export const MOVE_MAX_RANK = 3;
export const rankDamage = (rank: number) => 100 + 10 * Math.max(0, Math.min(MOVE_MAX_RANK, rank));
export const rankCooldown = (rank: number) => 1 - 0.06 * Math.max(0, Math.min(MOVE_MAX_RANK, rank));
export const rankHold = (rank: number) => 1 + 0.12 * Math.max(0, Math.min(MOVE_MAX_RANK, rank));

/** The ability buttons: basic attack, two abilities, guard, ultimate. */
export const KIT_SLOTS = 5;
export const SLOT_ULT = 4;

export const abilityName = (id: AbilityId) =>
  id in ULTIMATES
    ? ULTIMATES[id as UltimateId].name
    : id in EXTRAS
      ? EXTRAS[id as ExtraId].name
      : MOVES[id as MoveId].name;
export const abilityPower = (id: AbilityId): readonly [number, number] =>
  id in ULTIMATES
    ? ULTIMATES[id as UltimateId].power
    : id in EXTRAS
      ? EXTRAS[id as ExtraId].power
      : MOVES[id as MoveId].power;
/** The move's animation tag (combat.ts MOVE_ANIMS); ultimates play the closest one. */
export const abilityAnim = (id: AbilityId) =>
  id in ULTIMATES
    ? (
        {
          piesci: 'hook',
          kij: 'swing',
          procarka: 'shoot',
          spray: 'spray',
          mikrofon: 'shout',
          deska: 'flip',
        } as const
      )[ULTIMATES[id as UltimateId].weapon]
    : id in EXTRAS
      ? EXTRAS[id as ExtraId].anim
      : MOVES[id as MoveId].anim;

/**
 * A fighter's five buttons: the weapon's four moves as it knows them (basic, two abilities, guard) and the ultimate
 * from ULT_LEVEL (a perk's special move instead when it has one). An empty slot is null.
 */
export function kitOf(f: Fighter): (AbilityId | null)[] {
  // a loadout the bud put together (loadout.ts, checked by the server when saved and when the fighter is made)
  if (f.kit?.length === KIT_SLOTS && f.kit.every((id) => id === null || id in ABILITIES))
    return f.kit as (AbilityId | null)[];
  const weaponMoves = f.moves.filter((m) => !Object.values(PERK_MOVES).includes(m));
  const perk = f.moves.find((m) => Object.values(PERK_MOVES).includes(m)) ?? null;
  const ult: AbilityId | null =
    perk ?? (f.level >= ULT_LEVEL ? (`ult-${f.weapon}` as UltimateId) : null);
  // guard always on the fourth button, the rest in the weapon's order
  const guard = weaponMoves.find((m) => m === 'garda' || m === 'kontra') ?? 'garda';
  const rest = weaponMoves.filter((m) => m !== guard);
  return [rest[0] ?? 'prosty', rest[1] ?? null, rest[2] ?? null, guard, ult];
}

/** What the game shows of an ability: name, shape and reach for the aim, the cooldown. */
export type KitEntry = {
  id: AbilityId;
  name: string;
  shape: AbilityShape;
  range: number;
  radius: number;
  angle: number;
  width: number;
  cd: number;
  anim: string;
  icon: string;
  /** From the press to the blow (ms). */
  windup: number;
  /** How far the bud upgraded it (loadout.ts), already counted in the cooldown. */
  rank: number;
};

export const kitEntry = (id: AbilityId): KitEntry => {
  const s = ABILITIES[id];
  return {
    id,
    name: abilityName(id),
    shape: s.shape,
    range: s.range,
    radius: s.land ?? s.radius ?? 0,
    angle: s.angle ?? 0,
    width: s.width ?? 0,
    cd: s.cd,
    anim: abilityAnim(id),
    icon: abilityIcon(id),
    windup: s.windup,
    rank: 0,
  };
};

/** The chance (%) that a blow misses this fighter: speed and survival instinct, a bit more with Unik surfera. */
export const evadeChance = (f: Fighter) =>
  Math.min(
    25,
    Math.floor(f.speed / 4) +
      Math.floor((3 * f.przetrwanie) / 2) +
      (f.perks.includes('unik-surfera') ? 5 : 0),
  );

/** Walking speed in a fight (tiles/s): opponents of the districts; buds walk with their own motor. */
export const mobSpeed = (f: Fighter) => Math.min(4.4, 3.0 + f.speed * 0.04);

// ---------- the simulation ----------

export type UnitKind = 'bud' | 'mob' | 'shadow';

export type Unit = {
  id: string;
  kind: UnitKind;
  /** Same team never hurts each other: a crew's tag, or the bud's own id. Opponents of the districts: 'mobs'. */
  team: string;
  name: string;
  level: number;
  fighter: Fighter;
  kit: (AbilityId | null)[];
  /** Opponents of the districts: which one and which of its spots. */
  enemyId?: string;
  spot?: number;
  boss?: boolean;
  ambush?: boolean;
  /** A shadow fights only this bud (and only this bud fights it); its fight record. */
  only?: string;
  fightId?: string;
  x: number;
  y: number;
  /** Facing on the wire (0 down, 1 side left, 2 up, 3 side right) and walking. */
  f: number;
  m: boolean;
  hp: number;
  maxHp: number;
  shield: number;
  shieldUntil: number;
  stunUntil: number;
  rootUntil: number;
  slowUntil: number;
  slowPct: number;
  hasteUntil: number;
  hastePct: number;
  blindUntil: number;
  weakUntil: number;
  dodgeUntil: number;
  aimHits: number;
  /** A cast being wound up: it lands at castAt. */
  cast: { slot: number; id: AbilityId; x: number; y: number; tid?: string } | null;
  castAt: number;
  lastCast: number;
  /** When each button is ready again (ms). */
  ready: number[];
  /** Knocked out until (buds), beaten until (opponents); 0 = standing. */
  downUntil: number;
  guardUntil: number;
  lastCombat: number;
  secondWind: boolean;
  /** Forced moves (dash, knockback, getting up) so far: the game echoes it, older reports are ignored. */
  fseq: number;
  /** Damage dealt to it per attacker since it last stood fresh (who shares the win). */
  dmgBy: Map<string, number>;
  // opponents
  home: { x: number; y: number };
  target: string | null;
  lurking: boolean;
  lurkReadyAt: number;
  awakeAt: number;
  returning: boolean;
  path: { x: number; y: number }[];
  pathAt: number;
  pathGoal: string;
  /** Changed since the last broadcast. */
  dirty: boolean;
};

/** Something that happened, for the game to show. Optional fields depend on `k`. */
export type BrawlEvent = {
  k:
    | 'cast'
    | 'proj'
    | 'hit'
    | 'st'
    | 'area'
    | 'dash'
    | 'knock'
    | 'ko'
    | 'rsp'
    | 'heal'
    | 'spawn'
    | 'gone'
    | 'aggro'
    | 'calm';
  /** Who did it (caster, attacker), to whom. */
  u?: string;
  v?: string;
  /** Ability, or a status ('stun' 'root' 'slow' 'shield' 'blind' 'weak' 'aim' 'dodge' 'haste' 'unshield'). */
  a?: string;
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  /** Damage / heal amount / shot speed; the target's health after it and its maximum. */
  n?: number;
  h?: number;
  mh?: number;
  /** Critical hit; the blow missed. */
  c?: boolean;
  e?: boolean;
  /** Duration (ms), radius (tiles), the forced-move number. */
  ms?: number;
  r?: number;
  q?: number;
  /** Casts and areas: the ability's shape, and its wedge angle or strip width (the game draws the warning). */
  s?: string;
  w?: number;
};

/** A won fight against an opponent of the districts: who shares it. */
export type BrawlKill = { unit: Unit; by: string[] };
/** A knocked-out bud, and who did it (null: nobody in particular). */
export type BrawlDown = { unit: Unit; by: Unit | null };
/** A shadow that left the fight without a knockout (its challenger ran or left). */
export type BrawlGone = { unit: Unit; exchanged: boolean };

export type StepResult = {
  events: BrawlEvent[];
  kills: BrawlKill[];
  downs: BrawlDown[];
  gone: BrawlGone[];
};

type Shot = {
  id: number;
  owner: string;
  ability: AbilityId;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  left: number;
  radius: number;
};

type Area = {
  owner: string;
  ability: AbilityId;
  x: number;
  y: number;
  r: number;
  at: number;
  left: number;
  every: number;
  /** A self area follows its caster. */
  follow: boolean;
};

const round2 = (v: number) => Math.round(v * 100) / 100;

const facingOf = (dx: number, dy: number, was: number) => {
  if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) return was;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 3 : 1;
  return dy > 0 ? 2 : 0;
};

/**
 * The fight simulation of one map. Plain code: the live server owns one per room, the tests drive it with a clock.
 * `step(now)` moves everything on by one tick and tells what happened; the server turns that into messages, XP and
 * coins (which it grants once, through the store, as before).
 */
export class Brawl {
  readonly units = new Map<string, Unit>();
  private shots: Shot[] = [];
  private areas: Area[] = [];
  private shotId = 1;
  private readonly rng: Rng;
  private events: BrawlEvent[] = [];
  private kills: BrawlKill[] = [];
  private downs: BrawlDown[] = [];
  private gone: BrawlGone[] = [];
  private last = 0;

  constructor(
    readonly map: string,
    seed: number,
    private now: number,
  ) {
    this.rng = new Rng(seed | 0);
    this.last = now;
  }

  // ---------- who is in it ----------

  private blank(
    id: string,
    kind: UnitKind,
    team: string,
    fighter: Fighter,
    x: number,
    y: number,
  ): Unit {
    const maxHp = Math.round(fighter.maxHp * (kind === 'mob' ? MOB_HP : BRAWL_HP));
    return {
      id,
      kind,
      team,
      name: fighter.name,
      level: fighter.level,
      fighter,
      kit: kitOf(fighter),
      x,
      y,
      f: 0,
      m: false,
      hp: maxHp,
      maxHp,
      shield: 0,
      shieldUntil: 0,
      stunUntil: 0,
      rootUntil: 0,
      slowUntil: 0,
      slowPct: 0,
      hasteUntil: 0,
      hastePct: 0,
      blindUntil: 0,
      weakUntil: 0,
      dodgeUntil: 0,
      aimHits: 0,
      cast: null,
      castAt: 0,
      lastCast: 0,
      ready: new Array<number>(KIT_SLOTS).fill(0),
      downUntil: 0,
      guardUntil: 0,
      lastCombat: 0,
      secondWind: false,
      fseq: 0,
      dmgBy: new Map(),
      home: { x, y },
      target: null,
      lurking: false,
      lurkReadyAt: 0,
      awakeAt: 0,
      returning: false,
      path: [],
      pathAt: 0,
      pathGoal: '',
      dirty: true,
    };
  }

  /** A bud walks in (or comes back with a new fighter: gear, level, drinks). Health keeps its share. */
  addBud(id: string, team: string, fighter: Fighter, x: number, y: number): Unit {
    const old = this.units.get(id);
    const u = this.blank(id, 'bud', team, fighter, x, y);
    if (old) {
      u.hp = Math.max(1, Math.round((old.hp / old.maxHp) * u.maxHp));
      if (old.downUntil) u.hp = 0;
      for (const k of [
        'shield',
        'shieldUntil',
        'stunUntil',
        'rootUntil',
        'slowUntil',
        'slowPct',
        'hasteUntil',
        'hastePct',
        'blindUntil',
        'weakUntil',
        'dodgeUntil',
        'aimHits',
        'downUntil',
        'guardUntil',
        'lastCombat',
        'secondWind',
        'fseq',
        'lastCast',
      ] as const)
        (u as Record<string, unknown>)[k] = old[k];
      u.ready = old.ready.slice();
      u.f = old.f;
    }
    this.units.set(id, u);
    return u;
  }

  /** The opponents of the districts that stand on this map, one per spot. */
  addMobs(enemies: readonly Enemy[]) {
    for (const e of enemies) {
      if (e.district !== this.map) continue;
      e.spots.forEach((spot, i) => {
        const at = cellFeet(this.map, spot.x, spot.y);
        const u = this.blank(`m-${e.id}-${i}`, 'mob', 'mobs', mobFighter(e), at.x, at.y);
        u.enemyId = e.id;
        u.spot = i;
        u.boss = e.boss;
        u.ambush = e.ambush;
        u.lurking = e.ambush;
        this.units.set(u.id, u);
      });
    }
  }

  /** A rival's or a defender's saved fighter, set on one bud only, a few steps in front of it. */
  addShadow(id: string, only: string, fightId: string, fighter: Fighter): Unit | null {
    const bud = this.units.get(only);
    if (!bud) return null;
    const dir = [
      [0, -1],
      [-1, 0],
      [0, 1],
      [1, 0],
    ][bud.f] ?? [0, -1];
    let at = { x: bud.x + dir[0]! * 3, y: bud.y + dir[1]! * 3 };
    if (!positionWalkable(this.map, at.x, at.y))
      at = nearestWalkable(this.map, at.x, at.y) ?? { x: bud.x, y: bud.y };
    const u = this.blank(id, 'shadow', `shadow-${only}`, fighter, at.x, at.y);
    u.only = only;
    u.fightId = fightId;
    u.target = only;
    u.awakeAt = this.now + SPRING_WINDUP_MS;
    u.f = facingOf(bud.x - at.x, bud.y - at.y, 0);
    this.units.set(id, u);
    this.events.push({ k: 'spawn', v: id, x: round2(at.x), y: round2(at.y) });
    return u;
  }

  remove(id: string) {
    const u = this.units.get(id);
    if (!u) return;
    this.units.delete(id);
    // a challenger that left takes its shadow with it
    for (const s of this.units.values())
      if (s.kind === 'shadow' && s.only === id) {
        this.units.delete(s.id);
        this.gone.push({ unit: s, exchanged: s.dmgBy.size > 0 || s.hp < s.maxHp });
        this.events.push({ k: 'gone', v: s.id });
      }
    if (u.kind === 'shadow') this.events.push({ k: 'gone', v: id });
    for (const m of this.units.values()) if (m.target === id) m.target = null;
  }

  /** A bud's position as the game reported it (already checked for walls and speed by the server). */
  moveBud(id: string, x: number, y: number, f: number, moving: boolean, seq: number): boolean {
    const u = this.units.get(id);
    if (!u || u.kind !== 'bud') return false;
    // a report from before a forced move, knocked out, stunned or rooted: the server keeps its own
    if (seq < u.fseq || u.downUntil || u.stunUntil > this.now || u.rootUntil > this.now)
      return false;
    u.x = x;
    u.y = y;
    u.f = f;
    u.m = moving;
    return true;
  }

  // ---------- rules between two ----------

  /** Can `a` hurt `b` right now? */
  hostile(a: Unit, b: Unit): boolean {
    if (a === b || a.downUntil || b.downUntil) return false;
    if (b.lurking || a.lurking) return false;
    if (a.kind === 'shadow' || b.kind === 'shadow') {
      const shadow = a.kind === 'shadow' ? a : b;
      const other = shadow === a ? b : a;
      return other.id === shadow.only;
    }
    if (a.kind === 'mob' && b.kind === 'mob') return false;
    if (a.kind === 'bud' && b.kind === 'bud') {
      if (a.team === b.team) return false;
      if (a.guardUntil > this.now || b.guardUntil > this.now) return false;
      if (a.level < PVP_MIN_LEVEL || b.level < PVP_MIN_LEVEL) return false;
      return !safeAt(this.map, a.x, a.y) && !safeAt(this.map, b.x, b.y);
    }
    // a bud and an opponent of the districts: always, except a bud that just got up
    const bud = a.kind === 'bud' ? a : b;
    const mob = bud === a ? b : a;
    if (mob.returning) return false;
    return bud.guardUntil <= this.now;
  }

  // ---------- casting ----------

  /**
   * A bud presses a button, aiming at (x, y) (world units; for a tap the game aims at the nearest foe, `tid`).
   * Returns null when the cast starts, or why not.
   */
  act(id: string, slot: number, x: number, y: number, tid?: string): string | null {
    const u = this.units.get(id);
    if (!u || u.kind !== 'bud') return 'gone';
    return this.startCast(u, slot, x, y, tid);
  }

  private startCast(u: Unit, slot: number, x: number, y: number, tid?: string): string | null {
    const t = this.now;
    if (u.downUntil) return 'down';
    if (slot < 0 || slot >= KIT_SLOTS || !Number.isFinite(x) || !Number.isFinite(y)) return 'bad';
    const ability = u.kit[slot];
    if (!ability) return 'locked';
    if (u.stunUntil > t) return 'stunned';
    if (u.cast) return 'busy';
    if (u.ready[slot]! > t + 40) return 'cooldown';
    if (t - u.lastCast < GLOBAL_COOLDOWN_MS) return 'cooldown';
    const spec = ABILITIES[ability];
    if (spec.shape === 'dash' && u.rootUntil > t) return 'rooted';
    // a named target: aim at it when it is really there and in reach (the game's auto-aim)
    const target = tid ? this.units.get(tid) : undefined;
    if (target && this.hostile(u, target)) {
      const d = Math.hypot(target.x - u.x, target.y - u.y);
      if (d <= Math.max(spec.range, 1) + RANGE_SLACK + 4) {
        x = target.x;
        y = target.y;
      }
    }
    u.cast = { slot, id: ability, x, y, tid: target?.id };
    u.castAt = t + spec.windup;
    u.lastCast = t;
    u.ready[slot] = t + Math.round(spec.cd * rankCooldown(u.fighter.ranks?.[ability] ?? 0));
    u.f = facingOf(x - u.x, y - u.y, u.f);
    u.dirty = true;
    this.events.push({
      k: 'cast',
      u: u.id,
      a: ability,
      x: round2(x),
      y: round2(y),
      ms: spec.windup,
      s: spec.shape,
      r: spec.land ?? spec.radius ?? 0,
      w: spec.angle ?? spec.width ?? 0,
      n: spec.range,
    });
    if (spec.windup === 0) this.release(u);
    return null;
  }

  private release(u: Unit) {
    const cast = u.cast;
    if (!cast) return;
    u.cast = null;
    const spec = ABILITIES[cast.id];
    let dx = cast.x - u.x;
    let dy = cast.y - u.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) {
      const dir = [
        [0, -1],
        [-1, 0],
        [0, 1],
        [1, 0],
      ][u.f]!;
      dx = dir[0]!;
      dy = dir[1]!;
    } else {
      dx /= len;
      dy /= len;
    }
    const t = this.now;
    switch (spec.shape) {
      case 'shield': {
        u.shield = Math.round((u.maxHp * spec.shield![0]) / 100);
        u.shieldUntil = t + spec.shield![1];
        this.events.push({ k: 'st', v: u.id, a: 'shield', ms: spec.shield![1], n: u.shield });
        if (spec.radius) this.areaNow(u, cast.id, u.x, u.y, spec.radius);
        break;
      }
      case 'buff': {
        if (spec.dodge) {
          u.dodgeUntil = t + spec.dodge;
          this.events.push({ k: 'st', v: u.id, a: 'dodge', ms: spec.dodge });
        }
        if (spec.aim) {
          u.aimHits = spec.aim;
          this.events.push({ k: 'st', v: u.id, a: 'aim', ms: 4000 });
        }
        if (spec.haste) this.haste(u, spec.haste);
        break;
      }
      case 'melee':
      case 'arc': {
        const hits = spec.hits ?? 1;
        this.wedge(u, cast.id, dx, dy, spec, cast.tid);
        for (let i = 1; i < hits; i++)
          this.areas.push({
            owner: u.id,
            ability: cast.id,
            x: dx,
            y: dy,
            r: -1,
            at: t + i * (spec.every ?? 150),
            left: 1,
            every: 0,
            follow: true,
          });
        break;
      }
      case 'proj': {
        const shots = spec.shots ?? 1;
        const spread = ((spec.spread ?? 0) * Math.PI) / 180;
        for (let i = 0; i < shots; i++) {
          const a = shots === 1 ? 0 : (i - (shots - 1) / 2) * spread;
          const sx = dx * Math.cos(a) - dy * Math.sin(a);
          const sy = dx * Math.sin(a) + dy * Math.cos(a);
          const shot: Shot = {
            id: this.shotId++,
            owner: u.id,
            ability: cast.id,
            x: u.x,
            y: u.y + 0.5,
            dx: sx,
            dy: sy,
            speed: spec.speed ?? 12,
            left: spec.range,
            radius: spec.radius ?? 0.45,
          };
          this.shots.push(shot);
          this.events.push({
            k: 'proj',
            u: u.id,
            a: cast.id,
            x: round2(shot.x),
            y: round2(shot.y),
            x2: round2(shot.x + sx * spec.range),
            y2: round2(shot.y + sy * spec.range),
            n: shot.speed,
          });
        }
        break;
      }
      case 'line': {
        const w = (spec.width ?? 1) / 2;
        this.events.push({
          k: 'area',
          u: u.id,
          a: cast.id,
          x: round2(u.x),
          y: round2(u.y),
          x2: round2(u.x + dx * spec.range),
          y2: round2(u.y + dy * spec.range),
          w: spec.width,
          s: 'line',
        });
        for (const v of this.units.values()) {
          if (!this.hostile(u, v)) continue;
          const px = v.x - u.x;
          const py = v.y - u.y;
          const along = px * dx + py * dy;
          const across = Math.abs(px * dy - py * dx);
          if (along >= -0.3 && along <= spec.range + 0.3 && across <= w + 0.35)
            this.hit(u, v, cast.id);
        }
        if (spec.aim) u.aimHits = 0;
        break;
      }
      case 'circle': {
        const d = Math.min(spec.range, Math.hypot(cast.x - u.x, cast.y - u.y));
        const cx = u.x + dx * d;
        const cy = u.y + dy * d;
        this.areaNow(u, cast.id, cx, cy, spec.radius ?? 1.5);
        const pulses = spec.hits ?? 1;
        if (pulses > 1)
          this.areas.push({
            owner: u.id,
            ability: cast.id,
            x: cx,
            y: cy,
            r: spec.radius ?? 1.5,
            at: t + (spec.every ?? 400),
            left: pulses - 1,
            every: spec.every ?? 400,
            follow: false,
          });
        break;
      }
      case 'self': {
        this.areaNow(u, cast.id, u.x, u.y, spec.radius ?? 2);
        const pulses = spec.hits ?? 1;
        if (pulses > 1)
          this.areas.push({
            owner: u.id,
            ability: cast.id,
            x: u.x,
            y: u.y,
            r: spec.radius ?? 2,
            at: t + (spec.every ?? 300),
            left: pulses - 1,
            every: spec.every ?? 300,
            follow: true,
          });
        break;
      }
      case 'dash': {
        // a dash at a target stops just in front of it
        let reach = spec.range;
        if (cast.tid && spec.scale > 0 && !spec.land) {
          const v = this.units.get(cast.tid);
          if (v) reach = Math.min(reach, Math.max(0.5, Math.hypot(v.x - u.x, v.y - u.y) - 0.95));
        } else if (spec.land) reach = Math.min(reach, Math.hypot(cast.x - u.x, cast.y - u.y));
        const from = { x: u.x, y: u.y };
        const to = this.walkLine(u.x, u.y, dx, dy, reach);
        const ms = Math.round(90 + 45 * Math.hypot(to.x - from.x, to.y - from.y));
        this.forceMove(u, to.x, to.y);
        this.events.push({
          k: 'dash',
          u: u.id,
          a: cast.id,
          x: round2(from.x),
          y: round2(from.y),
          x2: round2(to.x),
          y2: round2(to.y),
          ms,
          q: u.fseq,
        });
        if (spec.dodge) {
          u.dodgeUntil = t + spec.dodge;
          this.events.push({ k: 'st', v: u.id, a: 'dodge', ms: spec.dodge });
        }
        if (spec.haste) this.haste(u, spec.haste);
        if (spec.scale > 0 && spec.radius) {
          const len2 = Math.hypot(to.x - from.x, to.y - from.y);
          const hit = new Set<string>();
          for (const v of this.units.values()) {
            if (!this.hostile(u, v)) continue;
            const px = v.x - from.x;
            const py = v.y - from.y;
            const along = Math.max(0, Math.min(len2, px * dx + py * dy));
            const ex = from.x + dx * along - v.x;
            const ey = from.y + dy * along - v.y;
            if (Math.hypot(ex, ey) <= spec.radius + 0.3) {
              hit.add(v.id);
              if (!spec.land) this.hit(u, v, cast.id);
            }
          }
          if (spec.land) this.areaNow(u, cast.id, to.x, to.y, spec.land);
        }
        break;
      }
    }
  }

  private haste(u: Unit, [pct, ms]: [number, number]) {
    u.hastePct = pct;
    u.hasteUntil = this.now + ms;
    this.events.push({ k: 'st', v: u.id, a: 'haste', ms });
  }

  /** Everyone in front of the caster within the wedge; a melee blow picks the one it aimed at, or the closest. */
  private wedge(
    u: Unit,
    ability: AbilityId,
    dx: number,
    dy: number,
    spec: AbilitySpec,
    tid?: string,
  ) {
    const half = (((spec.angle ?? 90) / 2) * Math.PI) / 180;
    const inside: { v: Unit; d: number }[] = [];
    for (const v of this.units.values()) {
      if (!this.hostile(u, v)) continue;
      const px = v.x - u.x;
      const py = v.y - u.y;
      const d = Math.hypot(px, py);
      if (d > spec.range + 0.35) continue;
      // standing right on top of each other counts as in front
      const a = d < 0.35 ? 0 : Math.acos(Math.max(-1, Math.min(1, (px * dx + py * dy) / d)));
      if (a <= half + 0.12) inside.push({ v, d });
    }
    this.events.push({
      k: 'area',
      u: u.id,
      a: ability,
      x: round2(u.x),
      y: round2(u.y),
      x2: round2(u.x + dx * spec.range),
      y2: round2(u.y + dy * spec.range),
      w: spec.angle,
      s: 'wedge',
    });
    if (spec.shape === 'melee') {
      inside.sort((p, q) => (p.v.id === tid ? -1 : q.v.id === tid ? 1 : p.d - q.d));
      if (inside[0]) this.hit(u, inside[0].v, ability);
      return;
    }
    for (const { v } of inside) this.hit(u, v, ability);
  }

  /** An area that hits now. */
  private areaNow(u: Unit, ability: AbilityId, x: number, y: number, r: number) {
    this.events.push({
      k: 'area',
      u: u.id,
      a: ability,
      x: round2(x),
      y: round2(y),
      r,
      s: 'circle',
    });
    for (const v of this.units.values())
      if (this.hostile(u, v) && Math.hypot(v.x - x, v.y - y) <= r + 0.3) this.hit(u, v, ability);
  }

  /** As far as a straight line goes before a wall (tiles), in small steps. */
  private walkLine(x: number, y: number, dx: number, dy: number, reach: number) {
    let at = { x, y };
    for (let s = 0.25; s <= reach + 1e-6; s += 0.25) {
      const nx = x + dx * s;
      const ny = y + dy * s;
      if (!positionWalkable(this.map, nx, ny)) break;
      at = { x: nx, y: ny };
    }
    return at;
  }

  private forceMove(u: Unit, x: number, y: number) {
    u.x = round2(x);
    u.y = round2(y);
    u.fseq++;
    u.dirty = true;
    if (u.kind !== 'bud') u.path = [];
  }

  // ---------- blows ----------

  private hit(a: Unit, v: Unit, ability: AbilityId) {
    const spec = ABILITIES[ability];
    const t = this.now;
    a.lastCombat = t;
    v.lastCombat = t;
    if (v.kind === 'mob' && a.kind === 'bud' && !v.target) {
      v.target = a.id;
      this.events.push({ k: 'aggro', u: v.id, v: a.id });
    }
    if (v.dodgeUntil > t) {
      this.events.push({
        k: 'hit',
        u: a.id,
        v: v.id,
        a: ability,
        n: 0,
        e: true,
        h: v.hp,
        mh: v.maxHp,
      });
      return;
    }
    let dealt = 0;
    let crit = false;
    if (spec.scale > 0) {
      const miss = evadeChance(v.fighter) + (a.blindUntil > t ? 25 : 0);
      if (this.rng.chance(miss)) {
        this.events.push({
          k: 'hit',
          u: a.id,
          v: v.id,
          a: ability,
          n: 0,
          e: true,
          h: v.hp,
          mh: v.maxHp,
        });
        return;
      }
      const [lo, hi] = abilityPower(ability);
      crit =
        a.aimHits > 0 ||
        this.rng.chance(critChance({ ...a.fighter, status: { ...a.fighter.status, aim: false } }));
      if (a.aimHits > 0 && spec.shape !== 'line') a.aimHits--;
      const attacker = {
        ...a.fighter,
        status: { ...a.fighter.status, weaken: a.weakUntil > t ? 1 : 0 },
      };
      let d = damage(this.rng.int(lo, hi), attacker, v.fighter, crit, false);
      const vs = a.kind === 'mob' ? MOB_DAMAGE : v.kind === 'mob' ? 100 : PVP_DAMAGE;
      // an upgraded move (loadout.ts) hits harder
      const up = rankDamage(a.fighter.ranks?.[ability] ?? 0);
      d = Math.max(1, Math.round((d * spec.scale * vs * up) / 1_000_000));
      if (v.shield > 0 && v.shieldUntil > t) {
        const absorbed = Math.min(v.shield, d);
        v.shield -= absorbed;
        d -= absorbed;
        if (v.shield <= 0) this.events.push({ k: 'st', v: v.id, a: 'unshield' });
      }
      dealt = d;
      v.hp = Math.max(0, v.hp - d);
      v.dirty = true;
      if (a.kind === 'bud' || a.kind === 'shadow')
        v.dmgBy.set(a.id, (v.dmgBy.get(a.id) ?? 0) + Math.max(1, d));
    }
    this.events.push({
      k: 'hit',
      u: a.id,
      v: v.id,
      a: ability,
      n: dealt,
      c: crit,
      h: v.hp,
      mh: v.maxHp,
    });
    // Drugi oddech: once a life, dropping below a quarter gives a third back
    if (
      v.hp > 0 &&
      v.hp * 4 < v.maxHp &&
      !v.secondWind &&
      v.fighter.perks.includes('drugi-oddech')
    ) {
      v.secondWind = true;
      const back = Math.floor(v.maxHp / 3);
      v.hp = Math.min(v.maxHp, v.hp + back);
      this.events.push({ k: 'heal', v: v.id, a: 'drugi-oddech', n: back, h: v.hp, mh: v.maxHp });
    }
    if (v.hp <= 0) {
      this.knockOut(v, a);
      return;
    }
    // what sticks after the blow (longer for an upgraded move)
    const hold = (ms: number) => Math.round(ms * rankHold(a.fighter.ranks?.[ability] ?? 0));
    if (spec.stun) this.status(v, 'stun', hold(spec.stun));
    if (spec.root) this.status(v, 'root', hold(spec.root));
    if (spec.slow) {
      v.slowPct = spec.slow[0];
      this.status(v, 'slow', hold(spec.slow[1]));
    }
    if (spec.blind) this.status(v, 'blind', hold(spec.blind));
    if (spec.weaken) this.status(v, 'weak', hold(spec.weaken));
    if (spec.knock && !v.boss) {
      let kx = v.x - a.x;
      let ky = v.y - a.y;
      const l = Math.hypot(kx, ky) || 1;
      kx /= l;
      ky /= l;
      const to = this.walkLine(v.x, v.y, kx, ky, spec.knock);
      const from = { x: v.x, y: v.y };
      this.forceMove(v, to.x, to.y);
      this.events.push({
        k: 'knock',
        v: v.id,
        x: round2(from.x),
        y: round2(from.y),
        x2: round2(to.x),
        y2: round2(to.y),
        ms: 220,
        q: v.fseq,
      });
    }
  }

  private status(v: Unit, kind: 'stun' | 'root' | 'slow' | 'blind' | 'weak', ms: number) {
    const t = this.now;
    // bosses shrug off half of any hold
    const held = v.boss && (kind === 'stun' || kind === 'root') ? Math.round(ms / 2) : ms;
    if (kind === 'stun') {
      v.stunUntil = Math.max(v.stunUntil, t + held);
      v.cast = null;
    }
    if (kind === 'root') v.rootUntil = Math.max(v.rootUntil, t + held);
    if (kind === 'slow') v.slowUntil = Math.max(v.slowUntil, t + held);
    if (kind === 'blind') v.blindUntil = Math.max(v.blindUntil, t + held);
    if (kind === 'weak') v.weakUntil = Math.max(v.weakUntil, t + held);
    this.events.push({ k: 'st', v: v.id, a: kind, ms: held });
  }

  private knockOut(v: Unit, by: Unit) {
    const t = this.now;
    v.hp = 0;
    v.cast = null;
    v.shield = 0;
    v.dirty = true;
    this.events.push({ k: 'ko', v: v.id, u: by.id, x: round2(v.x), y: round2(v.y) });
    if (v.kind === 'bud') {
      v.downUntil = t + KO_MS;
      this.downs.push({ unit: v, by });
      for (const m of this.units.values()) if (m.target === v.id) m.target = null;
      return;
    }
    if (v.kind === 'shadow') {
      this.units.delete(v.id);
      this.kills.push({ unit: v, by: [by.id] });
      return;
    }
    const by2 = [...v.dmgBy.keys()].filter((id) => this.units.get(id)?.kind === 'bud');
    this.kills.push({ unit: v, by: by2 });
    v.downUntil = t + MOB_RESPAWN_MS;
    v.target = null;
    v.dmgBy.clear();
  }

  // ---------- the tick ----------

  step(now: number): StepResult {
    this.now = now;
    const dt = Math.min(0.25, Math.max(0, (now - this.last) / 1000));
    this.last = now;

    for (const u of [...this.units.values()]) {
      if (!this.units.has(u.id)) continue;
      // getting up
      if (u.downUntil && now >= u.downUntil) this.standUp(u);
      if (u.downUntil) continue;
      if (u.shield > 0 && u.shieldUntil <= now) {
        u.shield = 0;
        this.events.push({ k: 'st', v: u.id, a: 'unshield' });
      }
      if (u.cast && now >= u.castAt) this.release(u);
      // health comes back away from blows
      if (u.hp < u.maxHp && now - u.lastCombat > OUT_OF_COMBAT_MS && !u.target) {
        const before = u.hp;
        u.hp = Math.min(u.maxHp, u.hp + Math.max(1, Math.round(u.maxHp * REGEN_PER_SECOND * dt)));
        if (Math.floor(before / 4) !== Math.floor(u.hp / 4) || u.hp === u.maxHp) u.dirty = true;
      }
      if (u.kind !== 'bud') this.think(u, dt);
    }

    // follow-up blows and pulses
    for (const area of [...this.areas]) {
      if (now < area.at) continue;
      const u = this.units.get(area.owner);
      if (!u || u.downUntil || u.stunUntil > now) {
        this.areas.splice(this.areas.indexOf(area), 1);
        continue;
      }
      if (area.r < 0) {
        // a repeated melee blow: same wedge, the caster's direction then
        const spec = ABILITIES[area.ability];
        this.wedge(u, area.ability, area.x, area.y, spec);
      } else {
        const x = area.follow ? u.x : area.x;
        const y = area.follow ? u.y : area.y;
        this.areaNow(u, area.ability, x, y, area.r);
      }
      area.left--;
      area.at += area.every;
      if (area.left <= 0) this.areas.splice(this.areas.indexOf(area), 1);
    }

    // shots in flight
    for (const shot of [...this.shots]) {
      const owner = this.units.get(shot.owner);
      const travel = Math.min(shot.left, shot.speed * dt);
      let done = !owner;
      const steps = Math.max(1, Math.ceil(travel / 0.3));
      for (let i = 0; i < steps && !done; i++) {
        shot.x += (shot.dx * travel) / steps;
        shot.y += (shot.dy * travel) / steps;
        shot.left -= travel / steps;
        if (!positionWalkable(this.map, shot.x, shot.y - 0.5)) {
          done = true;
          break;
        }
        for (const v of this.units.values()) {
          if (!owner || !this.hostile(owner, v)) continue;
          if (Math.hypot(v.x - shot.x, v.y + 0.5 - shot.y) <= shot.radius + 0.35) {
            this.hit(owner, v, shot.ability);
            done = true;
            break;
          }
        }
      }
      if (done || shot.left <= 0.01) this.shots.splice(this.shots.indexOf(shot), 1);
    }

    const out = { events: this.events, kills: this.kills, downs: this.downs, gone: this.gone };
    this.events = [];
    this.kills = [];
    this.downs = [];
    this.gone = [];
    return out;
  }

  private standUp(u: Unit) {
    const now = this.now;
    u.downUntil = 0;
    u.hp = u.maxHp;
    u.shield = 0;
    u.stunUntil = u.rootUntil = u.slowUntil = u.blindUntil = u.weakUntil = 0;
    u.secondWind = false;
    u.aimHits = 0;
    u.dmgBy.clear();
    u.target = null;
    u.returning = false;
    u.ready.fill(0);
    if (u.kind === 'bud') {
      const at = respawnPoint(this.map, u.x, u.y);
      this.forceMove(u, at.x, at.y);
      u.guardUntil = now + SPAWN_GUARD_MS;
      this.events.push({
        k: 'rsp',
        v: u.id,
        x: round2(u.x),
        y: round2(u.y),
        q: u.fseq,
        h: u.hp,
        mh: u.maxHp,
      });
    } else {
      this.forceMove(u, u.home.x, u.home.y);
      u.lurking = !!u.ambush;
      u.lurkReadyAt = now;
      this.events.push({
        k: 'rsp',
        v: u.id,
        x: round2(u.x),
        y: round2(u.y),
        q: u.fseq,
        h: u.hp,
        mh: u.maxHp,
      });
    }
  }

  // ---------- opponents' minds ----------

  private think(u: Unit, dt: number) {
    const now = this.now;
    if (u.stunUntil > now || u.cast) return;

    // a lurker waits in its nook until a bud comes close
    if (u.lurking) {
      if (now < u.lurkReadyAt) return;
      for (const b of this.units.values()) {
        if (b.kind !== 'bud' || b.downUntil || b.guardUntil > now) continue;
        if (Math.hypot(b.x - u.x, b.y - u.y) <= SPRING_RADIUS) {
          u.lurking = false;
          u.target = b.id;
          u.awakeAt = now + SPRING_WINDUP_MS;
          u.f = facingOf(b.x - u.x, b.y - u.y, u.f);
          u.dirty = true;
          this.events.push({ k: 'aggro', u: u.id, v: b.id, a: 'spring' });
          return;
        }
      }
      return;
    }
    if (now < u.awakeAt) return;

    let target = u.target ? this.units.get(u.target) : undefined;
    if (target && !this.hostile(u, target)) target = undefined;
    const fromHome = Math.hypot(u.x - u.home.x, u.y - u.home.y);

    if (u.kind === 'shadow') {
      const bud = this.units.get(u.only!);
      if (!bud || Math.hypot(bud.x - u.x, bud.y - u.y) > SHADOW_GIVE_UP) {
        this.units.delete(u.id);
        this.gone.push({ unit: u, exchanged: u.dmgBy.size > 0 || u.hp < u.maxHp });
        this.events.push({ k: 'gone', v: u.id });
        return;
      }
      if (!bud.downUntil) target = bud;
    } else if (!target || fromHome > LEASH) {
      // the next one who hurt it, or back home
      if (!u.returning && (fromHome > LEASH || (u.target && !target))) {
        let next: Unit | undefined;
        if (fromHome <= LEASH)
          for (const [id] of [...u.dmgBy.entries()].sort((p, q) => q[1] - p[1])) {
            const c = this.units.get(id);
            if (c && this.hostile(u, c) && Math.hypot(c.x - u.home.x, c.y - u.home.y) <= LEASH) {
              next = c;
              break;
            }
          }
        if (next) {
          u.target = next.id;
          target = next;
        } else if (u.target || fromHome > 0.6) {
          u.target = null;
          u.returning = true;
          u.dmgBy.clear();
          this.events.push({ k: 'calm', u: u.id });
        }
      }
    }

    if (u.returning || !target) {
      if (fromHome > 0.15) this.walkTo(u, u.home.x, u.home.y, dt, 1.25);
      else {
        if (u.m) {
          u.m = false;
          u.dirty = true;
        }
        if (u.returning) {
          u.returning = false;
          u.hp = u.maxHp;
          u.dirty = true;
          this.events.push({ k: 'heal', v: u.id, n: 0, h: u.hp, mh: u.maxHp });
          if (u.ambush) {
            u.lurking = true;
            u.lurkReadyAt = now + LURK_COOLDOWN_MS;
          }
        }
      }
      return;
    }

    // pick a blow: an ability now and then when it is ready and reaches, else the basic attack
    const d = Math.hypot(target.x - u.x, target.y - u.y);
    const options: number[] = [];
    for (let s = 1; s < KIT_SLOTS; s++) {
      const a = u.kit[s];
      if (!a || u.ready[s]! > now) continue;
      const spec = ABILITIES[a];
      if (spec.shape === 'shield') {
        if (u.hp * 100 < u.maxHp * 45) options.push(s);
        continue;
      }
      if (spec.shape === 'buff') {
        if (d < 6) options.push(s);
        continue;
      }
      if (spec.scale === 0) continue;
      const reach =
        spec.shape === 'self' ? (spec.radius ?? 2) * 0.8 : Math.max(1.2, spec.range * 0.9);
      if (d <= reach) options.push(s);
    }
    const basicSpec = ABILITIES[u.kit[0]!];
    const basicReach = Math.max(1.15, basicSpec.range * 0.92);
    // an opponent thinks a bit between blows: slower than a bud's fingers
    const pace = u.kind === 'shadow' ? 1.2 : u.boss ? 1.2 : 1.3;
    if (
      now - u.lastCast >= basicSpec.cd * 0.6 &&
      options.length &&
      this.rng.chance(u.kind === 'shadow' ? 9 : 5)
    ) {
      const slot = options[this.rng.int(0, options.length - 1)]!;
      this.mobCast(u, slot, target);
      return;
    }
    if (d <= basicReach) {
      if (u.m) {
        u.m = false;
        u.dirty = true;
      }
      const f = facingOf(target.x - u.x, target.y - u.y, u.f);
      if (f !== u.f) {
        u.f = f;
        u.dirty = true;
      }
      if (now - u.lastCast >= basicSpec.cd * pace && u.ready[0]! <= now) this.mobCast(u, 0, target);
      return;
    }
    if (u.rootUntil > now) return;
    this.walkTo(u, target.x, target.y, dt, 1, target.id);
  }

  private mobCast(u: Unit, slot: number, target: Unit) {
    // cooldowns of opponents run longer, like their thinking
    const err = this.startCast(u, slot, target.x, target.y, target.id);
    if (!err && slot > 0) u.ready[slot] = this.now + ABILITIES[u.kit[slot]!].cd * 1.5;
  }

  private walkTo(u: Unit, x: number, y: number, dt: number, boost: number, goalId = 'home') {
    const now = this.now;
    let speed = mobSpeed(u.fighter) * boost;
    if (u.slowUntil > now) speed *= 1 - u.slowPct / 100;
    if (u.hasteUntil > now) speed *= 1 + u.hastePct / 100;
    let gx = x;
    let gy = y;
    const direct = Math.hypot(x - u.x, y - u.y);
    // a path around walls when the straight line is blocked, worked out at most twice a second
    if (direct > 1.2 && !this.clearLine(u.x, u.y, x, y)) {
      if (now - u.pathAt > 500 || u.pathGoal !== goalId || u.path.length === 0) {
        u.path = findPath(this.map, u.x, u.y, x, y);
        u.pathAt = now;
        u.pathGoal = goalId;
      }
      while (u.path.length && Math.hypot(u.path[0]!.x - u.x, u.path[0]!.y - u.y) < 0.3)
        u.path.shift();
      if (u.path[0]) {
        gx = u.path[0].x;
        gy = u.path[0].y;
      }
    } else u.path = [];
    let dx = gx - u.x;
    let dy = gy - u.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) return;
    dx /= len;
    dy /= len;
    const stepLen = Math.min(len, speed * dt);
    const nx = u.x + dx * stepLen;
    const ny = u.y + dy * stepLen;
    if (positionWalkable(this.map, nx, ny)) {
      u.x = nx;
      u.y = ny;
    } else if (positionWalkable(this.map, nx, u.y)) u.x = nx;
    else if (positionWalkable(this.map, u.x, ny)) u.y = ny;
    u.f = facingOf(dx, dy, u.f);
    u.m = true;
    u.dirty = true;
  }

  private clearLine(x0: number, y0: number, x1: number, y1: number) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let s = 0.4; s < len; s += 0.4)
      if (!positionWalkable(this.map, x0 + ((x1 - x0) * s) / len, y0 + ((y1 - y0) * s) / len))
        return false;
    return true;
  }

  // ---------- what the room sees ----------

  /** Units that changed since the last call (their flag is cleared). */
  takeDirty(): Unit[] {
    const out: Unit[] = [];
    for (const u of this.units.values())
      if (u.dirty) {
        u.dirty = false;
        out.push(u);
      }
    return out;
  }

  /** Is anyone fighting here (anything to step for)? */
  get busy(): boolean {
    if (this.shots.length || this.areas.length) return true;
    for (const u of this.units.values())
      if (
        u.cast ||
        u.target ||
        u.downUntil ||
        u.returning ||
        u.hp < u.maxHp ||
        u.m ||
        (u.lurking && u.kind === 'mob')
      )
        return true;
    return false;
  }
}

/** An opponent of the districts as a fighter (combat.ts enemyFighter, with its weapon's moves and its ultimate). */
function mobFighter(e: Enemy): Fighter {
  const moves = (
    {
      piesci: ['prosty', 'sierpowy', 'kopniak', 'garda'],
      kij: ['pchniecie', 'zamach', 'mlyniec', 'garda'],
      procarka: ['strzal', 'seria', 'celowanie', 'garda'],
      spray: ['psik', 'chmura', 'prosty', 'garda'],
      mikrofon: ['diss', 'bit', 'drop', 'garda'],
      deska: ['deska', 'kickflip', 'slizg', 'garda'],
    } as const satisfies Record<WeaponKind, readonly MoveId[]>
  )[e.weapon];
  return {
    name: e.name,
    // only bosses get the ultimate
    level: e.boss ? Math.max(e.level, ULT_LEVEL) : Math.min(e.level, ULT_LEVEL - 1),
    maxHp: e.hp,
    hp: e.hp,
    attack: e.attack,
    armor: e.armor,
    speed: e.speed,
    luck: e.luck,
    walka: Math.floor(e.level / 3),
    przetrwanie: Math.floor(e.level / 4),
    spryt: Math.floor(e.level / 5),
    weapon: e.weapon,
    weaponItem: null,
    moves: [...moves],
    perks: [],
    kit: null,
    ranks: {},
    status: { blind: 0, weaken: 0, aim: false, secondWind: false },
  };
}

/**
 * A* over the walk grid between two world positions (4 ways, at most a few hundred cells looked at): the cells'
 * feet to walk through, or nothing when there is no way close by.
 */
export function findPath(
  map: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  budget = 900,
): { x: number; y: number }[] {
  const g = walkGrid(map);
  if (!g) return [];
  const [sx, sy] = liveCell(x0, y0, g.h);
  const [tx, ty] = liveCell(x1, y1, g.h);
  const key = (cx: number, cy: number) => cy * g.w + cx;
  const start = key(sx, sy);
  const goal = key(tx, ty);
  const open: { k: number; f: number }[] = [{ k: start, f: 0 }];
  const cost = new Map<number, number>([[start, 0]]);
  const from = new Map<number, number>();
  let best = start;
  let bestH = Math.abs(tx - sx) + Math.abs(ty - sy);
  let looked = 0;
  while (open.length && looked < budget) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i]!.f < open[bi]!.f) bi = i;
    const { k } = open.splice(bi, 1)[0]!;
    looked++;
    if (k === goal) {
      best = k;
      break;
    }
    const cx = k % g.w;
    const cy = Math.floor(k / g.w);
    for (const [ddx, ddy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cx + ddx;
      const ny = cy + ddy;
      const nk = key(nx, ny);
      if (nk !== goal && !cellWalkable(map, nx, ny)) continue;
      const c = cost.get(k)! + 1;
      if (c >= (cost.get(nk) ?? Infinity)) continue;
      cost.set(nk, c);
      from.set(nk, k);
      const h = Math.abs(tx - nx) + Math.abs(ty - ny);
      if (h < bestH) {
        bestH = h;
        best = nk;
      }
      open.push({ k: nk, f: c + h });
    }
  }
  const cells: number[] = [];
  for (let k: number | undefined = best; k !== undefined && k !== start; k = from.get(k))
    cells.push(k);
  cells.reverse();
  return cells.map((k) => ({ x: (k % g.w) + 0.5, y: g.h - 1 - Math.floor(k / g.w) + 0.2 }));
}
