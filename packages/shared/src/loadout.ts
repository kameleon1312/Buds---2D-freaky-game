import { z } from 'zod';
import {
  ABILITIES,
  KIT_SLOTS,
  MOVE_MAX_RANK,
  ULT_LEVEL,
  abilityIcon,
  abilityName,
  kitEntry,
  rankCooldown,
  rankDamage,
  type AbilityId,
} from './brawl';
import { MOVE_UPGRADES, MOVES_BY_WEAPON, PERK_MOVES, type MoveId } from './combat';
import { weaponKindSchema, type WeaponKind } from './gear';
import { PERKS, SKILLS, type SkillId } from './skills';

/**
 * Ciosy (docs/walka.md): every bud puts its own five fight buttons together, one set per weapon kind. Each button
 * has a pool: the weapon's basic attacks, its abilities and their stronger versions, two moves any weapon can carry,
 * the guards, the ultimates. Moves open with the bud's level (stronger versions with the weapon's skill too, ultimates
 * of perks with the perk), and every move can be upgraded three times for coins earned in the game, each upgrade
 * from a level on: harder blows, shorter cooldowns, longer holds. Nothing here is sold for real money. The server
 * checks every loadout when it is saved and again when it builds the fighter (a move that is no longer open, after a
 * weapon swap or a reset, falls back to the weapon's own).
 */

export type SlotKind = 'basic' | 'skill' | 'guard' | 'ult';
export const SLOT_KINDS: readonly SlotKind[] = ['basic', 'skill', 'skill', 'guard', 'ult'];
export const SLOT_NAMES = ['Cios', 'Umiejętność 1', 'Umiejętność 2', 'Garda', 'Supercios'] as const;

/** What the bud has that opens moves: its level, skill ranks (spent + training) and perks. */
export type MoveContext = {
  level: number;
  skills: Partial<Record<SkillId, number>>;
  perks: readonly string[];
};

const upgradeOf = (id: MoveId) => MOVE_UPGRADES[id]?.to;
const learnedFrom = new Map<string, MoveId>(
  Object.entries(MOVE_UPGRADES).map(([from, u]) => [u!.to, from as MoveId]),
);
const perkOf = new Map<string, string>(
  Object.entries(PERK_MOVES).map(([perk, move]) => [move!, perk]),
);

/** The moves each button of a weapon can carry. */
export function movePool(weapon: WeaponKind): Record<SlotKind, AbilityId[]> {
  const [basic, a, b] = MOVES_BY_WEAPON[weapon] as MoveId[];
  const withUp = (id: MoveId) => [id, upgradeOf(id)].filter((m): m is MoveId => !!m);
  return {
    basic: withUp(basic!),
    skill: [...withUp(a!), ...withUp(b!), 'podciecie'],
    guard: ['garda', 'kontra', 'zryw'],
    ult: [`ult-${weapon}` as AbilityId, ...(Object.values(PERK_MOVES) as AbilityId[])],
  };
}

export type Unlock = { level: number; skill: SkillId | null; rank: number; perk: string | null };

/** What opens a move: a level, the skill that goes with it, a perk. */
export function unlockOf(id: AbilityId): Unlock {
  const perk = perkOf.get(id);
  if (perk) {
    const p = PERKS.find((x) => x.id === perk)!;
    return { level: ULT_LEVEL, skill: p.skill as SkillId, rank: p.rank, perk };
  }
  if (id.startsWith('ult-')) return { level: ULT_LEVEL, skill: null, rank: 0, perk: null };
  if (id === 'podciecie') return { level: 3, skill: null, rank: 0, perk: null };
  if (id === 'zryw') return { level: 4, skill: null, rank: 0, perk: null };
  const from = learnedFrom.get(id);
  if (from) {
    const u = MOVE_UPGRADES[from]!;
    return { level: u.level, skill: u.skill, rank: u.rank, perk: null };
  }
  return { level: 1, skill: null, rank: 0, perk: null };
}

export function unlocked(id: AbilityId, ctx: MoveContext): boolean {
  const u = unlockOf(id);
  if (u.perk) return ctx.perks.includes(u.perk);
  if (ctx.level < u.level) return false;
  return !u.skill || (ctx.skills[u.skill] ?? 0) >= u.rank;
}

/** What still keeps a move closed, in words ("Poziom 7 · Walka 2"), or null when it is open. */
export function unlockNeed(id: AbilityId, ctx: MoveContext): string | null {
  if (unlocked(id, ctx)) return null;
  const u = unlockOf(id);
  if (u.perk) return `Atut: ${PERKS.find((p) => p.id === u.perk)!.name}`;
  const parts: string[] = [];
  if (ctx.level < u.level) parts.push(`Poziom ${u.level}`);
  if (u.skill && (ctx.skills[u.skill] ?? 0) < u.rank)
    parts.push(`${SKILLS.find((s) => s.id === u.skill)?.name ?? u.skill} ${u.rank}`);
  return parts.join(' · ');
}

