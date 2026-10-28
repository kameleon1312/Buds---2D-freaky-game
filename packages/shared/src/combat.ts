import { z } from 'zod';
import { influenceSchema, pvpResultSchema, raidResultSchema } from './influence';
import { budLookSchema } from './bud/look';
import { levelOf, type CatalogItem, type Rarity } from './catalog';
import { coinsWithLuck, weaponKindSchema, type CharacterStats, type WeaponKind } from './gear';
import { levelFromXp } from './level';
import { buffBonus, type BuffId } from './consumables';
import type { PerkId, SkillId } from './skills';

/**
 * Duels (pojedynki): turn-based fights against the people of the districts, resolved on the server one turn at a
 * time (`POST /v1/fights/:id/move`), so XP, coins and loot can't be faked. The game only shows the events.
 *
 * The bud's moves come from its weapon (the "W ręku" slot; none = fists) and every move has an animation tag the
 * game plays (a jab is a quick punch, a swing a wide bat arc, a shot a flying stone…). Stats from gear count:
 * Atak hits harder, Pancerz takes damage off, Szybkość acts first and dodges, Szczęście lands critical hits;
 * the skills Walka (damage), Instynkt przetrwania (dodge) and Spryt (critical hits) too.
 * Everything is integer maths with a seeded RNG kept in the fight state: a state plus a move gives one result.
 */

export const MOVE_ANIMS = [
  'jab',
  'hook',
  'kick',
  'guard',
  'thrust',
  'swing',
  'spin',
  'shoot',
  'spray',
  'shout',
  'flip',
  'dodge',
  'aim',
] as const;
export type MoveAnim = (typeof MOVE_ANIMS)[number];

export type MoveEffect = 'guard' | 'dodge' | 'aim' | 'blind' | 'weaken';

export type Move = {
  id: string;
  name: string;
  /** Damage per hit (before stats); [0, 0] = no damage (effect only). */
  power: [number, number];
  accuracy: number;
  hits?: number;
  effect?: MoveEffect;
  anim: MoveAnim;
  description: string;
};

const m = (move: Move) => move;

