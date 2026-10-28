import { describe, expect, it } from 'vitest';
import {
  ABILITIES,
  BRAWL_TICK_MS,
  Brawl,
  KIT_SLOTS,
  MOVE_MAX_RANK,
  TURFS,
  WEAPON_KINDS,
  budFighter,
  cellFeet,
  characterStats,
  defaultKit,
  kitOf,
  kitProblem,
  movePool,
  moveUpgradeProblem,
  movesView,
  nearestWalkable,
  rankCost,
  rankLevel,
  resolveKit,
  unlockNeed,
  type MoveContext,
  type WeaponKind,
} from '../src';

const fresh: MoveContext = { level: 1, skills: {}, perks: [] };
const veteran: MoveContext = {
  level: 12,
  skills: { walka: 3, przetrwanie: 2 },
  perks: ['cios-specjalny'],
};

describe('loadouts', () => {
  it('every move in every pool is a real ability, and every button has a choice', () => {
    for (const w of WEAPON_KINDS) {
      const pool = movePool(w as WeaponKind);
      for (const ids of Object.values(pool))
        for (const id of ids) expect(ABILITIES[id], `${w}: ${id}`).toBeDefined();
      expect(pool.basic.length, w).toBeGreaterThanOrEqual(2);
      expect(pool.skill.length, w).toBeGreaterThanOrEqual(4);
      expect(pool.guard).toEqual(['garda', 'kontra', 'zryw']);
    }
  });

  it('starts as the weapon’s own, the stronger versions once learned', () => {
    expect(defaultKit('piesci', fresh)).toEqual(['prosty', 'sierpowy', 'kopniak', 'garda', null]);
    expect(defaultKit('piesci', veteran)).toEqual([
      'seria-ciosow',
      'bomba',
      'z-polobrotu',
      'kontra',
      'specjalny',
    ]);
    const plain = budFighter('Bud', 0, characterStats([]), undefined);
    expect(kitOf(plain)).toEqual(defaultKit('piesci', fresh));
  });

  it('takes only open moves, each on its own kind of button, two different abilities', () => {
    expect(
      kitProblem('piesci', ['prosty', 'kopniak', 'sierpowy', 'garda', null], fresh),
    ).toBeNull();
    expect(kitProblem('piesci', ['prosty', 'podciecie', 'sierpowy', 'garda', null], fresh)).toMatch(
      /zamknięty/,
    );
    expect(kitProblem('piesci', ['prosty', 'kopniak', 'kopniak', 'garda', null], fresh)).toMatch(
      /różne/,
    );
    expect(kitProblem('piesci', ['garda', 'kopniak', 'sierpowy', 'prosty', null], fresh)).toMatch(
      /nie pasuje/,
    );
    expect(kitProblem('piesci', ['prosty', 'kopniak'], fresh)).toMatch(/Pięć/);
    expect(
      kitProblem('piesci', ['prosty', 'podciecie', 'z-polobrotu', 'zryw', 'ult-piesci'], veteran),
    ).toBeNull();
    expect(unlockNeed('bomba', fresh)).toBe('Poziom 7 · Walka 2');
    expect(unlockNeed('tag', veteran)).toBe('Atut: Tag legendy');
  });

  it('a saved loadout that no longer fits falls back button by button', () => {
    const saved = ['seria-ciosow', 'podciecie', 'bomba', 'zryw', 'specjalny'];
    expect(resolveKit('piesci', saved, veteran)).toEqual(saved);
    // a fresh bud (a reset, another device): everything closed goes back to the weapon's own
    expect(resolveKit('piesci', saved, fresh)).toEqual([
      'prosty',
      'sierpowy',
      'kopniak',
      'garda',
      null,
    ]);
    // a loadout of another weapon is not this weapon's
    expect(resolveKit('kij', saved, veteran)[0]).toBe('szybkie-pchniecie');
    expect(resolveKit('piesci', null, fresh)).toHaveLength(KIT_SLOTS);
  });

  it('upgrades cost more each time, need levels, and stop at the top', () => {
    expect(rankCost('sierpowy', 1)).toBeLessThan(rankCost('sierpowy', 2));
    expect(rankCost('sierpowy', 2)).toBeLessThan(rankCost('sierpowy', 3));
    expect(rankCost('bomba', 1)).toBeGreaterThan(rankCost('sierpowy', 1));
    expect(rankLevel('sierpowy', 1)).toBe(3);
    expect(moveUpgradeProblem('sierpowy', 0, fresh, 9999)).toBe('level');
    expect(moveUpgradeProblem('sierpowy', 0, { ...fresh, level: 3 }, 10)).toBe('poor');
    expect(moveUpgradeProblem('sierpowy', 0, { ...fresh, level: 3 }, 9999)).toBeNull();
    expect(moveUpgradeProblem('bomba', 0, fresh, 9999)).toBe('locked');
    expect(moveUpgradeProblem('sierpowy', MOVE_MAX_RANK, veteran, 9999)).toBe('max');
    expect(moveUpgradeProblem('nic', 0, veteran, 9999)).toBe('unknown');
  });

  it('the Ciosy screen shows every option with what it needs', () => {
    const view = movesView('piesci', defaultKit('piesci', fresh), { sierpowy: 2 }, fresh, 100);
    expect(view.slots).toHaveLength(KIT_SLOTS);
    const sierpowy = view.slots[1]!.options.find((o) => o.id === 'sierpowy')!;
    expect(sierpowy.rank).toBe(2);
    expect(sierpowy.power).toBe(120);
    expect(sierpowy.next).toEqual({
      coins: rankCost('sierpowy', 3),
      level: rankLevel('sierpowy', 3),
    });
    expect(sierpowy.blurb).toMatch(/^Wypad · ogłusza/);
    expect(view.slots[1]!.options.find((o) => o.id === 'podciecie')!.need).toBe('Poziom 3');
  });
});

describe('an upgraded move in a fight', () => {
  it('hits harder and comes back sooner', () => {
    const park = TURFS.find((t) => t.id === 'mz-park-miejski')!;
    const c = cellFeet('miasto-ziomkow', (park.x0 + park.x1) >> 1, (park.y0 + park.y1) >> 1);
    const at = nearestWalkable('miasto-ziomkow', c.x, c.y)!;
    const xp = 100 * 7 ** 2;
    const make = (ranks: Record<string, number>) => {
      const b = new Brawl('miasto-ziomkow', 5, 1000);
      b.addBud('a', 'a', budFighter('A', xp, characterStats([]), undefined, { ranks }), at.x, at.y);
      b.addBud('v', 'v', budFighter('V', xp, characterStats([]), undefined), at.x + 1, at.y);
      return b;
    };
    let plain = 0;
    let upgraded = 0;
    for (const [ranks, add] of [
      [{}, (n: number) => (plain += n)],
      [{ prosty: 3 }, (n: number) => (upgraded += n)],
    ] as const) {
      const b = make(ranks);
      let now = 1000;
      for (let i = 0; i < 30; i++) {
        now += 750;
        b.act('a', 0, at.x + 1, at.y, 'v');
        for (let k = 0; k < 15; k++) {
          now += BRAWL_TICK_MS;
          for (const e of b.step(now).events) if (e.k === 'hit' && e.u === 'a') add(e.n ?? 0);
        }
        b.units.get('v')!.hp = b.units.get('v')!.maxHp;
      }
      if (Object.keys(ranks).length) expect(b.units.get('a')!.ready[0]).toBeLessThan(now + 700);
    }
    expect(upgraded).toBeGreaterThan(plain * 1.15);
  });
});