/** The weapon's own five as the bud knows them (the stronger version once learned, a perk's ultimate first). */
export function defaultKit(weapon: WeaponKind, ctx: MoveContext): (AbilityId | null)[] {
  const pool = movePool(weapon);
  const best = (ids: AbilityId[]) => [...ids].reverse().find((id) => unlocked(id, ctx)) ?? ids[0]!;
  const [, a, b] = MOVES_BY_WEAPON[weapon] as MoveId[];
  const skill = (id: MoveId) => {
    const up = upgradeOf(id);
    return up && unlocked(up, ctx) ? up : id;
  };
  const perkUlt = pool.ult.slice(1).find((id) => unlocked(id, ctx));
  const weaponUlt = unlocked(pool.ult[0]!, ctx) ? pool.ult[0]! : null;
  return [
    best(pool.basic),
    skill(a!),
    skill(b!),
    unlocked('kontra', ctx) ? 'kontra' : 'garda',
    perkUlt ?? weaponUlt,
  ];
}

/** Why a loadout can't be saved, or null. */
export function kitProblem(
  weapon: WeaponKind,
  kit: readonly (string | null)[],
  ctx: MoveContext,
): string | null {
  if (kit.length !== KIT_SLOTS) return 'Pięć przycisków, ani mniej, ani więcej.';
  const pool = movePool(weapon);
  for (let i = 0; i < KIT_SLOTS; i++) {
    const id = kit[i] ?? null;
    const kind = SLOT_KINDS[i]!;
    if (id === null) {
      if (kind === 'ult') continue;
      return `${SLOT_NAMES[i]}: wybierz cios.`;
    }
    if (!(pool[kind] as string[]).includes(id)) return `${SLOT_NAMES[i]}: ten cios tu nie pasuje.`;
    if (!unlocked(id as AbilityId, ctx))
      return `${abilityName(id as AbilityId)}: jeszcze zamknięty.`;
  }
  if (kit[1] === kit[2]) return 'Dwie umiejętności muszą być różne.';
  return null;
}

/**
 * The buttons a fighter gets: the saved loadout where every move still fits and is open, the weapon's own for the
 * rest (so a reset skill or a new weapon never leaves an empty or a forbidden button).
 */
export function resolveKit(
  weapon: WeaponKind,
  saved: readonly (string | null)[] | null | undefined,
  ctx: MoveContext,
): (AbilityId | null)[] {
  const base = defaultKit(weapon, ctx);
  if (!saved || saved.length !== KIT_SLOTS) return base;
  const pool = movePool(weapon);
  const kit = base.slice();
  for (let i = 0; i < KIT_SLOTS; i++) {
    const id = saved[i];
    const kind = SLOT_KINDS[i]!;
    if (id === null && kind === 'ult') kit[i] = null;
    else if (id && (pool[kind] as string[]).includes(id) && unlocked(id as AbilityId, ctx))
      kit[i] = id as AbilityId;
  }
  // the two abilities must differ: the second falls back to whatever open one is not the first
  if (kit[1] === kit[2])
    kit[2] = pool.skill.find((id) => id !== kit[1] && unlocked(id, ctx)) ?? base[2]!;
  return kit;
}

// ---------- upgrades ----------

const RANK_COINS = [90, 220, 480] as const;
const RANK_LEVELS = [2, 5, 9] as const;

/** Coins for the next upgrade of a move (rank 1..3): dearer for moves that open later. */
export function rankCost(id: AbilityId, rank: number): number {
  const base = RANK_COINS[Math.max(0, Math.min(MOVE_MAX_RANK, rank) - 1)]!;
  const level = unlockOf(id).level;
  return Math.round((base * (1 + level / 8)) / 5) * 5;
}

/** The bud's level the next upgrade needs. */
export const rankLevel = (id: AbilityId, rank: number) =>
  Math.min(30, unlockOf(id).level + RANK_LEVELS[Math.max(0, Math.min(MOVE_MAX_RANK, rank) - 1)]!);

export type MoveUpgradeProblem = 'unknown' | 'locked' | 'max' | 'level' | 'poor';