export const MOVES = {
  garda: m({
    id: 'garda',
    name: 'Garda',
    power: [0, 0],
    accuracy: 100,
    effect: 'guard',
    anim: 'guard',
    description: 'Zasłaniasz się: połowa obrażeń w tej turze.',
  }),
  // fists
  prosty: m({
    id: 'prosty',
    name: 'Prosty',
    power: [5, 7],
    accuracy: 95,
    anim: 'jab',
    description: 'Szybki, pewny cios.',
  }),
  sierpowy: m({
    id: 'sierpowy',
    name: 'Sierpowy',
    power: [8, 11],
    accuracy: 82,
    anim: 'hook',
    description: 'Mocny cios z boku.',
  }),
  kopniak: m({
    id: 'kopniak',
    name: 'Kopniak',
    power: [10, 14],
    accuracy: 72,
    anim: 'kick',
    description: 'Z obrotu. Boli, jeśli trafi.',
  }),
  // bats, sticks, canes
  pchniecie: m({
    id: 'pchniecie',
    name: 'Pchnięcie',
    power: [6, 9],
    accuracy: 92,
    anim: 'thrust',
    description: 'Krótko, prosto, końcem kija.',
  }),
  zamach: m({
    id: 'zamach',
    name: 'Zamach',
    power: [10, 14],
    accuracy: 80,
    anim: 'swing',
    description: 'Szeroki zamach z całej siły.',
  }),
  mlyniec: m({
    id: 'mlyniec',
    name: 'Młyniec',
    power: [13, 18],
    accuracy: 65,
    anim: 'spin',
    description: 'Obrót z kijem. Ryzykowny.',
  }),
  // slingshots, bows
  strzal: m({
    id: 'strzal',
    name: 'Strzał',
    power: [7, 10],
    accuracy: 90,
    anim: 'shoot',
    description: 'Kamyk prosto w cel.',
  }),
  seria: m({
    id: 'seria',
    name: 'Seria',
    power: [4, 6],
    accuracy: 80,
    hits: 2,
    anim: 'shoot',
    description: 'Dwa szybkie strzały.',
  }),
  celowanie: m({
    id: 'celowanie',
    name: 'Celowanie',
    power: [0, 0],
    accuracy: 100,
    effect: 'aim',
    anim: 'aim',
    description: 'Następny cios na pewno krytyczny.',
  }),
  // spray cans
  psik: m({
    id: 'psik',
    name: 'Psik w oczy',
    power: [3, 5],
    accuracy: 95,
    effect: 'blind',
    anim: 'spray',
    description: 'Rywal gorzej trafia przez 2 tury.',
  }),
  chmura: m({
    id: 'chmura',
    name: 'Chmura',
    power: [7, 10],
    accuracy: 85,
    anim: 'spray',
    description: 'Gęsta chmura farby.',
  }),
  // microphones, megaphones, boomboxes
  diss: m({
    id: 'diss',
    name: 'Diss',
    power: [2, 4],
    accuracy: 95,
    effect: 'weaken',
    anim: 'shout',
    description: 'Rywal słabiej bije przez 2 tury.',
  }),
  bit: m({
    id: 'bit',
    name: 'Bit',
    power: [8, 11],
    accuracy: 85,
    anim: 'shout',
    description: 'Fala basu prosto w twarz.',
  }),
  drop: m({
    id: 'drop',
    name: 'Drop',
    power: [12, 16],
    accuracy: 70,
    anim: 'shout',
    description: 'Bas, który powala.',
  }),
  // boards
  deska: m({
    id: 'deska',
    name: 'Uderzenie deską',
    power: [8, 11],
    accuracy: 88,
    anim: 'swing',
    description: 'Płasko, z rozmachem.',
  }),
  kickflip: m({
    id: 'kickflip',
    name: 'Kickflip',
    power: [12, 16],
    accuracy: 72,
    anim: 'flip',
    description: 'Deska w powietrzu, rywal na ziemi.',
  }),
  slizg: m({
    id: 'slizg',
    name: 'Ślizg',
    power: [0, 0],
    accuracy: 100,
    effect: 'dodge',
    anim: 'dodge',
    description: 'Łatwiej uniknąć ciosu w tej turze.',
  }),
  // special moves unlocked by skill perks (rank 5 Flow, rank 5 Graffiti, rank 3 Walka)
  freestyle: m({
    id: 'freestyle',
    name: 'Freestyle',
    power: [5, 8],
    accuracy: 88,
    hits: 2,
    effect: 'weaken',
    anim: 'shout',
    description: 'Dwie zwrotki prosto w ego rywala. Osłabia.',
  }),
  tag: m({
    id: 'tag',
    name: 'Tag',
    power: [6, 9],
    accuracy: 92,
    effect: 'blind',
    anim: 'spray',
    description: 'Podpis na twarzy rywala. Oślepia.',
  }),
  specjalny: m({
    id: 'specjalny',
    name: 'Cios specjalny',
    power: [12, 18],
    accuracy: 76,
    anim: 'spin',
    description: 'Obrót i cios z całej siły.',
  }),
  // ---------- learned moves: stronger versions of the weapon's moves (MOVE_UPGRADES) ----------
  kontra: m({
    id: 'kontra',
    name: 'Kontra',
    power: [4, 6],
    accuracy: 90,
    effect: 'guard',
    anim: 'guard',
    description: 'Zasłaniasz się i oddajesz: połowa obrażeń i cios w odpowiedzi.',
  }),
  'seria-ciosow': m({
    id: 'seria-ciosow',
    name: 'Seria ciosów',
    power: [4, 6],
    accuracy: 93,
    hits: 2,
    anim: 'jab',
    description: 'Dwa proste jeden po drugim.',
  }),
  bomba: m({
    id: 'bomba',
    name: 'Bomba',
    power: [11, 15],
    accuracy: 82,
    anim: 'hook',
    description: 'Sierpowy z całego ciała.',
  }),
  'z-polobrotu': m({
    id: 'z-polobrotu',
    name: 'Z półobrotu',
    power: [12, 17],
    accuracy: 74,
    effect: 'weaken',
    anim: 'kick',
    description: 'Kopniak z obrotu. Rywal słabiej bije przez 2 tury.',
  }),
  'szybkie-pchniecie': m({
    id: 'szybkie-pchniecie',
    name: 'Szybkie pchnięcie',
    power: [4, 6],
    accuracy: 91,
    hits: 2,
    anim: 'thrust',
    description: 'Dwa krótkie pchnięcia końcem kija.',
  }),
  'z-gory': m({
    id: 'z-gory',
    name: 'Cios z góry',
    power: [13, 18],
    accuracy: 79,
    anim: 'swing',
    description: 'Kij spada z góry. Trudno się zasłonić.',
  }),
  huragan: m({
    id: 'huragan',
    name: 'Huragan',
    power: [9, 12],
    accuracy: 67,
    hits: 2,
    anim: 'spin',
    description: 'Dwa obroty z kijem.',
  }),
  'precyzyjny-strzal': m({
    id: 'precyzyjny-strzal',
    name: 'Precyzyjny strzał',
    power: [9, 12],
    accuracy: 94,
    anim: 'shoot',
    description: 'Kamyk tam, gdzie boli.',
  }),
  grad: m({
    id: 'grad',
    name: 'Grad kamieni',
    power: [4, 6],
    accuracy: 80,
    hits: 3,
    anim: 'shoot',
    description: 'Trzy strzały, zanim rywal mrugnie.',
  }),
  snajper: m({
    id: 'snajper',
    name: 'Oko snajpera',
    power: [5, 7],
    accuracy: 100,
    effect: 'aim',
    anim: 'aim',
    description: 'Strzał na pewno, a następny cios na pewno krytyczny.',
  }),
  'psik-z-bliska': m({
    id: 'psik-z-bliska',
    name: 'Psik z bliska',
    power: [5, 7],
    accuracy: 95,
    effect: 'blind',
    anim: 'spray',
    description: 'Prosto w oczy. Rywal gorzej trafia przez 2 tury.',
  }),
  'burza-farby': m({
    id: 'burza-farby',
    name: 'Burza farby',
    power: [10, 13],
    accuracy: 86,
    anim: 'spray',
    description: 'Cała puszka naraz.',
  }),
  roast: m({
    id: 'roast',
    name: 'Roast',
    power: [4, 6],
    accuracy: 95,
    effect: 'weaken',
    anim: 'shout',
    description: 'Rywal słabiej bije przez 2 tury.',
  }),
  'basowy-bit': m({
    id: 'basowy-bit',
    name: 'Basowy bit',
    power: [10, 13],
    accuracy: 86,
    anim: 'shout',
    description: 'Bas, aż drżą szyby.',
  }),
  'mega-drop': m({
    id: 'mega-drop',
    name: 'Mega drop',
    power: [15, 20],
    accuracy: 71,
    anim: 'shout',
    description: 'Drop, po którym nikt nie stoi.',
  }),
  ollie: m({
    id: 'ollie',
    name: 'Ollie w twarz',
    power: [10, 13],
    accuracy: 88,
    anim: 'flip',
    description: 'Deska wyskakuje prosto w rywala.',
  }),
  'flip-360': m({
    id: 'flip-360',
    name: '360 flip',
    power: [14, 19],
    accuracy: 73,
    anim: 'flip',
    description: 'Pełny obrót deski.',
  }),
  grind: m({
    id: 'grind',
    name: 'Grind',
    power: [4, 6],
    accuracy: 90,
    effect: 'dodge',
    anim: 'dodge',
    description: 'Ślizgiem obok ciosu, deską po kostkach.',
  }),
} satisfies Record<string, Move>;
export type MoveId = keyof typeof MOVES;
export const moveIdSchema = z.enum(Object.keys(MOVES) as [MoveId, ...MoveId[]]);

