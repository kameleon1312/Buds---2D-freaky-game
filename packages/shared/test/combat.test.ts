import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  CONTENT,
  DISTRICTS,
  MAX_TURNS,
  MOVES,
  MOVES_BY_WEAPON,
  WEAPON_KINDS,
  budFighter,
  catalogItem,
  characterStats,
  damage,
  enemyById,
  enemyFighter,
  fightXp,
  hitChance,
  newFight,
  playTurn,
  rollLoot,
  type Enemy,
  type FightState,
  type MoveId,
} from '../src';

const xpForLevel = (level: number) => 100 * (level - 1) ** 2;

function fight(enemy: Enemy, budLevel: number, gear: string[] = [], seed = 1): FightState {
  const worn = gear.map((id) => catalogItem(id)!);
  const weapon = worn.find((i) => i.slot === 'held');
  return newFight(
    enemy.id,
    budFighter('Bud', xpForLevel(budLevel), characterStats(worn), weapon),
    enemyFighter(enemy),
    seed,
  );
}

/** A simple player: strongest expected hit, guard when low. */
function autoplay(state: FightState): FightState {
  let s = state;
  while (s.status === 'active') {
    const low = s.bud.hp * 100 < s.bud.maxHp * 25;
    const attacks = s.bud.moves.filter((m) => MOVES[m].power[1] > 0);
    const best = attacks.sort((a, b) => {
      const v = (id: MoveId) => (MOVES[id].power[0] + MOVES[id].power[1]) * MOVES[id].accuracy;
      return v(b) - v(a);
    })[0]!;
    s = playTurn(s, low && s.turn % 3 === 0 ? 'garda' : best).state;
  }
  return s;
}

const dresiarz = enemyById('dresiarz-z-bramy')!;

describe('moves', () => {
  it('every weapon kind has four moves, Garda included, with known animations', () => {
    for (const kind of WEAPON_KINDS) {
      expect(MOVES_BY_WEAPON[kind]).toHaveLength(4);
      expect(MOVES_BY_WEAPON[kind]).toContain('garda');
    }
    for (const item of CATALOG.filter((i) => i.slot === 'held')) expect(item.weapon).toBeDefined();
  });

  it('gives the bud the moves of its weapon, fists without one', () => {
    expect(fight(dresiarz, 1).bud.moves).toEqual(MOVES_BY_WEAPON.piesci);
    expect(fight(dresiarz, 3, ['kij-hejnal']).bud.moves).toEqual(MOVES_BY_WEAPON.kij);
    expect(fight(dresiarz, 1, ['proca-z-galezi']).bud.weapon).toBe('procarka');
  });
});

describe('a turn', () => {
  it('is deterministic for a state and a move', () => {
    const s = fight(dresiarz, 1);
    expect(playTurn(s, 'prosty')).toEqual(playTurn(s, 'prosty'));
    expect(s.turn).toBe(0); // the input state is not changed
  });

  it('deals damage, advances the turn and keeps the RNG moving', () => {
    const s = fight(dresiarz, 1);
    const { state, events } = playTurn(s, 'prosty');
    expect(state.turn).toBe(1);
    expect(state.rng).not.toBe(s.rng);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.actor === 'bud' && e.move === 'prosty')).toBe(true);
    const last = events.at(-1)!;
    expect(last.enemyHp).toBe(state.enemy.hp);
    expect(last.budHp).toBe(state.bud.hp);
  });

  it('refuses moves the bud does not have and finished fights', () => {
    const s = fight(dresiarz, 1);
    expect(() => playTurn(s, 'zamach')).toThrow();
    expect(() => playTurn({ ...s, status: 'won' }, 'prosty')).toThrow();
  });

  it('ends in a win, a loss or the turn limit', () => {
    for (let seed = 1; seed < 20; seed++) {
      const end = autoplay(fight(dresiarz, 1, [], seed));
      expect(['won', 'lost']).toContain(end.status);
      expect(end.turn).toBeLessThanOrEqual(MAX_TURNS);
      if (end.status === 'won') expect(end.enemy.hp).toBe(0);
    }
  });
});

