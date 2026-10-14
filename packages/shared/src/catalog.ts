import { z } from 'zod';
import { HAIR_STYLES, OUTFITS, OUTFIT_LABELS, HAIR_LABELS } from './bud/constants';
import type { BudLook } from './bud/look';
import {
  gearBonusSchema,
  slotIdSchema,
  weaponKindSchema,
  type GearBonus,
  type SlotId,
} from './gear';
import { buffIdSchema } from './consumables';
import { GEAR_ITEMS, priceOf } from './gear-items';
import { DRINKS, MOUNTS } from './rides-and-drinks';
import { PREMIUM_LEVEL_HEAD_START, premiumItems } from './premium';

/**
 * Item catalog — the groundwork for cosmetics and gear that can later be earned or sold.
 *
 * Rules (see docs/roadmap.md):
 * - Ownership lives on the server only (`bud_items`); the client never decides what a player owns.
 * - Gear (items with a `slot`) adds stats and skills while worn — only gear earned in the game may do that;
 *   anything bought with real money (premium, gems) is looks only (`gearProblems`, checked by the tests).
 * - Free starter items are implicit (never stored); everything else must be granted by the server
 *   (reward, verified purchase, gift, promo).
 */

/** Same names and order as the design system's rarity tokens. */
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const;
export type Rarity = (typeof RARITIES)[number];

