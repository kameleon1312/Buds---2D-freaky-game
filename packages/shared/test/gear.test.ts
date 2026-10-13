import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  SKILL_GEAR_MAX,
  SKILL_MAX_RANK,
  SLOTS,
  STATS,
  catalogItem,
  characterStats,
  coinsWithLuck,
  emptyEquipment,
  fitsSlot,
  gearProblems,
  shopItems,
  type CatalogItem,
} from '../src';

describe('gear catalog', () => {
  it('follows the rules: slots for gear, no bonuses for real money', () => {
    expect(gearProblems()).toEqual([]);
  });

  it('catches pay-to-win and broken shop entries', () => {
    const base = catalogItem('buty-sprintery')!;
    const broken: CatalogItem[] = [
      { ...base, id: 'p2w', premium: true, price: { currency: 'gems', amount: 100 } },
      { ...base, id: 'bez-miejsca', slot: undefined },
      { ...base, id: 'za-darmo', price: { currency: 'free', amount: 0 } },
    ];
    const problems = gearProblems(broken);
    expect(problems.some((p) => p.includes('p2w') && p.includes('looks only'))).toBe(true);
    expect(problems.some((p) => p.includes('bez-miejsca'))).toBe(true);
    expect(problems.some((p) => p.includes('za-darmo') && p.includes('coin shop'))).toBe(true);
  });

  it('has something for every slot, in the shop or as a reward', () => {
    for (const slot of SLOTS)
      expect(CATALOG.some((i) => i.available && i.slot === slot.id)).toBe(true);
    expect(shopItems().length).toBeGreaterThanOrEqual(10);
    expect(shopItems().every((i) => i.price.currency === 'coins')).toBe(true);
  });

  it('knows which slot an item fits', () => {
    expect(fitsSlot(catalogItem('buty-sprintery'), 'feet')).toBe(true);
    expect(fitsSlot(catalogItem('buty-sprintery'), 'head')).toBe(false);
    expect(fitsSlot(catalogItem('outfit-bluza'), 'torso')).toBe(false); // looks, not gear
    expect(fitsSlot(undefined, 'feet')).toBe(false);
  });

  it('starts every slot empty', () => {
    expect(Object.values(emptyEquipment()).every((v) => v === null)).toBe(true);
    expect(Object.keys(emptyEquipment())).toHaveLength(SLOTS.length);
  });
});

describe('characterStats', () => {
  const worn = (...ids: string[]) => ids.map((id) => catalogItem(id)!);

  it('adds up what the bud wears', () => {
    const stats = characterStats(worn('buty-sprintery', 'spodnie-dresy', 'bluza-kewlar'));
    expect(stats).toMatchObject({ speed: 12, armor: 8, luck: 0 });
  });

  it('adds gear to trained skills, within limits', () => {
    const stats = characterStats(worn('monokl', 'cylinder', 'plecak-szperacz'), { spryt: 1 });
    expect(stats.skills.spryt).toBe(1 + SKILL_GEAR_MAX); // three items, but at most +2
    const maxed = characterStats(worn('monokl'), { spryt: SKILL_MAX_RANK });
    expect(maxed.skills.spryt).toBe(SKILL_MAX_RANK + 1);
    expect(characterStats([]).skills.flow).toBe(0);
  });

  it('caps every stat', () => {
    const many = Array.from({ length: 10 }, () => ({
      bonus: { attack: 15, speed: 15, armor: 15, luck: 15 },
    }));
    const stats = characterStats(many);
    for (const s of STATS) expect(stats[s.id]).toBe(s.max);
  });

  it('turns luck into extra cache coins', () => {
    expect(coinsWithLuck(100, 0)).toBe(100);
    expect(coinsWithLuck(40, 5)).toBe(42);
    expect(coinsWithLuck(100, 999)).toBe(150); // capped
    expect(coinsWithLuck(100, -10)).toBe(100);
  });
});
