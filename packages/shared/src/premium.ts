import type { CatalogItem } from './catalog';

/**
 * Premium items (for gems, bought with real money): rides and weapons you can only get this way. They look unique
 * (own art, the mythic rarity) but are exactly as strong as their `twin`, an item anyone can earn in the game, and
 * may be worn at most PREMIUM_LEVEL_HEAD_START levels earlier. `gearProblems` checks both, so real money buys style
 * and an earlier start, never more power. They never drop as loot.
 */
export const PREMIUM_LEVEL_HEAD_START = 2;

type Row = [id: string, name: string, twin: string, gems: number, description: string];

const ROWS: Row[] = [
  // rides
  [
    'mount-deskorolka-holo',
    'Deskorolka Holo',
    'mount-deskorolka',
    120,
    'Holograficzny blat mieni się w słońcu.',
  ],
  [
    'mount-hulajnowa-neon',
    'Hulajnowa Neon',
    'mount-hulajnowa',
    200,
    'Świecące kółka zostawiają smugę.',
  ],
  ['mount-rower-chrom', 'Rower Chrom', 'mount-rower', 320, 'Chromowana rama, złote szprychy.'],
  [
    'mount-motocykl-smok',
    'Motocykl Smok',
    'mount-motocykl',
    650,
    'Łuski na baku, płomienie na felgach.',
  ],
  ['mount-quad-wulkan', 'Quad Wulkan', 'mount-quad', 950, 'Lawa w oponach, dym spod kół.'],
  // weapons
  [
    'premium-deska-plomien',
    'Deska Płomień',
    'deska-fala',
    180,
    'Deska w ogniu. Te same ruchy, inny klimat.',
  ],
  ['premium-kij-neon', 'Kij Neon', 'palka-teleskopowa', 180, 'Świeci w ciemności jak rurka neonu.'],
  ['premium-proca-laser', 'Proca Laser', 'luk-przyssawki', 220, 'Celownik z czerwoną kropką.'],
  ['premium-spray-tecza', 'Spray Tęcza', 'gasnica', 240, 'Każdy psik w innym kolorze.'],
  ['premium-mikrofon-zloty', 'Złoty Mikrofon', 'boombox', 380, 'Dla gwiazd sceny.'],
  [
    'premium-kij-smoka',
    'Kij Smoka',
    'zloty-kij-szefa',
    700,
    'Wyrzeźbiony smok wzdłuż całego kija.',
  ],
];

/** Builds the premium items from their twins (same slot, weapon, bonus and ride speed). */
export function premiumItems(earned: readonly CatalogItem[]): CatalogItem[] {
  return ROWS.map(([id, name, twinId, gems, description]) => {
    const twin = earned.find((i) => i.id === twinId);
    if (!twin) throw new Error(`premium ${id}: unknown twin ${twinId}`);
    const item: CatalogItem = {
      id,
      kind: twin.kind,
      name,
      rarity: 'mythic',
      price: { currency: 'gems', amount: gems },
      premium: true,
      available: true,
      slot: twin.slot,
      bonus: twin.bonus,
      weapon: twin.weapon,
      mountSpeed: twin.mountSpeed,
      minLevel: Math.max(1, (twin.minLevel ?? 1) - PREMIUM_LEVEL_HEAD_START),
      twin: twin.id,
      description,
    };
    return Object.fromEntries(
      Object.entries(item).filter(([, v]) => v !== undefined),
    ) as CatalogItem;
  });
}

/** Items the premium shop sells (for gems). */
export const premiumShopItems = (catalog: readonly CatalogItem[]) =>
  catalog.filter(
    (i) => i.premium && i.available && i.price.currency === 'gems' && i.price.amount > 0,
  );