export const ITEM_KINDS = [
  'character', // premium bud body or special character
  'outfit',
  'headwear',
  'accessory',
  'weapon',
  'emote',
  'district', // access to a premium district / event zone
  'gear', // clothes and things worn for their bonuses (shoes, vests, glasses…)
  'mount', // rides: skateboard, scooter, bike, motorbike, quad
  'consumable', // energy drinks: carried in numbers, drunk for a timed boost
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/**
 * `free` — starter set; `coins` — soft currency earned only in the game (server-granted);
 * `gems` — hard currency bought in the store.
 */
export const CURRENCIES = ['free', 'coins', 'gems'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** reward = quest or cache, shop = bought for coins in the game, purchase = verified real-money receipt. */
export const ITEM_SOURCES = ['reward', 'shop', 'purchase', 'gift', 'promo'] as const;
export type ItemSource = (typeof ITEM_SOURCES)[number];

export const itemIdSchema = z.string().regex(/^[a-z0-9-]{3,40}$/);

export const catalogItemSchema = z.object({
  id: itemIdSchema,
  kind: z.enum(ITEM_KINDS),
  name: z.string().min(1),
  rarity: z.enum(RARITIES),
  price: z.object({ currency: z.enum(CURRENCIES), amount: z.number().int().nonnegative() }),
  /** Needs real money (directly or through gems). */
  premium: z.boolean(),
  /** false = reserved slot, not obtainable yet ("wkrótce"). */
  available: z.boolean(),
  /** Where it is worn (gear); items without a slot are looks or collectibles. */
  slot: slotIdSchema.optional(),
  /** What it adds while worn. */
  bonus: gearBonusSchema.optional(),
  /** Sold in the in-game coin shop. */
  shop: z.boolean().optional(),
  /** One line about the item (shop, inventory). */
  description: z.string().max(140).optional(),
  /** The bud's level needed to wear or buy it. */
  minLevel: z.number().int().min(1).max(30).optional(),
  /** Weapons (slot "held"): which moves the bud gets in a duel. */
  weapon: weaponKindSchema.optional(),
  /** Can drop as loot from duels. */
  loot: z.boolean().optional(),
  /** Mounts: how much faster (%) the bud moves while riding. Not part of the gear speed cap. */
  mountSpeed: z.number().int().min(5).max(150).optional(),
  /** Energy drinks: the boost drinking one gives. */
  drink: buffIdSchema.optional(),
  /** Not obtainable yet, but shown in the shop as "wkrótce". */
  preview: z.boolean().optional(),
  /** Premium items with power: the earned item they match exactly (same bonus, weapon, ride speed). */
  twin: itemIdSchema.optional(),
});
export type CatalogItem = z.infer<typeof catalogItemSchema>;

export const catalogResponseSchema = z.object({ items: z.array(catalogItemSchema) });
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;

export const ownedItemSchema = z.object({
  itemId: itemIdSchema,
  source: z.enum(ITEM_SOURCES),
  acquiredAt: z.string(),
});
export type OwnedItem = z.infer<typeof ownedItemSchema>;

export const ownedItemsResponseSchema = z.object({ items: z.array(ownedItemSchema) });
export type OwnedItemsResponse = z.infer<typeof ownedItemsResponseSchema>;

const free = { currency: 'free', amount: 0 } as const;

/** Hair styles that are really headwear (they become catalog items, so special caps can be sold later). */
const HEADWEAR = [
  'czapka',
  'daszek',
  'sluchawki',
] as const satisfies readonly (typeof HAIR_STYLES)[number][];

export const outfitItemId = (outfit: BudLook['outfit']) => `outfit-${outfit}`;
export const headwearItemId = (hair: BudLook['hair']) => `headwear-${hair}`;

const EARNED: readonly CatalogItem[] = [
  // starter set: everything the website creator offers today
  ...OUTFITS.map((o): CatalogItem => ({
    id: outfitItemId(o),
    kind: 'outfit',
    name: OUTFIT_LABELS[o],
    rarity: 'common',
    price: free,
    premium: false,
    available: true,
  })),
  ...HEADWEAR.map((h): CatalogItem => ({
    id: headwearItemId(h),
    kind: 'headwear',
    name: HAIR_LABELS[h],
    rarity: 'common',
    price: free,
    premium: false,
    available: true,
  })),
  // reserved slots — one per future product line, so the pipeline (catalog → ownership → look) is exercised
  {
    id: 'character-premium-slot',
    kind: 'character',
    name: 'Postać premium',
    rarity: 'legendary',
    price: { currency: 'gems', amount: 0 },
    premium: true,
    available: false,
  },
  {
    id: 'outfit-premium-slot',
    kind: 'outfit',
    name: 'Strój premium',
    rarity: 'epic',
    price: { currency: 'gems', amount: 0 },
    premium: true,
    available: false,
  },
  {
    id: 'weapon-starter-slot',
    kind: 'weapon',
    name: 'Pierwsza broń',
    rarity: 'uncommon',
    price: { currency: 'coins', amount: 0 },
    premium: false,
    available: false,
  },
  // quest rewards (granted by the server on completion), worn for their bonuses
  ...(
    [
      [
        'deskorolka',
        'Deskorolka Kuby',
        'uncommon',
        4,
        'held',
        { attack: 3, speed: 6, skills: { flow: 1 } },
        'deska',
      ],
      [
        'spray-zloty',
        'Złoty spray',
        'rare',
        5,
        'held',
        { attack: 3, skills: { graffiti: 2 } },
        'spray',
      ],
      [
        'wianek-aloha',
        'Wianek Aloha',
        'uncommon',
        3,
        'head',
        { luck: 2, skills: { surfing: 1 } },
        undefined,
      ],
      ['muszla-szczescia', 'Muszla szczęścia', 'rare', 4, 'accessory', { luck: 6 }, undefined],
      ['monokl', 'Monokl', 'rare', 5, 'face', { skills: { spryt: 1 } }, undefined],
      ['cylinder', 'Cylinder', 'epic', 6, 'head', { luck: 3, skills: { spryt: 1 } }, undefined],
      [
        'rekawice-bokserskie',
        'Rękawice bokserskie',
        'rare',
        7,
        'hands',
        { attack: 3, armor: 1, skills: { walka: 1 } },
        undefined,
      ],
      [
        'kurtka-karkos',
        'Kurtka z naszywkami',
        'epic',
        8,
        'torso',
        { armor: 4, skills: { przetrwanie: 1 } },
        undefined,
      ],
    ] as const
  ).map(([id, name, rarity, minLevel, slot, bonus, weapon]): CatalogItem => ({
    id,
    kind: weapon ? 'weapon' : 'gear',
    name,
    rarity,
    price: { currency: 'coins', amount: priceOf(rarity, minLevel) },
    premium: false,
    available: true,
    slot,
    bonus: bonus as GearBonus,
    minLevel,
    weapon,
  })),
  // the gear of the world: loot from duels, the cheaper half also in the coin shop (own brands, never real ones)
  ...GEAR_ITEMS,
  ...MOUNTS,
  ...DRINKS,
  // real money, later: looks only (shown in the shop as "wkrótce")
  {
    id: 'buty-sprintery-zlote',
    kind: 'outfit',
    name: 'Sprintery Błysk — złota edycja',
    rarity: 'legendary',
    price: { currency: 'gems', amount: 0 },
    premium: true,
    available: false,
    preview: true,
    description: 'Tylko wygląd: złote buty, te same statystyki.',
  },
];

/** Everything: items earned in the game, then the premium rides and weapons built from their twins. */
export const CATALOG: readonly CatalogItem[] = [...EARNED, ...premiumItems(EARNED)];

/**
 * Rule check for the catalog: gear has a slot, a bonus needs a slot, and nothing bought with real money gives a
 * bonus (no pay-to-win). Empty when the catalog is fine.
 */
export function gearProblems(catalog: readonly CatalogItem[] = CATALOG): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const item of catalog) {
    if (ids.has(item.id)) problems.push(`duplicate item ${item.id}`);
    ids.add(item.id);
    if (item.bonus && !item.slot) problems.push(`${item.id}: a bonus needs a slot`);
    if (item.kind === 'gear' && !item.slot) problems.push(`${item.id}: gear needs a slot`);
    const paid = item.premium || item.price.currency === 'gems';
    // real money buys looks and an earlier start, never more power: a paid item with power copies an earned twin
    if (paid && (item.bonus || item.weapon || item.mountSpeed)) {
      const twin = item.twin ? catalog.find((i) => i.id === item.twin) : undefined;
      if (!twin) problems.push(`${item.id}: a paid item with power needs an earned twin`);
      else if (twin.premium || twin.price.currency === 'gems' || !twin.available)
        problems.push(`${item.id}: its twin ${twin.id} must be earnable in the game`);
      else {
        if (
          JSON.stringify(item.bonus ?? {}) !== JSON.stringify(twin.bonus ?? {}) ||
          item.weapon !== twin.weapon ||
          item.mountSpeed !== twin.mountSpeed ||
          item.slot !== twin.slot
        )
          problems.push(`${item.id}: must be exactly as strong as its twin ${twin.id}`);
        if (levelOf(item) < levelOf(twin) - PREMIUM_LEVEL_HEAD_START)
          problems.push(
            `${item.id}: at most ${PREMIUM_LEVEL_HEAD_START} levels earlier than ${twin.id}`,
          );
      }
    }
    if (item.weapon && item.slot !== 'held') problems.push(`${item.id}: weapons are held`);
    if (item.slot === 'held' && !item.weapon) problems.push(`${item.id}: held items are weapons`);
    if ((item.slot === 'mount') !== (item.mountSpeed !== undefined))
      problems.push(`${item.id}: mounts go in the mount slot and have a mountSpeed`);
    if (item.drink && (item.slot || item.kind !== 'consumable'))
      problems.push(`${item.id}: drinks are consumables without a slot`);
    if (item.drink && paid) problems.push(`${item.id}: real money never buys boosts`);
    if (item.loot && (item.premium || item.price.currency === 'gems'))
      problems.push(`${item.id}: real-money items never drop`);
    if (item.shop && (item.price.currency !== 'coins' || item.price.amount <= 0 || !item.available))
      problems.push(`${item.id}: the coin shop sells available items for coins`);
  }
  return problems;
}