/** Moves a perk adds on top of the weapon's four. */
export const PERK_MOVES: Partial<Record<PerkId, MoveId>> = {
  'freestyle-mistrza': 'freestyle',
  'tag-legendy': 'tag',
  'cios-specjalny': 'specjalny',
};

/** Four moves per weapon kind; Garda for everyone. */
export const MOVES_BY_WEAPON: Record<WeaponKind, MoveId[]> = {
  piesci: ['prosty', 'sierpowy', 'kopniak', 'garda'],
  kij: ['pchniecie', 'zamach', 'mlyniec', 'garda'],
  procarka: ['strzal', 'seria', 'celowanie', 'garda'],
  spray: ['psik', 'chmura', 'prosty', 'garda'],
  mikrofon: ['diss', 'bit', 'drop', 'garda'],
  deska: ['deska', 'kickflip', 'slizg', 'garda'],
};

/**
 * Learned moves (techniki): every weapon move has a stronger version the bud learns with experience and the skill
 * that goes with the weapon (training and gear count). It replaces the old move on the same button, so the moves
 * row never grows: progress shows as better moves, not more buttons.
 */
export type MoveUpgrade = { to: MoveId; level: number; skill: SkillId; rank: number };

const up = (to: MoveId, level: number, skill: SkillId, rank: number): MoveUpgrade => ({
  to,
  level,
  skill,
  rank,
});