/** Why a move can't be upgraded now, or null. */
export function moveUpgradeProblem(
  id: string,
  rank: number,
  ctx: MoveContext,
  coins: number,
): MoveUpgradeProblem | null {
  if (!(id in ABILITIES)) return 'unknown';
  const move = id as AbilityId;
  if (!unlocked(move, ctx)) return 'locked';
  if (rank >= MOVE_MAX_RANK) return 'max';
  if (ctx.level < rankLevel(move, rank + 1)) return 'level';
  if (coins < rankCost(move, rank + 1)) return 'poor';
  return null;
}

export const MOVE_UPGRADE_PROBLEM_TEXT: Record<MoveUpgradeProblem, string> = {
  unknown: 'Nie ma takiego ciosu.',
  locked: 'Ten cios jest jeszcze zamknięty.',
  max: 'Ten cios jest już w pełni ulepszony.',
  level: 'Potrzebny wyższy poziom.',
  poor: 'Brakuje monet.',
};

/** What an ability does, in a few words for the Ciosy card ("Wypad · ogłusza · 6 s"). */
export function abilityBlurb(id: AbilityId, rank = 0): string {
  const s = ABILITIES[id];
  const what = {
    melee: 'Cios',
    arc: 'Cios w łuku',
    proj: s.shots && s.shots > 1 ? `${s.shots} pociski` : 'Pocisk',
    line: 'Fala w linii',
    circle: 'Obszar',
    self: 'Obszar wokół',
    dash: 'Wypad',
    buff: 'Wzmocnienie',
    shield: 'Tarcza',
  }[s.shape];
  const effects = [
    s.stun && 'ogłusza',
    s.root && 'unieruchamia',
    s.slow && 'spowalnia',
    s.knock && 'odrzuca',
    s.blind && 'oślepia',
    s.weaken && 'osłabia',
    s.aim && 'pewne krytyki',
    s.dodge && 'unik',
    s.haste && 'przyspiesza',
    s.hits && s.hits > 1 && `×${s.hits}`,
  ].filter(Boolean);
  const cd = (s.cd * rankCooldown(rank)) / 1000;
  return [
    what,
    ...effects,
    `${cd >= 10 ? Math.round(cd) : cd.toFixed(1).replace('.', ',')}\u00a0s`,
  ].join(' · ');
}

// ---------- API shapes ----------

export const moveOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  blurb: z.string(),
  shape: z.string(),
  /** Closed: what still opens it ("Poziom 7 · Walka 2"); open: null. */
  need: z.string().nullable(),
  rank: z.number().int().min(0).max(MOVE_MAX_RANK),
  /** Damage of a blow now, % of the move's base (100 + 10 per upgrade). */
  power: z.number().int(),
  /** The next upgrade (null at the top): coins and the level it needs. */
  next: z.object({ coins: z.number().int(), level: z.number().int() }).nullable(),
});
export type MoveOption = z.infer<typeof moveOptionSchema>;

export const movesResponseSchema = z.object({
  weapon: weaponKindSchema,
  kit: z.array(z.string().nullable()).length(KIT_SLOTS),
  slots: z.array(
    z.object({ name: z.string(), kind: z.string(), options: z.array(moveOptionSchema) }),
  ),
  coins: z.number().int(),
});
export type MovesResponse = z.infer<typeof movesResponseSchema>;

export const loadoutRequestSchema = z.object({
  weapon: weaponKindSchema,
  kit: z
    .array(
      z
        .string()
        .regex(/^[a-z0-9-]{2,30}$/)
        .nullable(),
    )
    .length(KIT_SLOTS),
});
export type LoadoutRequest = z.infer<typeof loadoutRequestSchema>;

/** The Ciosy screen's whole picture: the five buttons and every move that could go on each. */
export function movesView(
  weapon: WeaponKind,
  kit: (AbilityId | null)[],
  ranks: Record<string, number>,
  ctx: MoveContext,
  coins: number,
): MovesResponse {
  const pool = movePool(weapon);
  const option = (id: AbilityId): MoveOption => {
    const rank = Math.min(MOVE_MAX_RANK, ranks[id] ?? 0);
    const e = kitEntry(id);
    return {
      id,
      name: e.name,
      icon: abilityIcon(id),
      blurb: abilityBlurb(id, rank),
      shape: e.shape,
      need: unlockNeed(id, ctx),
      rank,
      power: rankDamage(rank),
      next:
        rank >= MOVE_MAX_RANK
          ? null
          : { coins: rankCost(id, rank + 1), level: rankLevel(id, rank + 1) },
    };
  };
  return {
    weapon,
    kit,
    slots: SLOT_KINDS.map((kind, i) => ({
      name: SLOT_NAMES[i]!,
      kind,
      options: [...new Set(pool[kind])].map(option),
    })),
    coins,
  };
}