describe('maths', () => {
  const s = fight(dresiarz, 1);
  it('guard halves and armor reduces damage', () => {
    const open = damage(10, s.bud, s.enemy, false, false);
    expect(damage(10, s.bud, s.enemy, false, true)).toBe(Math.max(1, Math.floor(open / 2)));
    const armored = { ...s.enemy, armor: 30 };
    expect(damage(10, s.bud, armored, false, false)).toBeLessThan(open);
    expect(damage(10, s.bud, s.enemy, true, false)).toBeGreaterThan(open);
  });

  it('blindness and dodging make hits less likely, never impossible', () => {
    const move = MOVES.prosty;
    const base = hitChance(move, s.bud, s.enemy, false);
    expect(hitChance(move, s.bud, s.enemy, true)).toBeLessThan(base);
    const blind = { ...s.bud, status: { ...s.bud.status, blind: 2 } };
    expect(hitChance(move, blind, s.enemy, false)).toBeLessThan(base);
    expect(hitChance(move, blind, { ...s.enemy, speed: 99 }, true)).toBe(10);
  });

  it('a weapon and gear make the bud stronger', () => {
    let plain = 0;
    let geared = 0;
    for (let seed = 1; seed <= 60; seed++) {
      if (autoplay(fight(dresiarz, 1, [], seed)).status === 'won') plain++;
      if (
        autoplay(fight(dresiarz, 1, ['kij-od-szczotki', 'czapka-mrozik', 'koszulka-ligowa'], seed))
          .status === 'won'
      )
        geared++;
    }
    expect(geared).toBeGreaterThanOrEqual(plain);
  });
});

describe('opponents', () => {
  it('every district has at least five, from its unlock level up', () => {
    for (const d of DISTRICTS) {
      const here = CONTENT.enemies.filter((e) => e.district === d.id);
      expect(here.length).toBeGreaterThanOrEqual(5);
      expect(Math.min(...here.map((e) => e.level))).toBeGreaterThanOrEqual(d.unlockLevel);
    }
    expect(CONTENT.enemies.filter((e) => e.boss).length).toBeGreaterThanOrEqual(2);
  });

  it('are beatable at their level with matching gear, bosses are harder', () => {
    const rate = (e: Enemy, gear: string[]) => {
      let wins = 0;
      for (let seed = 1; seed <= 80; seed++)
        if (autoplay(fight(e, e.level, gear, seed)).status === 'won') wins++;
      return wins / 80;
    };
    // a bud wearing the best gear it can have at that level, in every slot
    const gearFor = (level: number) =>
      ['head', 'face', 'torso', 'hands', 'legs', 'feet', 'accessory', 'held'].map((slot) => {
        const fits = CATALOG.filter(
          (i) => i.slot === slot && i.loot && (i.minLevel ?? 1) <= level,
        ).sort((x, y) => (y.minLevel ?? 1) - (x.minLevel ?? 1));
        return fits[0]!.id;
      });
    for (const e of CONTENT.enemies.filter((x) => !x.boss))
      expect(rate(e, gearFor(e.level)), e.id).toBeGreaterThan(0.5);
    for (const e of CONTENT.enemies.filter((x) => x.boss)) {
      expect(rate(e, gearFor(e.level))).toBeLessThan(rate(e, gearFor(e.level + 3)) + 0.01);
    }
  });
});

describe('rewards', () => {
  it('gives less XP for opponents the bud has outgrown', () => {
    expect(fightXp(dresiarz, 1)).toBe(dresiarz.xp);
    expect(fightXp(dresiarz, 5)).toBeLessThan(dresiarz.xp);
    expect(fightXp(dresiarz, 50)).toBeGreaterThanOrEqual(1);
  });

  it('drops loot by rarity and level, deterministically', () => {
    const boss = CONTENT.enemies.find((e) => e.boss)!;
    const drops = Array.from({ length: 200 }, (_, i) =>
      rollLoot(boss, 0, CATALOG, new Set(), i + 1),
    );
    expect(rollLoot(boss, 0, CATALOG, new Set(), 7)).toEqual(
      rollLoot(boss, 0, CATALOG, new Set(), 7),
    );
    const items = drops
      .map((d) => d.itemId)
      .filter((x): x is string => !!x)
      .map((id) => catalogItem(id)!);
    expect(items.length).toBeGreaterThan(100);
    expect(items.every((i) => (i.minLevel ?? 1) <= boss.level + 2)).toBe(true);
    expect(items.every((i) => !i.premium)).toBe(true);
    expect(items.some((i) => i.rarity === 'legendary' || i.rarity === 'epic')).toBe(true);

    const weak = Array.from({ length: 200 }, (_, i) =>
      rollLoot(dresiarz, 0, CATALOG, new Set(), i + 1),
    )
      .map((d) => d.itemId)
      .filter((x): x is string => !!x)
      .map((id) => catalogItem(id)!);
    expect(
      weak.every((i) => i.rarity !== 'legendary' && (i.minLevel ?? 1) <= dresiarz.level + 2),
    ).toBe(true);
  });

  it('turns an item the bud already owns into coins', () => {
    const boss = CONTENT.enemies.find((e) => e.boss)!;
    for (let seed = 1; seed < 50; seed++) {
      const first = rollLoot(boss, 0, CATALOG, new Set(), seed);
      if (!first.itemId) continue;
      const again = rollLoot(boss, 0, CATALOG, new Set([first.itemId]), seed);
      expect(again.itemId).toBeNull();
      expect(again.coins).toBeGreaterThan(first.coins);
      return;
    }
    throw new Error('no drop in 50 seeds');
  });
});
