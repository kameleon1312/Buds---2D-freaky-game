import { z } from 'zod';
import { HAIR_STYLES, OUTFITS, OUTFIT_LABELS, HAIR_LABELS } from './bud/constants';
import type { BudLook } from './bud/look';
import { gearBonusSchema, slotIdSchema, type GearBonus, type SlotId } from './gear';

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
  /** Not obtainable yet, but shown in the shop as "wkrótce". */
  preview: z.boolean().optional(),
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

export const CATALOG: readonly CatalogItem[] = [
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
        'accessory',
        'Deskorolka Kuby',
        'uncommon',
        400,
        'held',
        { speed: 6, skills: { flow: 1 } },
      ],
      ['spray-zloty', 'accessory', 'Złoty spray', 'rare', 900, 'held', { skills: { graffiti: 2 } }],
      [
        'wianek-aloha',
        'headwear',
        'Wianek Aloha',
        'uncommon',
        500,
        'head',
        { luck: 2, skills: { surfing: 1 } },
      ],
      ['muszla-szczescia', 'accessory', 'Muszla szczęścia', 'rare', 1200, 'accessory', { luck: 6 }],
      ['monokl', 'accessory', 'Monokl', 'rare', 1400, 'face', { skills: { spryt: 1 } }],
      ['cylinder', 'headwear', 'Cylinder', 'epic', 2500, 'head', { luck: 3, skills: { spryt: 1 } }],
      [
        'rekawice-bokserskie',
        'weapon',
        'Rękawice bokserskie',
        'rare',
        1800,
        'hands',
        { armor: 1, skills: { walka: 1 } },
      ],
      [
        'kurtka-karkos',
        'outfit',
        'Kurtka z naszywkami',
        'epic',
        3000,
        'torso',
        { armor: 4, skills: { przetrwanie: 1 } },
      ],
    ] as const
  ).map(([id, kind, name, rarity, coins, slot, bonus]): CatalogItem => ({
    id,
    kind,
    name,
    rarity,
    price: { currency: 'coins', amount: coins },
    premium: false,
    available: true,
    slot,
    bonus: bonus as GearBonus,
  })),
  // the coin shop: gear for coins earned in the game (own brands — never real ones)
  ...(
    [
      [
        'buty-trampki',
        'Trampki Ziomal',
        'common',
        150,
        'feet',
        { speed: 3 },
        'Lekkie trampki na co dzień.',
      ],
      [
        'buty-glany',
        'Glany Karkos',
        'uncommon',
        700,
        'feet',
        { speed: 2, armor: 3 },
        'Ciężkie, ale nic ich nie przebije.',
      ],
      [
        'buty-sprintery',
        'Sprintery Błysk',
        'rare',
        1500,
        'feet',
        { speed: 10 },
        'Najszybsze buty w mieście.',
      ],
      [
        'spodnie-dresy',
        'Dresy Szybki Lolek',
        'common',
        200,
        'legs',
        { speed: 2 },
        'Wygodne na bieganie po osiedlu.',
      ],
      [
        'spodnie-bojowki',
        'Bojówki Sześć Kieszeni',
        'uncommon',
        600,
        'legs',
        { armor: 1, luck: 3 },
        'Zmieszczą każde znalezisko.',
      ],
      [
        'kamizelka-odblaskowa',
        'Kamizelka Widoczny',
        'common',
        250,
        'torso',
        { armor: 1, luck: 1 },
        'Widać cię z daleka.',
      ],
      [
        'bluza-kewlar',
        'Bluza z kewlaru Pancerniak',
        'epic',
        3500,
        'torso',
        { armor: 8 },
        'Wygląda jak zwykła bluza. Nie jest zwykła.',
      ],
      [
        'kask-twardziel',
        'Kask Twardziel',
        'uncommon',
        500,
        'head',
        { armor: 3 },
        'Rowerowy, ale wytrzyma więcej.',
      ],
      [
        'okulary-lisie-oko',
        'Okulary Lisie Oko',
        'rare',
        1200,
        'face',
        { luck: 5 },
        'Widzisz to, czego inni nie widzą.',
      ],
      [
        'rekawiczki-kleks',
        'Rękawiczki Kleks',
        'uncommon',
        600,
        'hands',
        { skills: { graffiti: 1 } },
        'Farba się ich nie ima.',
      ],
      [
        'plecak-szperacz',
        'Plecak Szperacz',
        'rare',
        1400,
        'accessory',
        { luck: 4, skills: { spryt: 1 } },
        'Dla tych, którzy szukają skrytek.',
      ],
      [
        'mikrofon-bit',
        'Mikrofon Bit',
        'uncommon',
        800,
        'held',
        { skills: { flow: 1 } },
        'Bez niego żadna bitwa.',
      ],
    ] as const
  ).map(([id, name, rarity, coins, slot, bonus, description]): CatalogItem => ({
    id,
    kind: 'gear',
    name,
    rarity,
    price: { currency: 'coins', amount: coins },
    premium: false,
    available: true,
    slot,
    bonus: bonus as GearBonus,
    shop: true,
    description,
  })),
  // real money, later: looks only, never bonuses (shown in the shop as "wkrótce")
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
    if (item.bonus && (item.premium || item.price.currency === 'gems'))
      problems.push(`${item.id}: real-money items are looks only (no bonus)`);
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