/** Items the coin shop sells. */
export const shopItems = (catalog: readonly CatalogItem[] = CATALOG) =>
  catalog.filter((i) => i.shop && i.available);

/** Can this item go into that slot? */
export const fitsSlot = (item: CatalogItem | undefined, slot: SlotId) =>
  !!item && item.slot === slot;

export const catalogItem = (id: string, catalog: readonly CatalogItem[] = CATALOG) =>
  catalog.find((item) => item.id === id);

/** Catalog items a look uses (outfit, headwear). */
export function lookItemIds(look: BudLook): string[] {
  const ids = [outfitItemId(look.outfit)];
  if ((HEADWEAR as readonly string[]).includes(look.hair)) ids.push(headwearItemId(look.hair));
  return ids;
}

/**
 * Items in the look the player may not wear: not free and not owned, or not in the catalog at all.
 * The API rejects a look while this is non-empty — clients can't unlock items by editing JSON.
 */
export function lockedItems(
  look: BudLook,
  owned: ReadonlySet<string>,
  catalog: readonly CatalogItem[] = CATALOG,
): string[] {
  return lookItemIds(look).filter((id) => {
    const item = catalogItem(id, catalog);
    if (!item) return true;
    return item.price.currency !== 'free' && !owned.has(id);
  });
}

/** The level an item needs (1 when it has no requirement). */
export const levelOf = (item: CatalogItem | undefined) => item?.minLevel ?? 1;
