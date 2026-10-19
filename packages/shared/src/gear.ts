import { z } from 'zod';
import { SKILL_MAX_RANK, SKILLS, type SkillId } from './skills';

/**
 * Gear: what a bud wears and carries, head to toe. Every slot holds one item; items add to the bud's stats and
 * skills while worn. Server-side rules (see docs/ekwipunek.md):
 * - bonuses come only from items earned in the game (quest rewards, caches, the coin shop);
 * - anything bought with real money (premium / gems) is looks only — `gearProblems` fails otherwise;
 * - the server computes the stats it uses (cache coins, later fights); the game shows the same numbers.
 * The stat formula is mirrored in Unity `Gear.cs` — change both together.
 */

export const SLOTS = [
  { id: 'head', name: 'Głowa' },
  { id: 'face', name: 'Twarz' },
  { id: 'torso', name: 'Tułów' },
  { id: 'hands', name: 'Dłonie' },
  { id: 'legs', name: 'Nogi' },
  { id: 'feet', name: 'Stopy' },
  { id: 'accessory', name: 'Dodatek' },
  { id: 'held', name: 'W ręku' },
  /** Rides: skateboards, scooters, bikes… They add their own speed (see `mountSpeed` in the catalog). */
  { id: 'mount', name: 'Pojazd' },
] as const;
export type SlotId = (typeof SLOTS)[number]['id'];
export const slotIdSchema = z.enum(SLOTS.map((s) => s.id) as [SlotId, ...SlotId[]]);

export const STATS = [
  {
    id: 'attack',
    name: 'Atak',
    unit: '',
    max: 40,
    description: 'Mocniejsze ciosy w pojedynkach.',
  },
  {
    id: 'speed',
    name: 'Szybkość',
    unit: '%',
    max: 25,
    description: 'Szybszy chód i bieg: każdy punkt to +1% prędkości.',
  },
  {
    id: 'armor',
    name: 'Pancerz',
    unit: '',
    max: 40,
    description: 'Mniej obrażeń w pojedynkach.',
  },
  {
    id: 'luck',
    name: 'Szczęście',
    unit: '%',
    max: 50,
    description: 'Więcej monet ze skrytek: każdy punkt to +1%.',
  },
] as const;
export type StatId = (typeof STATS)[number]['id'];

/**
 * What a weapon (an item in the "W ręku" slot) is: it decides the bud's moves in a duel. No weapon = fists.
 * Moves per kind: packages/shared/src/combat.ts.
 */
export const WEAPON_KINDS = ['piesci', 'kij', 'procarka', 'spray', 'mikrofon', 'deska'] as const;
export type WeaponKind = (typeof WEAPON_KINDS)[number];
export const weaponKindSchema = z.enum(WEAPON_KINDS);

/** Items can lift a skill this many ranks above what the bud has trained. */
export const SKILL_GEAR_MAX = 2;

const skillBonus = z.record(
  z.enum(SKILLS.map((s) => s.id) as [SkillId, ...SkillId[]]),
  z.number().int().min(1).max(2),
);

export const gearBonusSchema = z.object({
  attack: z.number().int().min(1).max(15).optional(),
  speed: z.number().int().min(1).max(15).optional(),
  armor: z.number().int().min(1).max(15).optional(),
  luck: z.number().int().min(1).max(15).optional(),
  skills: skillBonus.optional(),
});
export type GearBonus = z.infer<typeof gearBonusSchema>;

export type CharacterStats = Record<StatId, number> & {
  /** Effective skill ranks: trained ranks plus gear (capped). */
  skills: Record<SkillId, number>;
};

export const characterStatsSchema = z.object({
  attack: z.number().int().nonnegative(),
  speed: z.number().int().nonnegative(),
  armor: z.number().int().nonnegative(),
  luck: z.number().int().nonnegative(),
  skills: z.record(z.string(), z.number().int().nonnegative()),
});

/** What the worn items add up to, plus trained skills. Caps keep any combination fair. */
export function characterStats(
  worn: readonly { bonus?: GearBonus }[],
  ranks: Partial<Record<SkillId, number>> = {},
): CharacterStats {
  const stats = { attack: 0, speed: 0, armor: 0, luck: 0 } as Record<StatId, number>;
  const gearSkills: Partial<Record<SkillId, number>> = {};
  for (const item of worn) {
    for (const s of STATS) stats[s.id] += item.bonus?.[s.id] ?? 0;
    for (const [id, n] of Object.entries(item.bonus?.skills ?? {}) as [SkillId, number][])
      gearSkills[id] = (gearSkills[id] ?? 0) + n;
  }
  for (const s of STATS) stats[s.id] = Math.min(stats[s.id], s.max);
  const skills = {} as Record<SkillId, number>;
  for (const s of SKILLS)
    skills[s.id] = Math.min(
      (ranks[s.id] ?? 0) + Math.min(gearSkills[s.id] ?? 0, SKILL_GEAR_MAX),
      SKILL_MAX_RANK + SKILL_GEAR_MAX,
    );
  return { ...stats, skills };
}

/** Coins a cache gives with the bud's luck. */
export const coinsWithLuck = (coins: number, luck: number) =>
  Math.round(coins * (1 + Math.min(Math.max(luck, 0), 50) / 100));

// ---------- API shapes ----------

export const equipmentSchema = z.object(
  Object.fromEntries(SLOTS.map((s) => [s.id, z.string().nullable()])) as Record<
    SlotId,
    z.ZodNullable<z.ZodString>
  >,
);
export type Equipment = z.infer<typeof equipmentSchema>;

export const emptyEquipment = (): Equipment =>
  Object.fromEntries(SLOTS.map((s) => [s.id, null])) as Equipment;

export const equipmentResponseSchema = z.object({
  slots: equipmentSchema,
  stats: characterStatsSchema,
});
export type EquipmentResponse = z.infer<typeof equipmentResponseSchema>;

export const equipRequestSchema = z.object({ itemId: z.string().nullable() });
export type EquipRequest = z.infer<typeof equipRequestSchema>;

export const buyResponseSchema = z.object({
  itemId: z.string(),
  /** Coins left. */
  coins: z.number().int().nonnegative(),
  /** Gems left (premium purchases). */
  gems: z.number().int().nonnegative().optional(),
});
export type BuyResponse = z.infer<typeof buyResponseSchema>;
