import { z } from 'zod';
import { HAIR_STYLES, OUTFITS, OUTFIT_LABELS, HAIR_LABELS } from './bud/constants';
import type { BudLook } from './bud/look';

/**
 * Item catalog — the groundwork for cosmetics and gear that can later be earned or sold.
 *
 * Rules (see docs/roadmap.md):
 * - Ownership lives on the server only (`bud_items`); the client never decides what a player owns.
 * - Items are cosmetic or side-grades; nothing sold for real money may win fights on its own.
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
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/**
 * `free` — starter set; `coins` — soft currency earned only in the game (server-granted);
 * `gems` — hard currency bought in the store.
 */
export const CURRENCIES = ['free', 'coins', 'gems'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const ITEM_SOURCES = ['reward', 'purchase', 'gift', 'promo'] as const;
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
  // quest rewards (granted by the server on completion; later also in the coin shop)
  ...(
    [
      ['deskorolka', 'accessory', 'Deskorolka Kuby', 'uncommon', 400],
      ['spray-zloty', 'accessory', 'Złoty spray', 'rare', 900],
      ['wianek-aloha', 'headwear', 'Wianek Aloha', 'uncommon', 500],
      ['muszla-szczescia', 'accessory', 'Muszla szczęścia', 'rare', 1200],
      ['monokl', 'accessory', 'Monokl', 'rare', 1400],
      ['cylinder', 'headwear', 'Cylinder', 'epic', 2500],
      ['rekawice-bokserskie', 'weapon', 'Rękawice bokserskie', 'rare', 1800],
      ['kurtka-karkos', 'outfit', 'Kurtka z naszywkami', 'epic', 3000],
    ] as const
  ).map(([id, kind, name, rarity, coins]): CatalogItem => ({
    id,
    kind,
    name,
    rarity,
    price: { currency: 'coins', amount: coins },
    premium: false,
    available: true,
  })),
];

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
