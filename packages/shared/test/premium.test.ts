import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  CONTENT,
  PREMIUM_LEVEL_HEAD_START,
  catalogItem,
  gearProblems,
  levelOf,
  premiumShopItems,
  rollLoot,
  type CatalogItem,
} from '../src';

describe('premium rides and weapons', () => {
  const premium = premiumShopItems(CATALOG);

  it('sells unique rides and weapons for gems', () => {
    expect(premium.filter((i) => i.slot === 'mount').length).toBeGreaterThanOrEqual(5);
    expect(premium.filter((i) => i.weapon).length).toBeGreaterThanOrEqual(5);
    for (const i of premium) {
      expect(i.price.currency).toBe('gems');
      expect(i.rarity).toBe('mythic');
      expect(i.shop).toBeFalsy(); // not in the coin shop
      expect(i.loot).toBeFalsy(); // never drops
    }
  });

  it('are exactly as strong as an item earned in the game', () => {
    for (const i of premium) {
      const twin = catalogItem(i.twin!)!;
      expect(twin.premium, i.id).toBe(false);
      expect(i.bonus).toEqual(twin.bonus);
      expect(i.weapon).toBe(twin.weapon);
      expect(i.mountSpeed).toBe(twin.mountSpeed);
      expect(levelOf(i)).toBeGreaterThanOrEqual(levelOf(twin) - PREMIUM_LEVEL_HEAD_START);
    }
    expect(gearProblems()).toEqual([]);
  });

  it('catches premium items stronger than their twin or too early', () => {
    const quad = catalogItem('mount-quad-wulkan')!;
    const kij = catalogItem('premium-kij-smoka')!;
    const broken: CatalogItem[] = [
      ...CATALOG,
      { ...quad, id: 'quad-p2w', mountSpeed: 120 },
      { ...kij, id: 'kij-p2w', bonus: { attack: 30 } },
      { ...kij, id: 'kij-wczesny', minLevel: 1 },
      { ...kij, id: 'kij-bez-pary', twin: undefined },
      { ...kij, id: 'kij-para-premium', twin: 'mount-quad-wulkan' },
    ];
    const problems = gearProblems(broken);
    for (const id of ['quad-p2w', 'kij-p2w', 'kij-wczesny', 'kij-bez-pary', 'kij-para-premium'])
      expect(
        problems.some((p) => p.startsWith(id)),
        id,
      ).toBe(true);
  });

  it('never drop from duels', () => {
    const boss = CONTENT.enemies.find((e) => e.boss)!;
    for (let seed = 1; seed < 300; seed++) {
      const loot = rollLoot(boss, 0, CATALOG, new Set(), seed);
      if (loot.itemId) expect(catalogItem(loot.itemId)!.premium).toBe(false);
    }
  });
});