export const MOVE_UPGRADES: Partial<Record<MoveId, MoveUpgrade>> = {
  garda: up('kontra', 5, 'przetrwanie', 1),
  prosty: up('seria-ciosow', 4, 'walka', 1),
  sierpowy: up('bomba', 7, 'walka', 2),
  kopniak: up('z-polobrotu', 10, 'walka', 3),
  pchniecie: up('szybkie-pchniecie', 4, 'walka', 1),
  zamach: up('z-gory', 7, 'walka', 2),
  mlyniec: up('huragan', 10, 'walka', 3),
  strzal: up('precyzyjny-strzal', 4, 'spryt', 1),
  seria: up('grad', 7, 'spryt', 2),
  celowanie: up('snajper', 10, 'spryt', 3),
  psik: up('psik-z-bliska', 4, 'graffiti', 1),
  chmura: up('burza-farby', 7, 'graffiti', 2),
  diss: up('roast', 4, 'flow', 1),
  bit: up('basowy-bit', 7, 'flow', 2),
  drop: up('mega-drop', 10, 'flow', 3),
  deska: up('ollie', 4, 'surfing', 1),
  kickflip: up('flip-360', 7, 'surfing', 2),
  slizg: up('grind', 10, 'surfing', 3),
};

/** Whether a fighter with this level and these skill ranks has learned an upgrade. */
export const knowsUpgrade = (
  u: MoveUpgrade,
  level: number,
  skills: Partial<Record<SkillId, number>>,
) => level >= u.level && (skills[u.skill] ?? 0) >= u.rank;

/** The weapon's moves as this bud knows them: each one swapped for its learned version when it qualifies. */
export function learnedMoves(
  weapon: WeaponKind,
  level: number,
  skills: Partial<Record<SkillId, number>>,
): MoveId[] {
  return MOVES_BY_WEAPON[weapon].map((id) => {
    const u = MOVE_UPGRADES[id];
    return u && knowsUpgrade(u, level, skills) ? u.to : id;
  });
}

// ---------- opponents ----------

const id = z.string().regex(/^[a-z0-9-]{2,40}$/);
const cell = z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() });

export const LOOT_TIERS: Record<number, Partial<Record<Rarity, number>>> = {
  1: { common: 70, uncommon: 25, rare: 5 },
  2: { common: 50, uncommon: 35, rare: 13, epic: 2 },
  3: { common: 30, uncommon: 40, rare: 24, epic: 5, legendary: 1 },
  4: { uncommon: 35, rare: 40, epic: 20, legendary: 5 },
  5: { rare: 40, epic: 40, legendary: 20 },
};

export const enemySchema = z.object({
  id,
  name: z.string().min(2).max(32),
  district: id,
  /** Map cells where they stand (the same type can stand in a few places). */
  spots: z.array(cell).min(1).max(6),
  level: z.number().int().min(1).max(30),
  hp: z.number().int().min(10).max(1000),
  attack: z.number().int().min(0).max(60),
  armor: z.number().int().min(0).max(60),
  speed: z.number().int().min(0).max(40),
  luck: z.number().int().min(0).max(60),
  weapon: weaponKindSchema,
  xp: z.number().int().min(1).max(1000),
  coins: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  /** Rarity table for drops (LOOT_TIERS) and the chance that anything drops. */
  lootTier: z.number().int().min(1).max(5),
  lootChance: z.number().min(0).max(1),
  look: budLookSchema,
  /** What they say before the duel; one is picked. */
  lines: z.array(z.string().min(1)).min(1),
  boss: z.boolean().default(false),
  /**
   * Lies in wait off the road on a route between cities (content/routes.ts): hidden in a nook or a bush until the
   * bud comes close, then jumps out and starts the duel on its own.
   */
  ambush: z.boolean().default(false),
});
export type Enemy = z.infer<typeof enemySchema>;
export type EnemyInput = z.input<typeof enemySchema>;

/** Seconds before the same opponent can be fought again after a win (no farming one spot). */
export const REMATCH_SECONDS = 45;
export const MAX_TURNS = 30;

// ---------- state ----------

const statusSchema = z.object({
  blind: z.number().int().nonnegative(),
  weaken: z.number().int().nonnegative(),
  aim: z.boolean(),
  /** Drugi oddech already used in this fight. */
  secondWind: z.boolean().default(false),
});

