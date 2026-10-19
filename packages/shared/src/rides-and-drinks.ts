import type { CatalogItem } from './catalog';
import { priceOf } from './gear-items';
import type { BuffId } from './consumables';

/**
 * Mounts (pojazdy): rides in the "Pojazd" slot that make the bud faster outdoors. Earned in the game only:
 * the cheaper ones in the coin shop, the motorbike and the quad from strong opponents' loot.
 */
export const MOUNTS: CatalogItem[] = (
  [
    [
      'mount-deskorolka',
      'Deskorolka Cruiser',
      'common',
      1,
      20,
      true,
      'Szeroka deska z miękkimi kółkami.',
    ],
    [
      'mount-hulajnowa',
      'Hulajnowa Śmigacz',
      'uncommon',
      3,
      30,
      true,
      'Składana, mieści się pod pachą.',
    ],
    ['mount-rower', 'Rower Góral', 'rare', 5, 45, true, 'Przerzutki, błotniki, dzwonek.'],
    [
      'mount-e-hulajnowa',
      'E-hulajnowa Volt',
      'rare',
      7,
      55,
      false,
      'Cicha i szybka. Ładuje się od słońca, chyba.',
    ],
    [
      'mount-motocykl',
      'Motocykl Grzmot',
      'epic',
      9,
      70,
      false,
      'Ryk silnika słychać w trzech dzielnicach.',
    ],
    [
      'mount-quad',
      'Quad Bestia',
      'legendary',
      12,
      85,
      false,
      'Cztery koła, zero hamulców w głowie.',
    ],
  ] as const
).map(([id, name, rarity, minLevel, mountSpeed, shop, description]) => ({
  id,
  kind: 'mount',
  name,
  rarity,
  price: { currency: 'coins', amount: priceOf(rarity, minLevel) },
  premium: false,
  available: true,
  slot: 'mount',
  mountSpeed,
  shop,
  loot: true,
  minLevel,
  description,
}));

/** Energy drinks: cheap, sold again and again, sometimes dropped by opponents. */
export const DRINKS: CatalogItem[] = (
  [
    ['napoj-turbo', 'Napój Turbo', 'turbo', 80, 'Bąbelki prosto do łydek.'],
    ['napoj-sila', 'Napój Siła', 'sila', 120, 'Smakuje jak żelazo. W dobrym sensie.'],
    ['napoj-pancerz', 'Napój Pancerz', 'pancerz', 120, 'Po nim nawet kij się odbija.'],
    ['napoj-fart', 'Napój Fart', 'fart', 150, 'Koniczyna w puszce.'],
    ['napoj-skupienie', 'Napój Skupienie', 'skupienie', 100, 'Na trening: podwójne efekty.'],
    ['napoj-regeneracja', 'Napój Regeneracja', 'regeneracja', 110, 'Wraca siły przed walką.'],
  ] as const satisfies readonly [string, string, BuffId, number, string][]
).map(([id, name, drink, coins, description]) => ({
  id,
  kind: 'consumable',
  name,
  rarity: 'common',
  price: { currency: 'coins', amount: coins },
  premium: false,
  available: true,
  drink,
  shop: true,
  description,
}));
