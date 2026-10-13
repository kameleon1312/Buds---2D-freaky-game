import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  DISTRICTS,
  RARITIES,
  START_DISTRICT,
  canEnterDistrict,
  catalogItemSchema,
  lockedItems,
  lookItemIds,
  randomLook,
  type BudLook,
  type CatalogItem,
} from '../src';

const look: BudLook = {
  gender: 'on',
  mood: 'radosny',
  skin: 0,
  hair: 'daszek',
  hairColor: 0,
  outfit: 'kurtka',
  outfitColor: 0,
  pantsColor: 0,
};

describe('catalog', () => {
  it('every item is valid and ids are unique', () => {
    for (const item of CATALOG)
      expect(catalogItemSchema.safeParse(item).success, item.id).toBe(true);
    expect(new Set(CATALOG.map((i) => i.id)).size).toBe(CATALOG.length);
  });

  it('uses the design system rarities', () => {
    expect(RARITIES).toEqual(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']);
  });

  it('premium items are never free', () => {
    for (const item of CATALOG.filter((i) => i.premium))
      expect(item.price.currency, item.id).not.toBe('free');
  });

  it('every look the website can make uses only free items today', () => {
    for (let i = 0; i < 300; i++) expect(lockedItems(randomLook(), new Set())).toEqual([]);
  });

  it('lists the items a look wears', () => {
    expect(lookItemIds(look)).toEqual(['outfit-kurtka', 'headwear-daszek']);
    expect(lookItemIds({ ...look, hair: 'afro' })).toEqual(['outfit-kurtka']);
  });

  it('locks paid items until the server says they are owned', () => {
    const catalog: CatalogItem[] = CATALOG.map((i) =>
      i.id === 'outfit-kurtka'
        ? { ...i, premium: true, price: { currency: 'gems', amount: 300 } }
        : i,
    );
    expect(lockedItems(look, new Set(), catalog)).toEqual(['outfit-kurtka']);
    expect(lockedItems(look, new Set(['outfit-kurtka']), catalog)).toEqual([]);
  });

  it('treats items missing from the catalog as locked', () => {
    expect(lockedItems(look, new Set(), [])).toEqual(['outfit-kurtka', 'headwear-daszek']);
  });
});

describe('districts', () => {
  it('starts in an open level-1 district and unlocks in order', () => {
    expect(DISTRICTS[0]).toMatchObject({ id: START_DISTRICT, unlockLevel: 1, status: 'open' });
    expect(DISTRICTS.map((d) => d.name)).toEqual([
      'Miasto Ziomków',
      'Las Palmas',
      'Dwór Carski',
      'Los Karkos',
    ]);
    const levels = DISTRICTS.map((d) => d.unlockLevel);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
  });

  it('gates entry by level and readiness', () => {
    expect(canEnterDistrict('miasto-ziomkow', 1)).toBe(true);
    expect(canEnterDistrict('los-karkos', 11)).toBe(false);
    expect(canEnterDistrict('los-karkos', 12)).toBe(true);
    expect(canEnterDistrict('nowhere', 99)).toBe(false);
  });
});