export const fighterSchema = z.object({
  name: z.string(),
  level: z.number().int(),
  maxHp: z.number().int(),
  hp: z.number().int(),
  attack: z.number().int(),
  armor: z.number().int(),
  speed: z.number().int(),
  luck: z.number().int(),
  /** Skill ranks that count in a duel. */
  walka: z.number().int(),
  przetrwanie: z.number().int(),
  spryt: z.number().int(),
  weapon: weaponKindSchema,
  weaponItem: z.string().nullable(),
  moves: z.array(moveIdSchema),
  /** Special abilities (skill perks) that count in a duel. */
  perks: z.array(z.string()).default([]),
  /** The five fight buttons the bud chose (loadout.ts; null = the weapon's own), and how far each move is upgraded. */
  kit: z.array(z.string().nullable()).nullable().default(null),
  ranks: z.record(z.string(), z.number().int().min(0).max(3)).default({}),
  status: statusSchema,
});
export type Fighter = z.infer<typeof fighterSchema>;

export const FIGHT_STATUSES = ['active', 'won', 'lost', 'fled'] as const;
export type FightStatus = (typeof FIGHT_STATUSES)[number];

export const fightStateSchema = z.object({
  enemyId: id,
  turn: z.number().int().nonnegative(),
  status: z.enum(FIGHT_STATUSES),
  bud: fighterSchema,
  enemy: fighterSchema,
  /** Seeded RNG state (the server keeps it; clients never see it). */
  rng: z.number().int(),
  /** Which of the opponent's spots the duel is at (the turf it counts for). */
  spot: z.number().int().min(0).max(5).optional(),
});
export type FightState = z.infer<typeof fightStateSchema>;

/** One hit (or miss) of a move. */
export type HitEvent = { hit: boolean; crit: boolean; damage: number };

export type TurnEvent = {
  actor: 'bud' | 'enemy';
  move: MoveId;
  hits: HitEvent[];
  /** An effect that took hold: guard, dodge, aim on the actor; blind, weaken on the target. */
  effect?: MoveEffect;
  budHp: number;
  enemyHp: number;
  /** Drugi oddech took hold for this fighter (it got this much health back). */
  secondWind?: { who: 'bud' | 'enemy'; hp: number };
};

// ---------- RNG ----------

/** mulberry32 step: returns [0..1) and the next state. */
function next(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) | 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

export class Rng {
  constructor(public state: number) {}
  float() {
    const [v, s] = next(this.state);
    this.state = s;
    return v;
  }
  int(min: number, max: number) {
    return min + Math.floor(this.float() * (max - min + 1));
  }
  chance(percent: number) {
    return this.float() * 100 < percent;
  }
}

// ---------- fighters ----------

export const budMaxHp = (level: number) => 60 + 10 * (Math.max(1, level) - 1);

/**
 * The bud as a fighter: level, gear stats and skills, moves from the weapon, plus its perks (special moves,
 * Twardziel) and the boosts of energy drinks it drank.
 */
export function budFighter(
  name: string,
  xp: number,
  stats: CharacterStats,
  weaponItem: CatalogItem | undefined,
  {
    perks = [],
    buffs = [],
    kit = null,
    ranks = {},
  }: {
    perks?: readonly string[];
    buffs?: readonly BuffId[];
    kit?: (string | null)[] | null;
    ranks?: Record<string, number>;
  } = {},
): Fighter {
  const level = levelFromXp(xp).level;
  const weapon = weaponItem?.weapon ?? 'piesci';
  const boost = buffBonus(buffs);
  const hp = budMaxHp(level) + (perks.includes('twardziel') ? 20 : 0) + boost.hp;
  const extra = Object.entries(PERK_MOVES)
    .filter(([perk]) => perks.includes(perk))
    .map(([, move]) => move);
  return {
    name,
    level,
    maxHp: hp,
    hp,
    // experience counts too: a bit of attack and toughness with every level
    attack: stats.attack + Math.floor(((level - 1) * 4) / 5) + boost.attack,
    armor: stats.armor + Math.floor((level - 1) / 2) + boost.armor,
    speed: stats.speed + boost.duelSpeed,
    luck: stats.luck + boost.luck,
    walka: stats.skills.walka ?? 0,
    przetrwanie: stats.skills.przetrwanie ?? 0,
    spryt: stats.skills.spryt ?? 0,
    weapon,
    weaponItem: weaponItem?.id ?? null,
    moves: [...learnedMoves(weapon, level, stats.skills), ...extra],
    perks: [...perks],
    kit,
    ranks: { ...ranks },
    status: { blind: 0, weaken: 0, aim: false, secondWind: false },
  };
}

