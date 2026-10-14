import { z } from 'zod';

/**
 * Energy drinks (eliksiry): consumables a bud carries in numbers and drinks for a timed boost. The server keeps the
 * count and the active boosts (`bud_consumables`, `bud_buffs`) and applies them where it decides things (duels,
 * caches, training); the game shows the timers and applies the speed boost to walking.
 */
export const BUFFS = [
  {
    id: 'turbo',
    name: 'Turbo',
    seconds: 180,
    description: '+15% szybkości i +5 Szybkości w pojedynkach.',
  },
  { id: 'sila', name: 'Siła', seconds: 300, description: '+6 Ataku w pojedynkach.' },
  { id: 'pancerz', name: 'Pancerz', seconds: 300, description: '+6 Pancerza w pojedynkach.' },
  {
    id: 'fart',
    name: 'Fart',
    seconds: 300,
    description: '+10 Szczęścia: więcej monet i ciosów krytycznych.',
  },
  {
    id: 'skupienie',
    name: 'Skupienie',
    seconds: 600,
    description: 'Podwójne XP z treningu umiejętności.',
  },
  {
    id: 'regeneracja',
    name: 'Regeneracja',
    seconds: 300,
    description: '+25 zdrowia w pojedynkach.',
  },
] as const;
export type BuffId = (typeof BUFFS)[number]['id'];
export const buffIdSchema = z.enum(BUFFS.map((b) => b.id) as [BuffId, ...BuffId[]]);

/** What the active boosts add (only the fields a boost touches). */
export function buffBonus(active: readonly BuffId[]) {
  const has = (b: BuffId) => active.includes(b);
  return {
    attack: has('sila') ? 6 : 0,
    armor: has('pancerz') ? 6 : 0,
    luck: has('fart') ? 10 : 0,
    duelSpeed: has('turbo') ? 5 : 0,
    walkSpeedPercent: has('turbo') ? 15 : 0,
    hp: has('regeneracja') ? 25 : 0,
    trainingFocus: has('skupienie'),
  };
}

// ---------- API shapes ----------

export const ownedConsumableSchema = z.object({
  itemId: z.string(),
  qty: z.number().int().nonnegative(),
});

export const activeBuffSchema = z.object({
  buff: buffIdSchema,
  until: z.string(),
  secondsLeft: z.number().int().nonnegative(),
});
export type ActiveBuff = z.infer<typeof activeBuffSchema>;

export const consumablesResponseSchema = z.object({
  items: z.array(ownedConsumableSchema),
  buffs: z.array(activeBuffSchema),
});
export type ConsumablesResponse = z.infer<typeof consumablesResponseSchema>;