export function enemyFighter(e: Enemy): Fighter {
  return {
    name: e.name,
    level: e.level,
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
    moves: MOVES_BY_WEAPON[e.weapon],
    perks: [],
    kit: null,
    ranks: {},
    status: { blind: 0, weaken: 0, aim: false, secondWind: false },
  };
}

export function newFight(enemyId: string, bud: Fighter, enemy: Fighter, seed: number): FightState {
  return { enemyId, turn: 0, status: 'active', bud, enemy, rng: seed | 0 };
}

// ---------- maths (exported for tests and the game's hints) ----------

/** Chance (%) that a move from `attacker` lands on `defender`. */
export function hitChance(
  move: Move,
  attacker: Fighter,
  defender: Fighter,
  defenderDodging: boolean,
) {
  const dodge =
    Math.floor(defender.speed / 2) +
    3 * defender.przetrwanie +
    (defenderDodging ? 35 : 0) +
    (defender.perks.includes('unik-surfera') ? 10 : 0);
  const blind = attacker.status.blind > 0 ? 30 : 0;
  return Math.max(10, Math.min(99, move.accuracy - dodge - blind));
}

export const critChance = (f: Fighter) =>
  f.status.aim ? 100 : Math.min(60, 5 + Math.floor(f.luck / 2) + 2 * f.spryt);

/** Damage of one landed hit, from a base roll. */
export function damage(
  roll: number,
  attacker: Fighter,
  defender: Fighter,
  crit: boolean,
  defenderGuarding: boolean,
) {
  let d = (roll + Math.floor(attacker.attack / 2)) * (100 + 6 * attacker.walka);
  d = Math.floor(d / 100);
  if (attacker.perks.includes('mistrz-ringu')) d = Math.floor((d * 110) / 100);
  if (crit) d = Math.floor((d * 3) / 2);
  if (attacker.status.weaken > 0) d = Math.floor((d * 3) / 4);
  if (defenderGuarding) d = Math.floor(d / 2);
  d = Math.floor((d * 100) / (100 + 3 * defender.armor));
  return Math.max(1, d);
}

// ---------- AI ----------

function enemyMove(state: FightState, rng: Rng): MoveId {
  const e = state.enemy;
  const low = e.hp * 100 < e.maxHp * 35;
  if (low && e.moves.includes('garda') && rng.chance(30)) return 'garda';
  const options = e.moves.filter((id) => id !== 'garda');
  // effect moves now and then, attacks weighted by expected damage
  const weights = options.map((id) => {
    const mv: Move = MOVES[id];
    if (mv.power[1] === 0) return e.status.aim ? 0 : 15;
    if (mv.effect === 'blind' && state.bud.status.blind > 0) return 5;
    if (mv.effect === 'weaken' && state.bud.status.weaken > 0) return 5;
    return ((mv.power[0] + mv.power[1]) * (mv.hits ?? 1) * mv.accuracy) / 20;
  });
  let pick = rng.float() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) {
    pick -= weights[i]!;
    if (pick < 0) return options[i]!;
  }
  return options[0]!;
}

// ---------- a turn ----------

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * Plays one turn: the bud's move and the opponent's answer. Guard and dodge take hold first; then the faster fighter
 * acts (the bud on a tie). Returns the new state and what happened, for the game to animate.
 */
export function playTurn(
  before: FightState,
  budMove: MoveId,
): { state: FightState; events: TurnEvent[] } {
  if (before.status !== 'active') throw new Error('fight is over');
  if (!before.bud.moves.includes(budMove)) throw new Error(`move ${budMove} not available`);
  const state = clone(before);
  const rng = new Rng(state.rng);
  const choice = { bud: budMove, enemy: enemyMove(state, rng) };
  // guard and dodge moves (Garda, Kontra, Ślizg, Grind) take hold before anyone acts
  const effectOf = (moveId: MoveId) => (MOVES[moveId] as Move).effect;
  const guarding = {
    bud: effectOf(choice.bud) === 'guard',
    enemy: effectOf(choice.enemy) === 'guard',
  };
  const dodging = {
    bud: effectOf(choice.bud) === 'dodge',
    enemy: effectOf(choice.enemy) === 'dodge',
  };
  const order: ('bud' | 'enemy')[] =
    state.enemy.speed > state.bud.speed ? ['enemy', 'bud'] : ['bud', 'enemy'];
  const events: TurnEvent[] = [];

  for (const actor of order) {
    const me = actor === 'bud' ? state.bud : state.enemy;
    const other = actor === 'bud' ? state.enemy : state.bud;
    const target = actor === 'bud' ? 'enemy' : 'bud';
    if (me.hp <= 0 || other.hp <= 0) break;
    const move: Move = MOVES[choice[actor]];
    const event: TurnEvent = { actor, move: move.id as MoveId, hits: [], budHp: 0, enemyHp: 0 };

    if (move.effect === 'guard' || move.effect === 'dodge') event.effect = move.effect;
    else if (move.effect === 'aim' && move.power[1] === 0) {
      me.status.aim = true;
      event.effect = 'aim';
    }
    if (move.power[1] > 0) {
      for (let i = 0; i < (move.hits ?? 1) && other.hp > 0; i++) {
        const hit = rng.chance(hitChance(move, me, other, dodging[target]));
        if (!hit) {
          event.hits.push({ hit: false, crit: false, damage: 0 });
          continue;
        }
        const crit = rng.chance(critChance(me));
        if (crit) me.status.aim = false;
        const dmg = damage(
          rng.int(move.power[0], move.power[1]),
          me,
          other,
          crit,
          guarding[target],
        );
        other.hp = Math.max(0, other.hp - dmg);
        event.hits.push({ hit: true, crit, damage: dmg });
        // Drugi oddech: once a fight, dropping below a quarter of health gives a third of it back
        if (
          other.perks.includes('drugi-oddech') &&
          !other.status.secondWind &&
          other.hp * 4 < other.maxHp
        ) {
          const back = Math.floor(other.maxHp / 3);
          other.hp = Math.min(other.maxHp, other.hp + back);
          other.status.secondWind = true;
          event.secondWind = { who: target, hp: back };
        }
      }
      // a shot that also takes aim (Oko snajpera): the aim is for the next move, not this one
      if (move.effect === 'aim') {
        me.status.aim = true;
        event.effect = 'aim';
      }
      // blind and weaken stick only when the move landed
      if (event.hits.some((h) => h.hit) && (move.effect === 'blind' || move.effect === 'weaken')) {
        other.status[move.effect] = 2;
        event.effect = move.effect;
      }
    }
    event.budHp = state.bud.hp;
    event.enemyHp = state.enemy.hp;
    events.push(event);
  }

  // effects wear off
  for (const f of [state.bud, state.enemy]) {
    if (f.status.blind > 0) f.status.blind--;
    if (f.status.weaken > 0) f.status.weaken--;
  }
  state.turn++;
  state.rng = rng.state;
  if (state.enemy.hp <= 0) state.status = 'won';
  else if (state.bud.hp <= 0 || state.turn >= MAX_TURNS) state.status = 'lost';
  return { state, events };
}

// ---------- rewards ----------

/** XP for a win: less when the bud has outgrown the opponent (no farming the weak). */
export function fightXp(enemy: Enemy, budLevel: number) {
  const gap = Math.max(0, budLevel - enemy.level);
  return Math.max(1, Math.round((enemy.xp * Math.max(10, 100 - 15 * gap)) / 100));
}

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export type Loot = { itemId: string | null; coins: number; drink: string | null };

/** Chance (%) that a won duel also drops an energy drink. */
export const DRINK_DROP_CHANCE = 25;

/**
 * What a won duel drops: coins (with the bud's luck), maybe an energy drink and, by chance (more with Łowca łupów),
 * an item whose rarity follows the opponent's loot tier, from items not above the opponent's level + 2. An item the
 * bud already owns turns into coins.
 */
export function rollLoot(
  enemy: Enemy,
  luck: number,
  catalog: readonly CatalogItem[],
  owned: ReadonlySet<string>,
  seed: number,
  { perks = [] }: { perks?: readonly string[] } = {},
): Loot {
  // the drink has its own RNG stream so it never changes which item drops
  const drinks = catalog.filter((i) => i.drink && i.available);
  const drinkRng = new Rng(seed ^ 0x5bd1e995);
  const drink =
    drinks.length > 0 && drinkRng.chance(DRINK_DROP_CHANCE)
      ? drinks[drinkRng.int(0, drinks.length - 1)]!.id
      : null;
  return { ...rollItem(enemy, luck, catalog, owned, seed, perks), drink };
}

function rollItem(
  enemy: Enemy,
  luck: number,
  catalog: readonly CatalogItem[],
  owned: ReadonlySet<string>,
  seed: number,
  perks: readonly string[],
): Omit<Loot, 'drink'> {
  const rng = new Rng(seed);
  let coins = coinsWithLuck(
    rng.int(enemy.coins[0], Math.max(enemy.coins[0], enemy.coins[1])),
    luck,
  );
  const bonus = perks.includes('lowca-lupow') ? 10 : 0;
  if (!rng.chance(enemy.lootChance * 100 + bonus)) return { itemId: null, coins };

  const table = LOOT_TIERS[enemy.lootTier] ?? LOOT_TIERS[1]!;
  const total = Object.values(table).reduce((a, b) => a + (b ?? 0), 0);
  let pick = rng.float() * total;
  let rarity: Rarity = 'common';
  for (const [r, w] of Object.entries(table) as [Rarity, number][]) {
    pick -= w;
    if (pick < 0) {
      rarity = r;
      break;
    }
  }
  const pool = (r: Rarity) =>
    catalog.filter((i) => i.loot && i.available && i.rarity === r && levelOf(i) <= enemy.level + 2);
  // nothing that rare at this level: step down
  let index = RARITY_ORDER.indexOf(rarity);
  while (index > 0 && pool(RARITY_ORDER[index]!).length === 0) index--;
  const items = pool(RARITY_ORDER[index]!);
  if (items.length === 0) return { itemId: null, coins };
  const item = items[rng.int(0, items.length - 1)]!;
  if (owned.has(item.id)) {
    coins += Math.floor(item.price.amount / 4);
    return { itemId: null, coins };
  }
  return { itemId: item.id, coins };
}

// ---------- API shapes ----------

/** What clients see of a fight (no RNG state). */
export const fightViewSchema = fightStateSchema.omit({ rng: true }).extend({ id: z.string() });
export type FightView = z.infer<typeof fightViewSchema>;

export const startFightRequestSchema = z.object({
  enemyId: id,
  spot: z.number().int().min(0).max(5).optional(),
});
export const fightMoveRequestSchema = z.object({ move: moveIdSchema });

export const fightRewardSchema = z.object({
  xpGained: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  level: z.number().int().min(1),
  levelUp: z.boolean(),
  coinsGained: z.number().int().nonnegative(),
  coins: z.number().int().nonnegative(),
  item: z.string().nullable(),
  /** Energy drink dropped with the loot. */
  drink: z.string().nullable().default(null),
});
export type FightReward = z.infer<typeof fightRewardSchema>;

const hitEventSchema = z.object({ hit: z.boolean(), crit: z.boolean(), damage: z.number().int() });
export const turnEventSchema = z.object({
  actor: z.enum(['bud', 'enemy']),
  move: moveIdSchema,
  hits: z.array(hitEventSchema),
  effect: z.enum(['guard', 'dodge', 'aim', 'blind', 'weaken']).optional(),
  budHp: z.number().int(),
  enemyHp: z.number().int(),
  secondWind: z.object({ who: z.enum(['bud', 'enemy']), hp: z.number().int() }).optional(),
});

export const fightResponseSchema = z.object({
  fight: fightViewSchema,
  events: z.array(turnEventSchema),
  reward: fightRewardSchema.nullable(),
  /** Influence a won duel earned in its turf. */
  influence: influenceSchema.nullable().default(null),
  /** A finished duel against another bud. */
  pvp: pvpResultSchema.nullable().default(null),
  /** A finished raid on another bud's district. */
  raid: raidResultSchema.nullable().default(null),
});
export type FightResponse = z.infer<typeof fightResponseSchema>;

/**
 * An opponent with stats that follow its level (content files use this so the balance stays in one place).
 * Bosses hit harder, take more and drop the best loot.
 */
export function scaledEnemy(
  base: Pick<
    EnemyInput,
    'id' | 'name' | 'district' | 'level' | 'weapon' | 'look' | 'lines' | 'spots'
  > & {
    boss?: boolean;
    ambush?: boolean;
  },
): EnemyInput {
  const l = base.level;
  const boss = base.boss ? 1 : 0;
  return {
    ...base,
    hp: 34 + 10 * (l - 1) + boss * (20 + 3 * l),
    attack: 1 + Math.floor((l * 13) / 10) + boss * 2,
    armor: Math.floor((l * 7) / 10) + boss * 3,
    speed: Math.floor((l * 8) / 10) + boss * 2,
    luck: l,
    xp: 20 + 14 * l + boss * 60,
    coins: [4 * l + boss * 30, 10 * l + boss * 60],
    lootTier: boss ? 5 : Math.min(4, Math.ceil(l / 3)),
    lootChance: boss ? 0.9 : Math.min(0.6, 0.3 + 0.025 * l),
    boss: !!base.boss,
    ambush: !!base.ambush,
  };
}
